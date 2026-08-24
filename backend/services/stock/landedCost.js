import mongoose from 'mongoose';
import { D, decStr, decIsZero } from '../../utils/decimal.js';
import {
  StockLandedCost,
  StockValuationLayer,
  StockPicking,
  StockMove,
  StockMoveLine,
  StockProductVariant,
  StockProductTemplate,
  StockProductCategory,
} from '../../models/stock/index.js';
import { nextSequenceName, ensureSequence } from './sequence.js';
import { loadCostContext } from './valuation.js';
import { runWithTransaction } from './reserve.js';
import { StockValidationError } from './errors.js';

/**
 * Pure split of cost lines across products (testable).
 * @returns {Map<string, Decimal>} productId -> additional cost
 */
export function splitLandedCostAmounts(products, costLines) {
  const adjustments = new Map();
  for (const line of costLines || []) {
    const price = D(line.price);
    if (decIsZero(price)) continue;

    let weights;
    switch (line.splitMethod) {
      case 'equal':
        weights = products.map(() => D(1));
        break;
      case 'by_weight':
        weights = products.map((p) => D(p.weight || 0));
        break;
      case 'by_volume':
        weights = products.map((p) => D(p.volume || 0));
        break;
      case 'by_current_cost_price':
        weights = products.map((p) => D(p.cost || 0));
        break;
      case 'by_quantity':
      default:
        weights = products.map((p) => D(p.quantity || 0));
    }

    const totalW = weights.reduce((s, w) => s.plus(w), D(0));
    if (totalW.lte(0)) {
      const each = price.div(products.length || 1);
      for (const p of products) {
        const key = String(p.productId);
        adjustments.set(key, (adjustments.get(key) || D(0)).plus(each));
      }
      continue;
    }

    products.forEach((p, i) => {
      const key = String(p.productId);
      const share = price.mul(weights[i]).div(totalW);
      adjustments.set(key, (adjustments.get(key) || D(0)).plus(share));
    });
  }
  return adjustments;
}

export async function createLandedCost(tenantId, userId, body) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  await ensureSequence(tid, 'LC', 'LC');
  const name = body.name || await nextSequenceName(tid, 'LC');

  const [doc] = await StockLandedCost.create([{
    tenantId: tid,
    name,
    date: body.date || new Date(),
    pickingIds: body.pickingIds || [],
    costLines: (body.costLines || []).map((c) => ({
      name: c.name,
      productId: c.productId || null,
      price: String(c.price ?? 0),
      splitMethod: c.splitMethod || 'by_quantity',
    })),
    vendorBillRef: body.vendorBillRef,
    state: 'draft',
    createdBy: userId,
  }]);
  return doc;
}

/**
 * Compute per-product adjustments without posting.
 */
export async function computeLandedCost(tenantId, landedCostId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const lc = await StockLandedCost.findOne({ _id: landedCostId, tenantId: tid });
  if (!lc) throw new StockValidationError('Landed cost not found', 'LC_NOT_FOUND');
  if (lc.state === 'done') throw new StockValidationError('Already validated', 'LC_DONE');

  if (!lc.pickingIds?.length) {
    throw new StockValidationError('Select at least one receipt picking', 'NO_PICKINGS');
  }

  const pickings = await StockPicking.find({
    _id: { $in: lc.pickingIds },
    tenantId: tid,
    state: 'done',
  }).lean();

  if (!pickings.length) {
    throw new StockValidationError('No done receipt pickings found', 'NO_DONE_PICKINGS');
  }

  const moves = await StockMove.find({
    tenantId: tid,
    pickingId: { $in: pickings.map((p) => p._id) },
    state: 'done',
  }).lean();

  // Build product lines from moves
  const byProduct = new Map();
  for (const m of moves) {
    const key = String(m.productId);
    const prev = byProduct.get(key) || { productId: m.productId, quantity: D(0), weight: D(0), volume: D(0), cost: D(0) };
    prev.quantity = prev.quantity.plus(D(m.quantity || m.productUomQty || 0));

    const variant = await StockProductVariant.findById(m.productId).lean();
    const template = variant ? await StockProductTemplate.findById(variant.templateId).lean() : null;
    const category = template?.categoryId
      ? await StockProductCategory.findById(template.categoryId).lean()
      : null;

    // Block products that aren't FIFO/AVCO real-time
    if (!category || category.valuation !== 'real_time' || !['fifo', 'average'].includes(category.costMethod)) {
      throw new StockValidationError(
        `Landed costs only apply to real-time FIFO/AVCO products. Blocked: ${template?.name || m.productId}`,
        'LC_PRODUCT_BLOCKED',
      );
    }

    prev.weight = prev.weight.plus(D(template?.weight || 0).mul(D(m.quantity || 0)));
    prev.volume = prev.volume.plus(D(template?.volume || 0).mul(D(m.quantity || 0)));
    prev.cost = prev.cost.plus(D(template?.standardPrice || 0).mul(D(m.quantity || 0)));
    byProduct.set(key, prev);
  }

  const products = [...byProduct.values()];
  if (!products.length) throw new StockValidationError('No product moves on selected pickings', 'NO_MOVES');

  const adjustments = splitLandedCostAmounts(
    products.map((p) => ({
      productId: String(p.productId),
      quantity: p.quantity,
      weight: p.weight,
      volume: p.volume,
      cost: p.cost,
    })),
    lc.costLines || [],
  );

  lc.valuationAdjustmentLines = products.map((p) => {
    const additional = adjustments.get(String(p.productId)) || D(0);
    const unit = p.quantity.gt(0) ? additional.div(p.quantity) : D(0);
    return {
      productId: p.productId,
      additionalCost: decStr(additional),
      quantity: decStr(p.quantity),
      unitCostAdditional: decStr(unit),
    };
  });

  await lc.save();
  return lc;
}

