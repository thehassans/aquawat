// ZATCA (Saudi e-invoicing / Fatoora) is a Saudi-only government requirement
// that assumes SAR-denominated invoices. When a tenant configures a
// non-SAR default currency, all ZATCA-specific behavior (draft/phase-1 QR
// codes, XML generation, hash chaining, clearance/reporting submission)
// should be skipped so the invoice flow behaves like a plain international
// invoice instead of a Saudi tax document.
export const ZATCA_CURRENCY = 'SAR';

export function isZatcaCurrency(tenant) {
  const currency = String(tenant?.settings?.currency || ZATCA_CURRENCY).trim().toUpperCase();
  return currency === ZATCA_CURRENCY;
}
