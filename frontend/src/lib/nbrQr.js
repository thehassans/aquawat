/**
 * Bangladesh NBR / Mushak receipt verification payload.
 * Encodes seller BIN, invoice totals and timestamp for QR display on
 * thermal receipts (analogue of ZATCA Phase-1 TLV QR for Saudi).
 */
export function generateNbrQrValue({
  sellerName,
  binNumber,
  invoiceNumber,
  timestamp,
  totalWithVat,
  vatTotal,
  mushakForm = '6.3',
}) {
  const payload = {
    v: 1,
    authority: 'NBR',
    form: String(mushakForm || '6.3'),
    seller: String(sellerName || '').trim(),
    bin: String(binNumber || '').trim(),
    inv: String(invoiceNumber || '').trim(),
    ts: timestamp || new Date().toISOString(),
    total: Number(Number(totalWithVat || 0).toFixed(2)),
    vat: Number(Number(vatTotal || 0).toFixed(2)),
    currency: 'BDT',
  }
  return JSON.stringify(payload)
}
