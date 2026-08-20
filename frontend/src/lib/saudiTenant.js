// Regional tenant helpers driven by Settings → Default Currency / country.

import { isGccArabicMarket } from './invoiceLanguage'

export function getTenantCurrency(tenant) {
  return String(tenant?.settings?.currency || 'SAR').trim().toUpperCase()
}

export function isSaudiTenant(tenant) {
  return getTenantCurrency(tenant) === 'SAR'
}

/** Arabic bilingual form fields — GCC markets only (SAR/AED/QAR/KWD/BHD/OMR). */
export function showArabicFields(tenant) {
  return isGccArabicMarket(tenant)
}

/**
 * Arabic UI language switcher (header / settings / login).
 * Same GCC Middle East set as invoice Arabic — Pakistan, Bangladesh, etc. stay English-only.
 */
export function showArabicUi(tenant) {
  return isGccArabicMarket(tenant)
}

export function isBangladeshTenant(tenant) {
  return getTenantCurrency(tenant) === 'BDT'
}

export function isPakistanTenant(tenant) {
  const curr = getTenantCurrency(tenant)
  const country = String(tenant?.business?.address?.country || tenant?.country || '').trim().toUpperCase()
  return curr === 'PKR' || country === 'PK' || country === 'PAKISTAN'
}

export function getTaxLabel(tenant, currency) {
  const cur = String(currency || getTenantCurrency(tenant)).toUpperCase()
  if (cur === 'PKR' || isPakistanTenant(tenant)) return 'GST'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return 'Mushak (VAT)'
  return 'VAT'
}

export function getTaxIdLabel(tenant, currency) {
  const cur = String(currency || getTenantCurrency(tenant)).toUpperCase()
  if (cur === 'PKR' || isPakistanTenant(tenant)) return 'STRN / NTN'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return 'BIN'
  return 'VAT Number'
}

/**
 * Which government tax suite applies for this tenant:
 *   'saudi' | 'bangladesh' | 'pakistan' | null
 */
export function getTaxRegion(tenant) {
  const currency = getTenantCurrency(tenant)
  if (currency === 'SAR') return 'saudi'
  if (currency === 'BDT') return 'bangladesh'
  if (currency === 'PKR' || isPakistanTenant(tenant)) return 'pakistan'
  return null
}
