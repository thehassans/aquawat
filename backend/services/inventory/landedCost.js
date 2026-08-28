import { D, decStr, decIsZero } from '../../utils/decimal.js';
import {
  InvLandedCost,
  InvValuationLayer,
  InvTransfer,
  InvMove,
} from '../../models/inventory/index.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { nextSequenceName, ensureSequence } from './sequence.js';
import { loadCostContext, persistAvcoStandardPrice } from './valuation.js';
import { runWithTransaction } from './reserve.js';
import { InventoryValidationError } from './errors.js';

export function landedCostLineKey(productId, variantId = null) {
  return `${String(productId)}|${variantId ? String(variantId) : ''}`;
}

/**
 * Pure split of cost lines across products (optionally per variant).
 * @returns {Map<string, import('decimal.js').default>}
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
      case 'byWeight':
        weights = products.map((p) => D(p.weight || 0));
        break;
      case 'byVolume':
        weights = products.map((p) => D(p.volume || 0));
        break;
      case 'byValue':
        weights = products.map((p) => D(p.cost || 0));
        break;
      case 'byQuantity':
      default:
        weights = products.map((p) => D(p.quantity || 0));
    }

    const totalW = weights.reduce((s, w) => s.plus(w), D(0));
    if (totalW.lte(0)) {
      const each = price.div(products.length || 1);
      for (const p of products) {
        const key = p.lineKey || landedCostLineKey(p.productId, p.variantId);
        adjustments.set(key, (adjustments.get(key) || D(0)).plus(each));
      }
      continue;
    }

    products.forEach((p, i) => {
      const key = p.lineKey || landedCostLineKey(p.productId, p.variantId);
      const share = price.mul(weights[i]).div(totalW);
      adjustments.set(key, (adjustments.get(key) || D(0)).plus(share));
    });
  }
  return adjustments;
}

export async function createLandedCost(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  await ensureSequence(tid, 'LC', 'LC');
  const name = body.name || await nextSequenceName(tid, 'LC');

  return InvLandedCost.create({
    tenantId: tid,
    name,
    date: body.date || new Date(),
    transferIds: body.transferIds || [],
    costLines: (body.costLines || []).map((c) => ({
      name: c.name,
      price: String(c.price ?? 0),
      splitMethod: c.splitMethod || 'byQuantity',
    })),
    vendorBillRef: body.vendorBillRef,
    legacyLandedCostId: body.legacyLandedCostId || null,
    state: 'draft',
    createdBy: userId,
  });
}

export async function computeLandedCost(tenantId, landedCostId) {
  const tid = toObjectId(tenantId);
  const lc = await InvLandedCost.findOne({ _id: landedCostId, tenantId: tid });
  if (!lc) throw new InventoryValidationError('Landed cost not found', 'LC_NOT_FOUND');
  if (lc.state === 'done') throw new InventoryValidationError('Already validated', 'LC_DONE');

  if (!lc.transferIds?.length) {
    throw new InventoryValidationError('Select at least one receipt transfer', 'NO_TRANSFERS');
  }

  const transfers = await InvTransfer.find({
    _id: { $in: lc.transferIds },
    tenantId: tid,
    state: 'done',
  }).lean();

  if (!transfers.length) {
    throw new InventoryValidationError('No done receipt transfers found', 'NO_DONE_TRANSFERS');
  }

  const moves = await InvMove.find({
    tenantId: tid,
    transferId: { $in: transfers.map((t) => t._id) },
    state: 'done',
  }).lean();

  const byLine = new Map();
  for (const m of moves) {
    const key = landedCostLineKey(m.productId, m.variantId);
    const prev = byLine.get(key) || {
      productId: m.productId,
      variantId: m.variantId || null,
      lineKey: key,
      quantity: D(0),
      weight: D(0),
      volume: D(0),
      cost: D(0),
    };
    const qty = D(m.doneQty || m.demandQty || 0);
    prev.quantity = prev.quantity.plus(qty);

    const product = await Product.findById(m.productId).lean();
    const ctx = await loadCostContext(m.productId, null, { variantId: m.variantId || null });
    if (ctx.valuationMode !== 'automated' || !['fifo', 'average'].includes(ctx.costMethod)) {
      throw new InventoryValidationError(
        `Landed costs require automated FIFO/AVCO. Blocked: ${product?.nameEn || m.productId}`,
        'LC_PRODUCT_BLOCKED',
      );
    }

    prev.weight = prev.weight.plus(D(product?.weight || 0).mul(qty));
    const vol = D(product?.dimensions?.length || 0)
      .mul(D(product?.dimensions?.width || 0))
      .mul(D(product?.dimensions?.height || 0));
    prev.volume = prev.volume.plus(vol.mul(qty));
    prev.cost = prev.cost.plus(D(ctx.standardPrice).mul(qty));
    byLine.set(key, prev);
  }

  const products = [...byLine.values()];
  if (!products.length) throw new InventoryValidationError('No product moves on selected transfers', 'NO_MOVES');

  const adjustments = splitLandedCostAmounts(
    products.map((p) => ({
      productId: String(p.productId),
      variantId: p.variantId || null,
      lineKey: p.lineKey,
      quantity: p.quantity,
      weight: p.weight,
      volume: p.volume,
      cost: p.cost,
    })),
    lc.costLines || [],
  );

  lc.valuationAdjustmentLines = products.map((p) => {
    const key = p.lineKey || landedCostLineKey(p.productId, p.variantId);
    const additional = adjustments.get(key) || D(0);
    const unit = p.quantity.gt(0) ? additional.div(p.quantity) : D(0);
    return {
      productId: p.productId,
      variantId: p.variantId || null,
      additionalCost: decStr(additional),
      quantity: decStr(p.quantity),
      unitCostAdditional: decStr(unit),
    };
  });

  await lc.save();
  return lc;
}

export async function validateLandedCost(tenantId, landedCostId, userId = null) {
  let lcCheck = await InvLandedCost.findOne({
    _id: landedCostId,
    tenantId: toObjectId(tenantId),
  });
  if (!lcCheck) throw new InventoryValidationError('Landed cost not found', 'LC_NOT_FOUND');
  if (lcCheck.state === 'done') return lcCheck;
  if (!lcCheck.valuationAdjustmentLines?.length) {
    await computeLandedCost(tenantId, landedCostId);
  }

  const result = await runWithTransaction(async (session) => {
    const tid = toObjectId(tenantId);
    const lc = await InvLandedCost.findOne({ _id: landedCostId, tenantId: tid }).session(session);
    if (!lc) throw new InventoryValidationError('Landed cost not found', 'LC_NOT_FOUND');
    if (lc.state === 'done') return lc;

    for (const adj of lc.valuationAdjustmentLines) {
      const additional = D(adj.additionalCost);
      if (decIsZero(additional)) continue;

      const ctx = await loadCostContext(adj.productId, session, { variantId: adj.variantId || null });
      const qty = D(adj.quantity);
      const unitAdd = qty.gt(0) ? additional.div(qty) : D(0);
      const vid = adj.variantId ? toObjectId(adj.variantId) : null;

      const [layer] = await InvValuationLayer.create([{
        tenantId: tid,
        productId: adj.productId,
        variantId: vid,
        quantity: '0',
        unitCost: decStr(unitAdd),
        value: decStr(additional),
        remainingQty: '0',
        remainingValue: '0',
        landedCostId: lc._id,
        description: `Landed cost ${lc.name}`,
      }], { session });

      adj.valuationLayerId = layer._id;

      if (ctx.costMethod === 'fifo') {
        const layerFilter = {
          tenantId: tid,
          productId: adj.productId,
          remainingQty: { $ne: '0' },
        };
        if (vid) {
          layerFilter.variantId = vid;
        } else {
          layerFilter.$or = [{ variantId: null }, { variantId: { $exists: false } }];
        }
        const layers = await InvValuationLayer.find(layerFilter)
          .sort({ createdAt: 1 }).session(session);

        const totalRemQty = layers.reduce((s, l) => D(s).plus(D(l.remainingQty)), D(0));
        if (totalRemQty.gt(0)) {
          for (const l of layers) {
            const share = additional.mul(D(l.remainingQty)).div(totalRemQty);
            l.remainingValue = decStr(D(l.remainingValue).plus(share));
            await l.save({ session });
          }
        }
      } else if (ctx.costMethod === 'average') {
        const old = D(ctx.standardPrice || 0);
        await persistAvcoStandardPrice(ctx, old.plus(unitAdd), session);
      }
    }

    lc.state = 'done';
    if (userId) lc.updatedBy = userId;
    await lc.save({ session });
    return lc;
  });

  try {
    const { postLandedCostJournal } = await import('./stockAccounting.js');
    await postLandedCostJournal({
      tenantId,
      userId: userId || result?.createdBy,
      landedCostId: result._id,
    });
  } catch (err) {
    console.error('[inventory] landed cost journal failed', err?.message || err);
  }

  return result;
}

/**
 * Bridge: after legacy LandedCost posts, create Inv valuation adjustments when engine on.
 */
