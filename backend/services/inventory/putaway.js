import { D } from '../../utils/decimal.js';
import {
  InvPutawayRule,
  InvLocation,
  InvQuant,
  InvStorageCategory,
} from '../../models/inventory/index.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Resolve best putaway sublocation for a receipt into fromLocationId.
 * Specificity: product > category > packageType > generic; highest sequence first.
 */
export async function resolvePutawayLocation(tenantId, {
  fromLocationId,
  productId,
  packageTypeId,
} = {}) {
  const tid = toObjectId(tenantId);
  const locationIn = await InvLocation.findOne({ _id: fromLocationId, tenantId: tid }).lean();
  if (!locationIn) return fromLocationId;

  const product = productId ? await Product.findById(productId).lean() : null;
  const categoryId = product?.categoryId ? String(product.categoryId) : null;

  const rules = await InvPutawayRule.find({
    tenantId: tid,
    fromLocationId,
    active: true,
  }).sort({ sequence: -1 }).lean();

  const scored = rules.map((r) => {
    let specificity = 0;
    if (r.productId && productId && String(r.productId) === String(productId)) specificity = 4;
    else if (r.categoryId && categoryId && String(r.categoryId) === categoryId) specificity = 3;
    else if (r.packageTypeId && packageTypeId && String(r.packageTypeId) === String(packageTypeId)) specificity = 2;
    else if (!r.productId && !r.categoryId && !r.packageTypeId) specificity = 1;
    else return null;
    return { rule: r, specificity };
  }).filter(Boolean).sort((a, b) => b.specificity - a.specificity || b.rule.sequence - a.rule.sequence);

  for (const { rule } of scored) {
    const outId = rule.toLocationId;
    const ok = await checkStorageCapacity(tid, outId, productId, rule.storageCategoryId);
    if (ok) return outId;
  }

  return fromLocationId;
}

async function checkStorageCapacity(tenantId, locationId, productId, storageCategoryId) {
  const loc = await InvLocation.findById(locationId).lean();
  if (!loc || !loc.active) return false;

  const catId = storageCategoryId || loc.storageCategoryId;
  if (!catId) return true;

  const cat = await InvStorageCategory.findById(catId).lean();
  if (!cat) return true;

  const quants = await InvQuant.find({ tenantId, locationId }).lean();

  if (cat.allowNewProduct === 'empty') {
    if (quants.some((q) => D(q.quantity).gt(0))) return false;
  }

  if (cat.allowNewProduct === 'sameProduct' && productId) {
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
