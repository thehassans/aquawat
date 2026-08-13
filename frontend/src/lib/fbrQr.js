/**
 * Pakistan FBR Digital Invoicing QR payload for receipts and PDFs.
 */
export function generateFbrQrValue({
  sellerName,
  ntn,
  strn,
  invoiceNumber,
  fbrInvoiceNo,
  timestamp,
  totalWithTax,
  salesTax,
}) {
  return JSON.stringify({
    v: 1,
    authority: 'FBR',
    seller: String(sellerName || '').trim(),
    ntn: String(ntn || '').trim(),
    strn: String(strn || '').trim(),
    inv: String(invoiceNumber || '').trim(),
    fbr: String(fbrInvoiceNo || '').trim(),
    ts: timestamp || new Date().toISOString(),
    total: Number(Number(totalWithTax || 0).toFixed(2)),
    st: Number(Number(salesTax || 0).toFixed(2)),
    currency: 'PKR',
  })
}