export async function applyLegacyLandedCostToLayers(tenantId, userId, legacyLandedCost) {
  const tid = toObjectId(tenantId);
  const allocs = legacyLandedCost.allocations || [];
  if (!allocs.length) return null;

  const existing = await InvLandedCost.findOne({
    tenantId: tid,
    legacyLandedCostId: legacyLandedCost._id,
  });
  if (existing?.state === 'done') return existing;

  await ensureSequence(tid, 'LC', 'LC');
  const name = legacyLandedCost.lcNumber || await nextSequenceName(tid, 'LC');

  let lc = existing;
  if (!lc) {
    lc = await InvLandedCost.create({
      tenantId: tid,
      name,
      date: legacyLandedCost.invoiceDate || new Date(),
      transferIds: [],
      costLines: [{
        name: 'Legacy allocation',
        price: String(legacyLandedCost.totalCost || 0),
        splitMethod: 'byQuantity',
      }],
      valuationAdjustmentLines: allocs.map((a) => ({
        productId: a.productId,
        additionalCost: String(a.allocatedCost || 0),
        quantity: String(a.quantity || 0),
        unitCostAdditional: String(a.unitLandedCost || 0),
      })),
      legacyLandedCostId: legacyLandedCost._id,
      state: 'draft',
      createdBy: userId,
    });
  }

  return validateLandedCost(tid, lc._id, userId);
}
