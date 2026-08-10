// ZATCA (Saudi e-invoicing / Fatoora) — and the wider suite of Saudi-only
// government integrations (ELM/Nafath, Qiwa, GOSI/Mudad, Vision 2030
// branding, Saudi-format VAT returns, Nitaqat/Saudization tracking) — assume
// a Saudi Arabian business transacting in SAR. When a tenant configures a
// non-SAR default currency, none of this Saudi-only logic, UI, or
// compliance requirement should apply; the tenant should behave like a
// plain international business instead.
export const ZATCA_CURRENCY = 'SAR';

export function isZatcaCurrency(tenant) {
  const currency = String(tenant?.settings?.currency || ZATCA_CURRENCY).trim().toUpperCase();
  return currency === ZATCA_CURRENCY;
}

// Generic alias used outside the invoicing/ZATCA flow (government
// integrations, dashboards, jobs, VAT returns, Vision 2030 branding, HR
// Saudization). Same rule as ZATCA today; kept as a distinct name so call
// sites read clearly even though the implementation is identical.
export const isSaudiTenant = isZatcaCurrency;
