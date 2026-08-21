// Regional tenant helpers driven by Settings → Default Currency / country.

import { isGccArabicMarket } from './invoiceLanguage'

export function getTenantCurrency(tenant) {
  return String(tenant?.settings?.currency || tenant?.currency || 'SAR').trim().toUpperCase()
}

export function getTenantCountryCode(tenant) {
  return String(tenant?.business?.address?.country || tenant?.country || '').trim().toUpperCase()
}

export function isSaudiTenant(tenant) {
  return getTenantCurrency(tenant) === 'SAR' || getTenantCountryCode(tenant) === 'SA'
}

export function isUaeTenant(tenant) {
  const cur = getTenantCurrency(tenant)
  const cc = getTenantCountryCode(tenant)
  return cur === 'AED' || cc === 'AE' || cc === 'ARE' || cc === 'UAE'
}

export function isOmanTenant(tenant) {
  const cur = getTenantCurrency(tenant)
  const cc = getTenantCountryCode(tenant)
  return cur === 'OMR' || cc === 'OM' || cc === 'OMN' || cc === 'OMAN'
}

export function isBahrainTenant(tenant) {
  const cur = getTenantCurrency(tenant)
  const cc = getTenantCountryCode(tenant)
  return cur === 'BHD' || cc === 'BH' || cc === 'BHR' || cc === 'BAHRAIN'
}

export function isKuwaitTenant(tenant) {
  const cur = getTenantCurrency(tenant)
  const cc = getTenantCountryCode(tenant)
  return cur === 'KWD' || cc === 'KW' || cc === 'KWT' || cc === 'KUWAIT'
}

export function isQatarTenant(tenant) {
  const cur = getTenantCurrency(tenant)
  const cc = getTenantCountryCode(tenant)
  return cur === 'QAR' || cc === 'QA' || cc === 'QAT' || cc === 'QATAR'
}

export function isGccTenant(tenant) {
  return isSaudiTenant(tenant) || isUaeTenant(tenant) || isOmanTenant(tenant) || isBahrainTenant(tenant) || isKuwaitTenant(tenant) || isQatarTenant(tenant)
}

/** Arabic bilingual form fields — GCC markets only (SAR/AED/QAR/KWD/BHD/OMR). */
export function showArabicFields(tenant) {
  return isGccArabicMarket(tenant) || isGccTenant(tenant)
}

/**
 * Arabic UI language switcher (header / settings / login).
 * Same GCC Middle East set as invoice Arabic — Pakistan, Bangladesh, etc. stay English-only.
 */
export function showArabicUi(tenant) {
  return isGccArabicMarket(tenant) || isGccTenant(tenant)
}

export function isBangladeshTenant(tenant) {
  const cur = getTenantCurrency(tenant)
  const cc = getTenantCountryCode(tenant)
  return cur === 'BDT' || cc === 'BD' || cc === 'BGD'
}

export function isPakistanTenant(tenant) {
  const curr = getTenantCurrency(tenant)
  const country = getTenantCountryCode(tenant)
  return curr === 'PKR' || country === 'PK' || country === 'PAK' || country === 'PAKISTAN'
}

export function getTaxLabel(tenant, currency) {
  const cur = String(currency || getTenantCurrency(tenant)).toUpperCase()
  if (cur === 'PKR' || isPakistanTenant(tenant)) return 'GST (Sales Tax)'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return 'Mushak (VAT)'
  if (cur === 'AED' || isUaeTenant(tenant)) return 'VAT (5%)'
  if (cur === 'OMR' || isOmanTenant(tenant)) return 'VAT (5%)'
  if (cur === 'BHD' || isBahrainTenant(tenant)) return 'VAT (10%)'
  if (cur === 'KWD' || isKuwaitTenant(tenant)) return 'Tax / Retention'
  if (cur === 'QAR' || isQatarTenant(tenant)) return 'Tax'
  return 'VAT (15%)'
}

