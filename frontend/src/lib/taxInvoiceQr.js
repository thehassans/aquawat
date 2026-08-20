import { generateZatcaQrValue } from './zatcaQr'
import { generateFbrQrValue } from './fbrQr'
import { generateNbrQrValue } from './nbrQr'
import { toNumber } from './invoiceDocument'

/**
 * Regional tax QR for printed invoices: ZATCA (SAR), FBR (PKR), NBR (BDT).
 */
export function resolveTaxInvoiceQr({
  invoice,
  tenant,
  currency,
  sellerName,
  vatNumber,
}) {
  const cur = String(currency || invoice?.currency || tenant?.settings?.currency || 'SAR').toUpperCase()
  const name = sellerName || invoice?.seller?.name || tenant?.business?.legalNameEn || tenant?.name || ''
  const vat = vatNumber || invoice?.seller?.vatNumber || tenant?.business?.vatNumber || ''
  const timestamp = invoice?.issueDate || new Date().toISOString()
  const total = toNumber(invoice?.grandTotal)
  const tax = toNumber(invoice?.totalTax)

  try {
    if (cur === 'SAR') {
      return invoice?.zatca?.qrCodeData || generateZatcaQrValue({
        sellerName: name,
        vatNumber: vat,
        timestamp,
        totalWithVat: total,
        vatTotal: tax,
      })
    }
    const isPk = cur === 'PKR' || (tenant?.business?.address?.country || '').toUpperCase() === 'PK' || (tenant?.business?.address?.country || '').toUpperCase() === 'PAKISTAN'
    if (isPk && tenant?.fbr?.autoGenerateQr !== false) {
      return invoice?.fbr?.qrCode || generateFbrQrValue({
        sellerName: name,
        ntn: tenant?.fbr?.ntn || tenant?.business?.ntn || vat,
        strn: tenant?.fbr?.strn || tenant?.business?.strn || '',
        invoiceNumber: invoice?.invoiceNumber,
        fbrInvoiceNo: invoice?.fbr?.fbrInvoiceNo || invoice?.fbrReference || '',
        timestamp,
        totalWithTax: total,
        salesTax: tax,
      })
    }
    if (cur === 'BDT' && tenant?.nbr?.autoGenerateQr !== false) {
      return generateNbrQrValue({
        sellerName: name,
        binNumber: tenant?.nbr?.binNumber || vat,
        invoiceNumber: invoice?.invoiceNumber,
        timestamp,
        totalWithVat: total,
        vatTotal: tax,
        mushakForm: tenant?.nbr?.mushakForm || '6.3',
      })
    }
  } catch {
    return null
  }
  return null
}
