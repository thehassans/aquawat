import InvProductVariant from '../../models/inventory/InvProductVariant.js';
import Product from '../../models/Product.js';

/**
 * Strict variant binding: if a product has active variants, SO lines must set variantId.
 * Parent template-only lines (product without variant when variants exist) are illegal.
 */
export async function assertSellLineVariantBinding(lineItems = [], tenantId) {
  const productIds = [...new Set(
    (lineItems || [])
      .map((li) => String(li.productId?._id || li.productId || ''))
      .filter(Boolean),
  )];
  if (!productIds.length) return { ok: true };

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds }, tenantId }).select('_id nameEn name productType').lean(),
    InvProductVariant.find({ tenantId, productId: { $in: productIds }, active: { $ne: false } })
      .select('productId')
      .lean(),
  ]);

  const withVariants = new Set(variants.map((v) => String(v.productId)));
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const errors = [];

  for (const [idx, li] of (lineItems || []).entries()) {
    const pid = String(li.productId?._id || li.productId || '');
    if (!pid) continue;
    const product = byId.get(pid);
    if (!product) {
      errors.push(`Line ${idx + 1}: invalid product`);
      continue;
    }
    if ((li.productType || product.productType || 'goods') === 'service') continue;
    if (withVariants.has(pid) && !li.variantId) {
      errors.push(
        `Line ${idx + 1}: product "${product.nameEn || product.name}" requires a variant (templates cannot be sold directly)`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export default { assertSellLineVariantBinding };
