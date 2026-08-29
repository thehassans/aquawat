export const PRODUCT_TYPES = ['goods', 'service']
export const DEFAULT_PRODUCT_TYPE = 'goods'

export const PRODUCT_TYPE_LABELS = {
  goods: { en: 'Goods', ar: 'بضاعة' },
  service: { en: 'Service', ar: 'خدمة' },
}

export function normalizeProductType(value) {
  const raw = String(value || '').trim().toLowerCase()
  return PRODUCT_TYPES.includes(raw) ? raw : DEFAULT_PRODUCT_TYPE
}

export function isStockTrackedProductType(value) {
  return normalizeProductType(value) === 'goods'
}

export function formatProductTypeLabel(value, language = 'en') {
  const type = normalizeProductType(value)
  const labels = PRODUCT_TYPE_LABELS[type] || PRODUCT_TYPE_LABELS.goods
  return language === 'ar' ? labels.ar : labels.en
}

export function formatProductTypeBilingual(value) {
  const type = normalizeProductType(value)
  const labels = PRODUCT_TYPE_LABELS[type] || PRODUCT_TYPE_LABELS.goods
  return `${labels.en} / ${labels.ar}`
}

export function lineProductType(line) {
  return normalizeProductType(line?.productType || line?.raw?.productType)
}

export function productTypeOptions(language = 'en') {
  return PRODUCT_TYPES.map((value) => ({
    value,
    label: formatProductTypeLabel(value, language),
    labelEn: PRODUCT_TYPE_LABELS[value].en,
    labelAr: PRODUCT_TYPE_LABELS[value].ar,
  }))
}

export function productPickerLabel(product, language = 'en', { includeType = true } = {}) {
  const name = language === 'ar'
    ? (product?.nameAr || product?.nameEn || product?.name || '')
    : (product?.nameEn || product?.name || product?.nameAr || '')
  const code = product?.sku || product?.productCode || product?.code || ''
  const base = [name, code].filter(Boolean).join(' · ')
  if (!includeType) return base || name
  const type = formatProductTypeLabel(product?.productType, language)
  return base ? `${base} · ${type}` : type
}

export function productDisplayName(product, language = 'en') {
  if (!product) return ''
  if (language === 'ar') return product.nameAr || product.nameEn || product.name || ''
  return product.nameEn || product.name || product.nameAr || ''
}

export function resolveProductSalePrice(product) {
  const raw = product?.sellingPrice ?? product?.price ?? product?.salePrice ?? product?.unitPrice
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function resolveProductPurchasePrice(product) {
  const raw = product?.costPrice ?? product?.cost ?? product?.purchasePrice ?? product?.sellingPrice
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** True when string contains Arabic letters (not just Latin mirrored into an AR field). */
export function hasArabicScript(value) {
  return /[\u0600-\u06FF]/.test(String(value || ''))
}

export function productTypeBadgeClass(value) {
  return normalizeProductType(value) === 'service'
    ? 'bg-sky-50 text-sky-800'
    : 'bg-emerald-50 text-emerald-800'
}