/**
 * Validate landed cost — write additional valuation layers, update FIFO remainingValue / AVCO avg.
 */
export async function validateLandedCost(tenantId, landedCostId) {
  // Ensure adjustments computed before transaction
  let lcCheck = await StockLandedCost.findOne({
    _id: landedCostId,
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
  });
  if (!lcCheck) throw new StockValidationError('Landed cost not found', 'LC_NOT_FOUND');
  if (lcCheck.state === 'done') return lcCheck;
  if (!lcCheck.valuationAdjustmentLines?.length) {
    await computeLandedCost(tenantId, landedCostId);
  }

  const result = await runWithTransaction(async (session) => {
    const tid = new mongoose.Types.ObjectId(String(tenantId));
    const lc = await StockLandedCost.findOne({ _id: landedCostId, tenantId: tid }).session(session);
    if (!lc) throw new StockValidationError('Landed cost not found', 'LC_NOT_FOUND');
    if (lc.state === 'done') return lc;

    for (const adj of lc.valuationAdjustmentLines) {
      const additional = D(adj.additionalCost);
      if (decIsZero(additional)) continue;

      const ctx = await loadCostContext(adj.productId, session);
      const qty = D(adj.quantity);
      const unitAdd = qty.gt(0) ? additional.div(qty) : D(0);

      const [layer] = await StockValuationLayer.create([{
        tenantId: tid,
        productId: adj.productId,
        quantity: '0',
        unitCost: decStr(unitAdd),
        value: decStr(additional),
        remainingQty: '0',
        remainingValue: '0',
        stockLandedCostId: lc._id,
        description: `Landed cost ${lc.name}`,
      }], { session });

      adj.valuationLayerId = layer._id;

      if (ctx.costMethod === 'fifo') {
        const layers = await StockValuationLayer.find({
          tenantId: tid,
          productId: adj.productId,
          remainingQty: { $ne: '0' },
        }).sort({ createdAt: 1 }).session(session);

        const totalRemQty = layers.reduce((s, l) => D(s).plus(D(l.remainingQty)), D(0));
        if (totalRemQty.gt(0)) {
          for (const l of layers) {
            const share = additional.mul(D(l.remainingQty)).div(totalRemQty);
            l.remainingValue = decStr(D(l.remainingValue).plus(share));
            await l.save({ session });
          }
        }
      } else if (ctx.costMethod === 'average') {
        const old = D(ctx.template.standardPrice || 0);
        ctx.template.standardPrice = decStr(old.plus(unitAdd));
        await ctx.template.save({ session });
      }
    }

    lc.state = 'done';
    await lc.save({ session });
    return lc;
  });

  try {
    const { postLandedCostJournal } = await import('./stockAccounting.js');
    await postLandedCostJournal({
      tenantId,
      userId: result?.createdBy,
      landedCostId: result._id,
    });
  } catch (err) {
    console.error('[stock] landed cost journal failed', err?.message || err);
  }

  return result;
}
