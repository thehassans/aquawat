import { formatCurrency, formatCurrencyAmount, CURRENCY_CODE } from './currency'
import { formatLocationLabel } from '../pages/inventory/receipts/locationLabel'

/** Round financial values to 2 dp and format as currency (default SAR / en-SA). */
export function formatReportMoney(value, { currency = CURRENCY_CODE, locale = 'en-SA' } = {}) {
  const n = Number(value)
  const safe = Number.isFinite(n) ? n : 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: String(currency || CURRENCY_CODE).toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe)
  } catch {
    return formatCurrency(safe, { currency })
  }
}

/** Plain 2-dp numeric string for CSV exports (no currency symbol). */
export function formatReportMoneyCsv(value) {
  return formatCurrencyAmount(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Inventory turns — 2 decimal places. */
export function formatTurns(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Days Sales of Inventory — nearest whole integer. */
export function formatDsi(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

/** Qty display — up to 4 decimals, trim trailing zeros. */
export function formatReportQty(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/**
 * Product / variant display label for reports.
 * Prefer explicit variantName; otherwise "Template - Variant".
 */
export function formatReportProduct(row, { ar = false, idFallback = true } = {}) {
  if (!row) return idFallback ? '[Unknown product]' : '—'

  if (row.productName) return String(row.productName)
  if (row.displayName) return String(row.displayName)

  const product = row.product
  const variant = row.variant
  const base = ar
    ? (product?.nameAr || product?.nameEn || row.nameAr || row.nameEn)
    : (product?.nameEn || product?.nameAr || row.nameEn || row.nameAr)
  const variantName = variant?.name || row.variantName
  const sku = variant?.sku || product?.sku || row.sku

  if (base && variantName) return `${base} - ${variantName}`
  if (variantName) return variantName
  if (base) return base
  if (sku) return String(sku)

  if (!idFallback) return '—'
  const id = row.productId?._id || row.productId || row.variantId?._id || row.variantId
  return id
    ? `[Unknown/Deleted Product: ID ${id}]`
    : '[Unknown/Deleted Product]'
}

/** Clean location breadcrumb for report FROM/TO columns. */
export function formatReportLocation(locOrPath, fallback = '—') {
  if (!locOrPath) return fallback
  if (typeof locOrPath === 'string') return formatLocationLabel(locOrPath, fallback)
  return formatLocationLabel(locOrPath.completePath, locOrPath.name || fallback)
}

export { formatLocationLabel }
