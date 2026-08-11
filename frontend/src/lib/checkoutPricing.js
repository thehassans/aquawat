/**
 * Platform SaaS checkout is priced and charged in USD.
 * Catalog amounts from website CMS may be in another currency (historically SAR);
 * convert to USD with pegged / mid-market reference rates (units of currency per 1 USD).
 * Stripe Adaptive Pricing then presents the customer's local currency at pay time.
 */

export const CHECKOUT_CURRENCY = 'USD'

/** How many units of `code` equal 1 USD (approx.). SAR is the official SAMA peg. */
const UNITS_PER_USD = {
  USD: 1,
  SAR: 3.75,
  AED: 3.6725,
  QAR: 3.64,
  BHD: 0.376,
  KWD: 0.307,
  OMR: 0.3845,
  EUR: 0.92,
  GBP: 0.79,
  PKR: 278,
  BDT: 110,
  INR: 83,
  EGP: 49,
  TRY: 32,
  JOD: 0.71,
}

export function convertToUsd(amount, fromCurrency = 'USD') {
  const n = Number(amount)
  if (!Number.isFinite(n) || n === 0) return 0
  const code = String(fromCurrency || 'USD').trim().toUpperCase()
  const units = UNITS_PER_USD[code]
  if (!units || units <= 0) return Math.round(n * 100) / 100
  if (code === 'USD') return Math.round(n * 100) / 100
  return Math.round((n / units) * 100) / 100
}

/** ZATCA Phase 2 addon list prices (SAR) → converted to USD for checkout. */
export const ZATCA_ADDON_SAR = { monthly: 50, yearly: 400 }

export function zatcaAddonUsd(billingCycle = 'monthly') {
  const sar = billingCycle === 'yearly' ? ZATCA_ADDON_SAR.yearly : ZATCA_ADDON_SAR.monthly
  return convertToUsd(sar, 'SAR')
}

export function isZatcaFeatureText(text = '') {
  return /zatca|زكاة|فاتورة المرحلة|gosi\/wps/i.test(String(text))
}
