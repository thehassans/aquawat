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

export function getGovSectionTitle(tenant, language = 'en') {
  const isAr = language === 'ar'
  const cur = getTenantCurrency(tenant)
  if (cur === 'SAR' || isSaudiTenant(tenant)) return isAr ? 'الربط الحكومي زاتكا' : 'Saudi Government & ZATCA'
  if (cur === 'AED' || isUaeTenant(tenant)) return isAr ? 'الامتثال الضريبي FTA' : 'UAE FTA Compliance'
  if (cur === 'OMR' || isOmanTenant(tenant)) return isAr ? 'الامتثال الضريبي OTA' : 'Oman OTA Compliance'
  if (cur === 'BHD' || isBahrainTenant(tenant)) return isAr ? 'الامتثال الضريبي NBR' : 'Bahrain NBR Compliance'
  if (cur === 'KWD' || isKuwaitTenant(tenant)) return isAr ? 'الامتثال الضريبي MOF' : 'Kuwait MOF Compliance'
  if (cur === 'QAR' || isQatarTenant(tenant)) return isAr ? 'الامتثال الضريبي (ضريبة)' : 'Qatar GTA Dhareeba'
  if (cur === 'PKR' || isPakistanTenant(tenant)) return isAr ? 'الضرائب والفوترة FBR' : 'FBR Digital Invoicing'
  if (cur === 'BDT' || isBangladeshTenant(tenant)) return isAr ? 'الضرائب NBR / Mushak' : 'NBR / Mushak Portal'
  return isAr ? 'الامتثال الضريبي والفوترة' : 'Government & Compliance'
}

export function getGovChildren(tenant, language = 'en') {
  const isAr = language === 'ar'
  const cur = getTenantCurrency(tenant)
  const installedApps = tenant?.settings?.installedApps || {}
  const si = tenant?.settings?.saudiIntegrations || {}
  const business = tenant?.business || {}
  const isZatcaPhase1 = (tenant?.zatca?.phase || 1) === 1
  const isZatcaPhase1Ready = isZatcaPhase1 && !!business.vatNumber && !!(business.legalNameEn || business.legalNameAr) && !!(business.address?.city && business.address?.country)
  const isAppValid = (appId) => Boolean(installedApps[appId]?.isInstalled && installedApps[appId]?.isEnabled !== false)

  const hasZatca = (cur === 'SAR' || isSaudiTenant(tenant)) && (si.zatcaConnectionStatus === 'connected' || tenant?.zatca?.isOnboarded || isZatcaPhase1Ready || isAppValid('zatca_phase2_pro'))
  const hasElm = (cur === 'SAR' || isSaudiTenant(tenant)) && (si.elmConnectionStatus === 'connected' || isAppValid('elm_identity_pro'))
  const hasQiwa = (cur === 'SAR' || isSaudiTenant(tenant)) && (si.qiwaConnectionStatus === 'connected' || isAppValid('qiwa_hr_integration'))
  const hasGosi = (cur === 'SAR' || isSaudiTenant(tenant)) && (si.gosiConnectionStatus === 'connected' || isAppValid('gosi_mudad_compliance'))

  const govChildren = []

  if (cur === 'SAR' || isSaudiTenant(tenant)) {
    if (hasZatca) {
      govChildren.push({
        path: '/app/dashboard/tenant-settings/government-integrations/zatca',
        label: isAr ? `بوابة زاتكا ${isZatcaPhase1 ? '(المرحلة 1)' : ''}` : `ZATCA${isZatcaPhase1 ? ' Phase 1' : ''} Portal`,
      })
    }
    if (hasElm) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/elm', label: isAr ? 'بوابة علم / يقين' : 'Elm Portal' })
    if (hasQiwa) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/qiwa', label: isAr ? 'بوابة قوى' : 'Qiwa Portal' })
    if (hasGosi) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/gosi', label: isAr ? 'بوابة التأمينات / مدد' : 'GOSI/Mudad Portal' })
    if (isAppValid('balady_municipal')) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/balady', label: isAr ? 'بوابة بلدي' : 'Balady Portal' })
    if (isAppValid('saber_conformity')) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/saber', label: isAr ? 'بوابة سابر (SASO)' : 'Saber Portal (SASO)' })
    if (isAppValid('etimad_procurement')) govChildren.push({ path: '/app/dashboard/tenant-settings/government-integrations/etimad', label: isAr ? 'بوابة اعتماد' : 'Etimad Portal' })
  } else if (cur === 'AED' || isUaeTenant(tenant) || isAppValid('uae_fta_compliance')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/government-integrations',
      label: isAr ? 'بوابة الضرائب (FTA الإمارات)' : 'UAE FTA & EmaraTax',
    })
  } else if (cur === 'OMR' || isOmanTenant(tenant) || isAppValid('oman_ota_compliance')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/government-integrations',
      label: isAr ? 'بوابة الضرائب (OTA عمان)' : 'Oman OTA Tax Portal',
    })
  } else if (cur === 'BHD' || isBahrainTenant(tenant) || isAppValid('bahrain_nbr_compliance')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/government-integrations',
      label: isAr ? 'بوابة الضرائب (NBR البحرين)' : 'Bahrain NBR Tax Portal',
    })
  } else if (cur === 'KWD' || isKuwaitTenant(tenant) || isAppValid('kuwait_mof_compliance')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/government-integrations',
      label: isAr ? 'بوابة الضرائب (MOF الكويت)' : 'Kuwait MOF Tax Portal',
    })
  } else if (cur === 'QAR' || isQatarTenant(tenant) || isAppValid('qatar_dhareeba_compliance')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/government-integrations',
      label: isAr ? 'بوابة ضريبة (GTA قطر)' : 'Qatar GTA Dhareeba',
    })
  } else if (cur === 'PKR' || isPakistanTenant(tenant) || isAppValid('pakistan_fbr_einvoicing')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/fbr-dashboard',
      label: isAr ? 'بوابة الفوترة الرقمية FBR' : 'FBR Digital Invoicing',
    })
  } else if (cur === 'BDT' || isBangladeshTenant(tenant) || isAppValid('bangladesh_nbr_einvoicing')) {
    govChildren.push({
      path: '/app/dashboard/tenant-settings/nbr-dashboard',
      label: isAr ? 'بوابة NBR / Mushak' : 'NBR / Mushak Portal',
    })
  }

  return govChildren
}
