import mongoose from 'mongoose';
import { D, decStr, decIsZero } from '../../utils/decimal.js';
import {
  StockValuationLayer,
  StockProductVariant,
  StockProductTemplate,
  StockProductCategory,
  StockQuant,
  StockLocation,
} from '../../models/stock/index.js';
import { StockValidationError } from './errors.js';

/**
 * Pure FIFO layer consumption (mutates copies; returns updates).
 * Invariant: remainingValue / remainingQty stays consistent with unit cost.
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

async function loadCostContext(productId, session) {
  const variant = await StockProductVariant.findById(productId).session(session);
  if (!variant) throw new StockValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  const template = await StockProductTemplate.findById(variant.templateId).session(session);
  const category = template?.categoryId
    ? await StockProductCategory.findById(template.categoryId).session(session)
    : null;
  return {
    variant,
    template,
    costMethod: category?.costMethod || 'average',
    valuation: category?.valuation || 'real_time',
    standardPrice: template?.standardPrice || '0',
  };
}

async function currentInternalQtyValue(tenantId, productId, session) {
  const internalLocs = await StockLocation.find({
    tenantId,
    usage: 'internal',
    active: true,
  }).select('_id').session(session).lean();
  const ids = internalLocs.map((l) => l._id);
  const quants = await StockQuant.find({
    tenantId,
    productId,
    locationId: { $in: ids },
  }).session(session).lean();

  let qty = D(0);
  let value = D(0);
  for (const q of quants) {
    qty = qty.plus(D(q.quantity));
    value = value.plus(D(q.value || 0));
  }
  return { qty, value };
}

/**
 * Create valuation layers when a move crosses the internal boundary.
 * @param {'in'|'out'} direction
 */
export async function createValuationForMove(session, {
  tenantId,
  productId,
  quantity,
  stockMoveId,
  direction,
  unitCostOverride,
  description,
}) {
  const ctx = await loadCostContext(productId, session);
  const qty = D(quantity);
  if (decIsZero(qty)) return null;

  if (direction === 'in') {
    let unitCost = D(unitCostOverride != null ? unitCostOverride : ctx.standardPrice);
    if (ctx.costMethod === 'standard') {
      unitCost = D(ctx.standardPrice);
    }

    const value = unitCost.mul(qty);
    const [layer] = await StockValuationLayer.create([{
      tenantId,
      productId,
      quantity: decStr(qty),
      unitCost: decStr(unitCost),
      value: decStr(value),
      remainingQty: ctx.costMethod === 'fifo' ? decStr(qty) : '0',
      remainingValue: ctx.costMethod === 'fifo' ? decStr(value) : '0',
      stockMoveId,
      description: description || 'Receipt',
    }], { session });

    // AVCO: update template standardPrice = new average
    if (ctx.costMethod === 'average') {
      const { qty: curQty, value: curValue } = await currentInternalQtyValue(tenantId, productId, session);
      // Note: quants may already include this receipt qty — prefer pre-receipt: curQty - qty
      const prevQty = curQty.minus(qty);
      const prevValue = curValue; // value on quants may lag; use layers for accuracy
      const layers = await StockValuationLayer.find({
        tenantId,
        productId,
        quantity: { $gt: '0' },
      }).session(session).lean();

      // Simpler AVCO from layers remaining / positive layers
      let totalQty = D(0);
      let totalValue = D(0);
      for (const l of layers) {
        if (D(l.quantity).gt(0)) {
          totalQty = totalQty.plus(D(l.quantity));
          totalValue = totalValue.plus(D(l.value));
        }
      }
      // Include current layer if not yet visible (just created)
      if (!layers.find((l) => String(l._id) === String(layer._id))) {
        totalQty = totalQty.plus(qty);
        totalValue = totalValue.plus(value);
      }

      const newAvg = totalQty.gt(0) ? totalValue.div(totalQty) : unitCost;
      ctx.template.standardPrice = decStr(newAvg);
      await ctx.template.save({ session });
    }

    return layer;
  }

  // OUTGOING
  if (ctx.costMethod === 'standard') {
    const unitCost = D(ctx.standardPrice);
    const value = unitCost.mul(qty).neg();
    const [layer] = await StockValuationLayer.create([{
      tenantId,
      productId,
      quantity: decStr(qty.neg()),
      unitCost: decStr(unitCost),
      value: decStr(value),
      remainingQty: '0',
      remainingValue: '0',
      stockMoveId,
      description: description || 'Delivery',
    }], { session });
    return layer;
  }

  if (ctx.costMethod === 'average') {
    const unitCost = D(ctx.template.standardPrice || 0);
    const value = unitCost.mul(qty).neg();
    const [layer] = await StockValuationLayer.create([{
      tenantId,
      productId,
      quantity: decStr(qty.neg()),
      unitCost: decStr(unitCost),
      value: decStr(value),
      remainingQty: '0',
      remainingValue: '0',
      stockMoveId,
      description: description || 'Delivery',
    }], { session });
    return layer;
  }

  // FIFO: consume oldest layers with remainingQty
  const layers = await StockValuationLayer.find({
    tenantId,
    productId,
    remainingQty: { $ne: '0' },
  }).sort({ createdAt: 1, _id: 1 }).session(session);

  const { totalCost, need, updates } = consumeFifoLayers(layers, qty, ctx.standardPrice);
  for (const u of updates) {
    const layer = layers.find((l) => String(l._id) === String(u._id));
    if (!layer) continue;
    layer.remainingQty = u.remainingQty;
    layer.remainingValue = u.remainingValue;
    await layer.save({ session });
  }
  void need;

  const unitCost = qty.gt(0) ? totalCost.div(qty) : D(0);
  const [outLayer] = await StockValuationLayer.create([{
    tenantId,
    productId,
    quantity: decStr(qty.neg()),
    unitCost: decStr(unitCost),
    value: decStr(totalCost.neg()),
    remainingQty: '0',
    remainingValue: '0',
    stockMoveId,
    description: description || 'Delivery (FIFO)',
  }], { session });

  return outLayer;
}

/**
 * Inventory value for a product = sum of remainingValue (FIFO) or on-hand * avg/standard.
 */
export async function productInventoryValue(tenantId, productId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const ctx = await loadCostContext(productId, null);
  const { qty } = await currentInternalQtyValue(tid, productId, null);

  if (ctx.costMethod === 'fifo') {
    const layers = await StockValuationLayer.find({ tenantId: tid, productId }).lean();
    const remaining = layers.reduce((s, l) => D(s).plus(D(l.remainingValue || 0)), D(0));
    return { qty: decStr(qty), value: decStr(remaining), costMethod: 'fifo' };
  }

  const unit = D(ctx.template?.standardPrice || 0);
  return { qty: decStr(qty), value: decStr(unit.mul(qty)), costMethod: ctx.costMethod, unitCost: decStr(unit) };
}

export { loadCostContext };