export function getTaxIdLabel(tenant, currency, isAr = false) {
  const cur = String(currency || getTenantCurrency(tenant)).toUpperCase()
  if (cur === 'PKR' || isPakistanTenant(tenant)) return 'NTN / STRN'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return 'BIN (Mushak)'
  if (cur === 'AED' || isUaeTenant(tenant)) return isAr ? 'الرقم الضريبي (TRN)' : 'TRN (Tax Reg No)'
  if (cur === 'OMR' || isOmanTenant(tenant)) return isAr ? 'رقم التعريف الضريبي (TIN)' : 'TIN (Tax ID)'
  if (cur === 'BHD' || isBahrainTenant(tenant)) return isAr ? 'رقم الحساب الضريبي' : 'VAT Account No'
  if (cur === 'KWD' || isKuwaitTenant(tenant)) return isAr ? 'الرقم المدني / البطاقة الضريبية' : 'Civil ID / Tax Card'
  if (cur === 'QAR' || isQatarTenant(tenant)) return isAr ? 'رقم التعريف الضريبي (TIN)' : 'TIN (Tax ID)'
  return isAr ? 'الرقم الضريبي' : 'VAT Number'
}

export function getTaxAuthorityName(tenant) {
  const cur = getTenantCurrency(tenant)
  if (cur === 'SAR' || isSaudiTenant(tenant)) return 'ZATCA'
  if (cur === 'AED' || isUaeTenant(tenant)) return 'FTA'
  if (cur === 'OMR' || isOmanTenant(tenant)) return 'OTA'
  if (cur === 'BHD' || isBahrainTenant(tenant)) return 'NBR'
  if (cur === 'KWD' || isKuwaitTenant(tenant)) return 'MOF'
  if (cur === 'QAR' || isQatarTenant(tenant)) return 'GTA'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return 'NBR'
  if (cur === 'PKR' || isPakistanTenant(tenant)) return 'FBR'
  return 'Tax Authority'
}

export function getTaxQrLabel(tenant, currency, isAr = false) {
  const cur = String(currency || getTenantCurrency(tenant)).toUpperCase()
  if (cur === 'SAR' || isSaudiTenant(tenant)) return isAr ? 'رمز QR معتمد من زاتكا' : 'ZATCA Compliant QR'
  if (cur === 'AED' || isUaeTenant(tenant)) return isAr ? 'رمز الفوترة الإلكترونية FTA' : 'FTA E-Invoicing QR'
  if (cur === 'OMR' || isOmanTenant(tenant)) return isAr ? 'رمز الفوترة الإلكترونية OTA' : 'OTA E-Invoicing QR'
  if (cur === 'BHD' || isBahrainTenant(tenant)) return isAr ? 'رمز الفاتورة الضريبية NBR' : 'NBR Tax Invoice QR'
  if (cur === 'KWD' || isKuwaitTenant(tenant)) return isAr ? 'رمز التحقق الضريبي MOF' : 'MOF Tax Verification QR'
  if (cur === 'QAR' || isQatarTenant(tenant)) return isAr ? 'رمز ضريبة قطر (ضريبة)' : 'GTA Dhareeba QR'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return isAr ? 'رمز موشاك الضريبي NBR' : 'NBR Mushak 6.3 QR'
  if (cur === 'PKR' || isPakistanTenant(tenant)) return isAr ? 'رمز الفاتورة الرقمية FBR' : 'FBR Digital Invoice QR'
  return isAr ? 'رمز التحقق الضريبي' : 'Tax Verification QR'
}

/**
 * Which government tax suite applies for this tenant:
 *   'saudi' | 'uae' | 'oman' | 'bahrain' | 'kuwait' | 'qatar' | 'bangladesh' | 'pakistan' | null
 */
export function getTaxRegion(tenant) {
  const currency = getTenantCurrency(tenant)
  if (currency === 'SAR' || isSaudiTenant(tenant)) return 'saudi'
  if (currency === 'AED' || isUaeTenant(tenant)) return 'uae'
  if (currency === 'OMR' || isOmanTenant(tenant)) return 'oman'
  if (currency === 'BHD' || isBahrainTenant(tenant)) return 'bahrain'
  if (currency === 'KWD' || isKuwaitTenant(tenant)) return 'kuwait'
  if (currency === 'QAR' || isQatarTenant(tenant)) return 'qatar'
  if (currency === 'BDT' || isBangladeshTenant(tenant)) return 'bangladesh'
  if (currency === 'PKR' || isPakistanTenant(tenant)) return 'pakistan'
  return null
}
