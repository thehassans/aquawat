import { D, decStr, decIsZero } from '../../utils/decimal.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import InvProductCategory from '../../models/inventory/InvProductCategory.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

/**
 * Pure FIFO layer consumption.
 */
export function consumeFifoLayers(layers, qtyToConsume, standardPriceFallback = '0') {
  let need = D(qtyToConsume);
  let totalCost = D(0);
  const updates = [];

  for (const layer of layers) {
    if (need.lte(0)) break;
    const rem = D(layer.remainingQty);
    if (rem.lte(0)) continue;
    const take = rem.lt(need) ? rem : need;
    const unit = rem.gt(0) ? D(layer.remainingValue).div(rem) : D(layer.unitCost);
    const takeValue = unit.mul(take);

    let remainingQty = rem.minus(take);
    let remainingValue = D(layer.remainingValue).minus(takeValue);
    if (remainingQty.lte(0)) {
      remainingQty = D(0);
      remainingValue = D(0);
    }

    updates.push({
      _id: layer._id,
      remainingQty: decStr(remainingQty),
      remainingValue: decStr(remainingValue),
    });
    totalCost = totalCost.plus(takeValue);
    need = need.minus(take);
  }

  if (need.gt(0)) {
    totalCost = totalCost.plus(D(standardPriceFallback).mul(need));
    need = D(0);
  }

  return { totalCost, need, updates };
}

export async function loadCostContext(productId, session = null) {
  const product = await Product.findById(productId).session(session || null);
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  const category = product.categoryId
    ? await InvProductCategory.findById(product.categoryId).session(session || null)
    : null;
  return {
    product,
    category,
    costMethod: category?.costingMethod || 'average',
    valuationMode: category?.valuationMode || 'automated',
    standardPrice: String(product.costPrice ?? product.averageLandedCost ?? 0),
  };
}

/**
 * Pure AVCO: (qtyBefore * oldAvg + incomingQty * unitCost) / qtyAfter
 * Example: 10 @ 10 then 10 @ 13 → 11.5
 */
export function computeAverageCost({ qtyBefore, oldAvg, incomingQty, unitCost }) {
  const before = D(qtyBefore);
  const incoming = D(incomingQty);
  const after = before.plus(incoming);
  const cost = D(unitCost);
  if (!after.gt(0)) return cost;
  if (!before.gt(0)) return cost;
  return before.mul(D(oldAvg)).plus(incoming.mul(cost)).div(after);
}

async function currentInternalQty(tenantId, productId, session) {
  const internalLocs = await InvLocation.find({
    tenantId,
    usage: 'internal',
    active: true,
  }).select('_id').session(session).lean();
  const ids = internalLocs.map((l) => l._id);
  const quants = await InvQuant.find({
    tenantId,
    productId,
    locationId: { $in: ids },
  }).session(session).lean();

  let qty = D(0);
  for (const q of quants) qty = qty.plus(D(q.quantity));
  return qty;
}

/**
 * Create valuation layers when a move crosses the internal boundary.
 * Average costing (AVCO): weighted average of on-hand value + incoming receipt.
 * Skipped when inventoryEvaluationEnabled is false on InvSettings.
 * @param {'in'|'out'} direction
 */
export async function createValuationForMove(session, {
  tenantId,
  productId,
  quantity,
  moveId,
  direction,
  unitCostOverride,
  description,
  evaluationEnabled = true,
}) {
  if (evaluationEnabled === false) return null;

  const tid = toObjectId(tenantId);
  const ctx = await loadCostContext(productId, session);

  // Manual valuation: still write layers for reporting, skip journal later
  const qty = D(quantity);
  if (decIsZero(qty)) return null;

  if (direction === 'in') {
    let unitCost = D(unitCostOverride != null ? unitCostOverride : ctx.standardPrice);
    if (ctx.costMethod === 'standard') {
      unitCost = D(ctx.standardPrice);
    }

    const value = unitCost.mul(qty);
    const [layer] = await InvValuationLayer.create([{
      tenantId: tid,
      productId,
      quantity: decStr(qty),
      unitCost: decStr(unitCost),
      value: decStr(value),
      remainingQty: ctx.costMethod === 'fifo' ? decStr(qty) : '0',
      remainingValue: ctx.costMethod === 'fifo' ? decStr(value) : '0',
      moveId,
      description: description || 'Receipt',
    }], { session });

    if (ctx.costMethod === 'average') {
      // AVCO: (qty_before * avg + incoming_qty * unit_cost) / qty_after
      // Quant delta already applied, so currentInternalQty includes this receipt.
      const qtyAfter = await currentInternalQty(tid, productId, session);
      const qtyBefore = qtyAfter.minus(qty);
      const newAvg = computeAverageCost({
        qtyBefore,
        oldAvg: ctx.standardPrice,
        incomingQty: qty,
        unitCost,
      });
      ctx.product.costPrice = Number(decStr(newAvg));
      if (Number.isFinite(ctx.product.costPrice)) {
        await ctx.product.save({ session });
      }
    }

    return { layer, direction: 'in', valuationMode: ctx.valuationMode };
  }

  // OUTGOING
  if (ctx.costMethod === 'standard' || ctx.costMethod === 'average') {
    const unitCost = D(ctx.standardPrice);
    const value = unitCost.mul(qty).neg();
    const [layer] = await InvValuationLayer.create([{
      tenantId: tid,
      productId,
      quantity: decStr(qty.neg()),
      unitCost: decStr(unitCost),
      value: decStr(value),
      remainingQty: '0',
      remainingValue: '0',
      moveId,
      description: description || 'Delivery',
    }], { session });
    return { layer, direction: 'out', valuationMode: ctx.valuationMode };
  }

  // FIFO
  const layers = await InvValuationLayer.find({
    tenantId: tid,
    productId,
    remainingQty: { $ne: '0' },
  }).sort({ createdAt: 1, _id: 1 }).session(session);

  const { totalCost, updates } = consumeFifoLayers(layers, qty, ctx.standardPrice);
  for (const u of updates) {
    const layer = layers.find((l) => String(l._id) === String(u._id));
    if (!layer) continue;
    layer.remainingQty = u.remainingQty;
    layer.remainingValue = u.remainingValue;
    await layer.save({ session });
  }

  const unitCost = qty.gt(0) ? totalCost.div(qty) : D(0);
  const [outLayer] = await InvValuationLayer.create([{
    tenantId: tid,
    productId,
    quantity: decStr(qty.neg()),
    unitCost: decStr(unitCost),
    value: decStr(totalCost.neg()),
    remainingQty: '0',
    remainingValue: '0',
    moveId,
    description: description || 'Delivery (FIFO)',
  }], { session });

  return { layer: outLayer, direction: 'out', valuationMode: ctx.valuationMode };
}

export async function productInventoryValue(tenantId, productId) {
  const tid = toObjectId(tenantId);
  const ctx = await loadCostContext(productId, null);
  const qty = await currentInternalQty(tid, productId, null);

  if (ctx.costMethod === 'fifo') {
    const layers = await InvValuationLayer.find({ tenantId: tid, productId }).lean();
    const remaining = layers.reduce((s, l) => D(s).plus(D(l.remainingValue || 0)), D(0));
    return { qty: decStr(qty), value: decStr(remaining), costMethod: 'fifo' };
  }

  const unit = D(ctx.standardPrice);
  return {
    qty: decStr(qty),
    value: decStr(unit.mul(qty)),
    costMethod: ctx.costMethod,
    unitCost: decStr(unit),
  };
}
