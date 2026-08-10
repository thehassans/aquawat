// Saudi-only features (ZATCA e-invoicing, ELM/Nafath, Qiwa, GOSI/Mudad,
// Vision 2030 branding, Saudi-format VAT returns, Nitaqat/Saudization
// tracking) should only apply to tenants configured with SAR as their
// default currency. Everything else should behave like a plain
// international business with none of the Saudi government logic or UI.
export function isSaudiTenant(tenant) {
  return String(tenant?.settings?.currency || 'SAR').trim().toUpperCase() === 'SAR'
}

/** Arabic bilingual form fields (nameAr, legalNameAr, etc.) — SAR tenants only. */
export function showArabicFields(tenant) {
  return isSaudiTenant(tenant)
}
