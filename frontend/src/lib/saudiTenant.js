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

export function isBangladeshTenant(tenant) {
  return getTenantCurrency(tenant) === 'BDT'
}

export function isPakistanTenant(tenant) {
  return getTenantCurrency(tenant) === 'PKR'
}

/**
 * Which government tax suite applies for this tenant:
 *   'saudi' | 'bangladesh' | null
 */
export function getTaxRegion(tenant) {
  const currency = getTenantCurrency(tenant)
  if (currency === 'SAR') return 'saudi'
  if (currency === 'BDT') return 'bangladesh'
  return null
}
