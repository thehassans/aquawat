import mongoose from 'mongoose';
import { D } from '../../utils/decimal.js';
import {
  StockPutawayRule,
  StockLocation,
  StockQuant,
  StockProductVariant,
  StockProductTemplate,
  StockStorageCategory,
} from '../../models/stock/index.js';

/**
 * Resolve best putaway sublocation for a receipt into locationIn.
 * Specificity: product > category > packageType > generic; highest sequence first.
 * Falls back to parent location if no match or capacity full.
 */
export async function resolvePutawayLocation(tenantId, {
  locationInId,
  productId,
  packageTypeId,
} = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const locationIn = await StockLocation.findOne({ _id: locationInId, tenantId: tid }).lean();
  if (!locationIn) return locationInId;

  const variant = productId ? await StockProductVariant.findById(productId).lean() : null;
  const template = variant ? await StockProductTemplate.findById(variant.templateId).lean() : null;
  const categoryId = template?.categoryId ? String(template.categoryId) : null;

  const rules = await StockPutawayRule.find({
    tenantId: tid,
    locationInId,
    active: true,
  }).sort({ sequence: -1 }).lean();

  const scored = rules.map((r) => {
    let specificity = 0;
    if (r.productId && productId && String(r.productId) === String(productId)) specificity = 4;
    else if (r.categoryId && categoryId && String(r.categoryId) === categoryId) specificity = 3;
    else if (r.packageTypeId && packageTypeId && String(r.packageTypeId) === String(packageTypeId)) specificity = 2;
    else if (!r.productId && !r.categoryId && !r.packageTypeId) specificity = 1;
    else return null; // rule doesn't match
    return { rule: r, specificity };
  }).filter(Boolean).sort((a, b) => b.specificity - a.specificity || b.rule.sequence - a.rule.sequence);

  for (const { rule } of scored) {
    const outId = rule.locationOutId;
    const ok = await checkStorageCapacity(tid, outId, productId, rule.storageCategoryId);
    if (ok) return outId;
  }

  return locationInId;
}

async function checkStorageCapacity(tenantId, locationId, productId, storageCategoryId) {
  const loc = await StockLocation.findById(locationId).lean();
  if (!loc || !loc.active) return false;

  const catId = storageCategoryId || loc.storageCategoryId;
  if (!catId) return true;

  const cat = await StockStorageCategory.findById(catId).lean();
  if (!cat) return true;

  const quants = await StockQuant.find({
    tenantId,
    locationId,
  }).lean();

  if (cat.allowNewProduct === 'empty') {
    const anyStock = quants.some((q) => D(q.quantity).gt(0));
    if (anyStock) return false;
  }

  if (cat.allowNewProduct === 'same' && productId) {
    const otherProduct = quants.some(
      (q) => D(q.quantity).gt(0) && String(q.productId) !== String(productId),
    );
    if (otherProduct) return false;
  }

  if (cat.capacityByProduct?.length && productId) {
    const cap = cat.capacityByProduct.find((c) => String(c.productId) === String(productId));
    if (cap) {
      const onHand = quants
        .filter((q) => String(q.productId) === String(productId))
        .reduce((s, q) => D(s).plus(D(q.quantity)), D(0));
      if (onHand.gte(D(cap.qty))) return false;
    }
  }

  return true;
}
