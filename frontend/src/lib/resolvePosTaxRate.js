/** Sales-side VAT for POS and quotations — prefers saleTaxRate over legacy taxRate. */
export function resolvePosTaxRate(product, tenant) {
  if (typeof product?.saleTaxRate === 'number') return product.saleTaxRate;
  if (typeof product?.taxRate === 'number') return product.taxRate;
  const tenantRate = tenant?.settings?.taxRate;
  return typeof tenantRate === 'number' ? tenantRate : 15;
}

export function posCartLineKey(item) {
  const productId = item?.productId || item?._id || '';
  const variantId = item?.variantId || '';
  return `${productId}:${variantId}`;
}

export function cartItemsMatch(a, b) {
  return posCartLineKey(a) === posCartLineKey(b);
}
