/**
 * Platform subscription list prices are USD and SAR (set independently — no FX).
 * Stripe charges the tenant's list-price lane. Local Saudi gateways require SAR.
 * usdToSarMajor is only a fallback when an explicit SAR list price is missing.
 */

export const CHECKOUT_CURRENCY = 'USD'
export const SAR_PER_USD = 3.75

export function resolveCheckoutLane(tenant) {
  const currency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase()
  const country = String(tenant?.business?.address?.country || '').trim().toUpperCase()
  if (currency === 'SAR' || country === 'SA' || country === 'SAUDI ARABIA') return 'SAR'
  return 'USD'
}

export function toUsdMajor(amount, fromCurrency = 'USD') {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 0
  const code = String(fromCurrency || 'USD').trim().toUpperCase()
  if (code === 'USD') return Math.round(n * 100) / 100
  if (code === 'SAR') return Math.round((n / SAR_PER_USD) * 100) / 100
  // Unknown → treat as already USD-major to avoid undercharging
  return Math.round(n * 100) / 100
}

export function usdToSarMajor(usdAmount) {
  const n = Number(usdAmount)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * SAR_PER_USD * 100) / 100
}

/** Gateways that expect SAR rather than USD. */
export function gatewayNeedsSar(paymentMethod) {
  const m = String(paymentMethod || '').toLowerCase()
  return ['creditcard', 'applepay', 'moyasar', 'tabby', 'tamara', 'stcpay'].includes(m)
}
