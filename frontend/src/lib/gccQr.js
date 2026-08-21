/**
 * Generates structured verification QR code string for GCC regional tax compliance
 * (UAE FTA, Oman OTA, Bahrain NBR, Kuwait MOF, Qatar GTA).
 */
export function generateGccQrValue({
  authority = 'FTA',
  countryCode = 'AE',
  sellerName = '',
  taxId = '',
  invoiceNumber = '',
  timestamp = '',
  grandTotal = 0,
  totalTax = 0,
  currency = 'AED',
}) {
  return JSON.stringify({
    v: 1,
    gov: authority,
    cc: countryCode,
    seller: String(sellerName || '').trim(),
    taxId: String(taxId || '').trim(),
    inv: String(invoiceNumber || '').trim(),
    ts: timestamp || new Date().toISOString(),
    total: Number(Number(grandTotal || 0).toFixed(2)),
    tax: Number(Number(totalTax || 0).toFixed(2)),
    cur: currency,
  });
}
