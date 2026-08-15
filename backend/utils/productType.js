export const PRODUCT_TYPES = ['goods', 'service'];
export const DEFAULT_PRODUCT_TYPE = 'goods';

export function normalizeProductType(value) {
  const raw = String(value || '').trim().toLowerCase();
  return PRODUCT_TYPES.includes(raw) ? raw : DEFAULT_PRODUCT_TYPE;
}

export function isStockTrackedProductType(value) {
  return normalizeProductType(value) === 'goods';
}

export function formatProductTypeLabel(value, language = 'en') {
  const type = normalizeProductType(value);
  if (language === 'ar') {
    return type === 'service' ? 'خدمة' : 'بضاعة';
  }
  return type === 'service' ? 'Service' : 'Goods';
}

export function formatProductTypeBilingual(value) {
  const type = normalizeProductType(value);
  return type === 'service' ? 'Service / خدمة' : 'Goods / بضاعة';
}

export function stampLineProductTypes(lineItems, productById) {
  const catalog = productById instanceof Map ? productById : new Map();
  return (Array.isArray(lineItems) ? lineItems : []).map((line) => {
    if (!line || typeof line !== 'object') return line;
    const product = line.productId ? catalog.get(String(line.productId)) : null;
    return {
      ...line,
      productType: normalizeProductType(line.productType || product?.productType),
    };
  });
}
