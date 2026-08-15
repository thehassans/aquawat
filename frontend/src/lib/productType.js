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

export function productPickerLabel(product, language = 'en') {
  const name = language === 'ar'
    ? (product?.nameAr || product?.nameEn || product?.name || '')
    : (product?.nameEn || product?.name || product?.nameAr || '')
  const type = formatProductTypeLabel(product?.productType, language)
  return name ? `${name} · ${type}` : type
}

export function productTypeBadgeClass(value) {
  return normalizeProductType(value) === 'service'
    ? 'bg-sky-50 text-sky-800'
    : 'bg-emerald-50 text-emerald-800'
}
