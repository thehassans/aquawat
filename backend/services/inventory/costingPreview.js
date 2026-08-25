import { D, decStr } from '../../utils/decimal.js';
import Product from '../../models/Product.js';
import InvProductCategory from '../../models/inventory/InvProductCategory.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';
import { loadCostContext, productInventoryValue } from './valuation.js';

async function valueWithForcedMethod(tenantId, productId, costMethod) {
  const tid = toObjectId(tenantId);
  const current = await productInventoryValue(tid, productId);
  const qty = D(current.qty || 0);
  if (qty.eq(0)) {
    return { qty: '0', value: '0', costMethod, unitCost: '0' };
  }

  if (costMethod === 'fifo') {
    const layers = await InvValuationLayer.find({ tenantId: tid, productId }).lean();
    const remaining = layers.reduce((s, l) => D(s).plus(D(l.remainingValue || 0)), D(0));
    // If no layers yet, fall back to standard × qty so preview is still informative
    if (remaining.eq(0)) {
      const ctx = await loadCostContext(productId, null);
      const unit = D(ctx.standardPrice);
      return { qty: decStr(qty), value: decStr(unit.mul(qty)), costMethod: 'fifo', unitCost: decStr(unit), note: 'no_layers' };
    }
    return { qty: decStr(qty), value: decStr(remaining), costMethod: 'fifo' };
  }

  const ctx = await loadCostContext(productId, null);
  const unit = D(ctx.standardPrice);
  return {
    qty: decStr(qty),
    value: decStr(unit.mul(qty)),
    costMethod,
    unitCost: decStr(unit),
  };
}

/**
 * Preview valuation impact of changing a category's costing method (before save).
 */
export async function previewCategoryCostingDelta(tenantId, categoryId, proposedMethod) {
  const tid = toObjectId(tenantId);
  if (!['standard', 'fifo', 'average'].includes(proposedMethod)) {
    throw new InventoryValidationError('Invalid costing method', 'COSTING_METHOD');
  }

  const cat = await InvProductCategory.findOne({ _id: categoryId, tenantId: tid }).lean();
  if (!cat) throw new InventoryValidationError('Category not found', 'CAT_NOT_FOUND');

  const products = await Product.find({
    tenantId: tid,
    categoryId: cat._id,
    trackInventory: { $ne: false },
  }).select('_id sku nameEn costPrice').limit(500).lean();

  let currentTotal = D(0);
  let proposedTotal = D(0);
  const items = [];

  for (const p of products) {
    const current = await productInventoryValue(tid, p._id);
    const proposed = await valueWithForcedMethod(tid, p._id, proposedMethod);
    const curVal = D(current.value || 0);
    const propVal = D(proposed.value || 0);
    currentTotal = currentTotal.plus(curVal);
    proposedTotal = proposedTotal.plus(propVal);
    if (!curVal.eq(propVal) || Number(current.qty) > 0) {
      items.push({
        productId: p._id,
        sku: p.sku,
        name: p.nameEn,
        qty: current.qty,
        currentMethod: current.costMethod,
        currentValue: decStr(curVal),
        proposedMethod,
        proposedValue: decStr(propVal),
        delta: decStr(propVal.minus(curVal)),
      });
    }
  }

  return {
    categoryId: cat._id,
    categoryPath: cat.completePath,
    currentMethod: cat.costingMethod,
    proposedMethod,
    productCount: products.length,
    currentTotal: decStr(currentTotal),
    proposedTotal: decStr(proposedTotal),
    delta: decStr(proposedTotal.minus(currentTotal)),
    items: items.slice(0, 50),
  };
}
