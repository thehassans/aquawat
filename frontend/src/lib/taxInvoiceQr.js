import { generateZatcaQrValue, verifyQrIntegrity } from './zatcaQr'
import { generateFbrQrValue } from './fbrQr'
import { generateNbrQrValue } from './nbrQr'
import { generateGccQrValue } from './gccQr'
import { toNumber } from './invoiceDocument'

/**
 * Regional tax QR for printed invoices:
 * - Saudi Arabia: ZATCA TLV QR (SAR)
 * - UAE: FTA Verification QR (AED)
 * - Oman: OTA Verification QR (OMR)
 * - Bahrain: NBR Verification QR (BHD)
 * - Kuwait: MOF Verification QR (KWD)
 * - Qatar: GTA Dhareeba QR (QAR)
 * - Pakistan: FBR Digital Tax QR (PKR)
 * - Bangladesh: NBR Mushak 6.3 QR (BDT)
 */
export function resolveTaxInvoiceQr({
  invoice,
  tenant,
  currency,
  sellerName,
  vatNumber,
}) {
  if (['cancelled'].includes(String(invoice?.status || '').toLowerCase())) {
    return null
  }
  const cur = String(currency || invoice?.currency || tenant?.settings?.currency || 'SAR').toUpperCase()
  const name = sellerName || invoice?.seller?.name || tenant?.business?.legalNameEn || tenant?.name || ''
  const vat = vatNumber || invoice?.seller?.vatNumber || tenant?.business?.vatNumber || ''
  const timestamp = invoice?.issueDate || new Date().toISOString()
  const total = toNumber(invoice?.grandTotal)
  const tax = toNumber(invoice?.totalTax)
  const invoiceNumber = invoice?.invoiceNumber || ''

  try {
    if (cur === 'SAR') {
      const generated = generateZatcaQrValue({
        sellerName: name,
        vatNumber: vat,
        timestamp,
        issueTime: invoice?.issueTime,
        totalWithVat: total,
        vatTotal: tax,
      })
      if (generated) return generated
      // Only reuse a stored payload if it still verifies (never show empty-TRN QRs).
      const stored = invoice?.zatca?.qrCodeData
      if (stored && verifyQrIntegrity(stored).valid) return stored
      return null
    }

    if (cur === 'AED') {
      return invoice?.countryCompliance?.qrCode || generateGccQrValue({
        authority: 'FTA',
        countryCode: 'AE',
        sellerName: name,
        taxId: tenant?.fta?.trn || vat,
        invoiceNumber,
        timestamp,
        grandTotal: total,
        totalTax: tax,
        currency: 'AED',
      })
    }

    if (cur === 'OMR') {
      return invoice?.countryCompliance?.qrCode || generateGccQrValue({
        authority: 'OTA',
        countryCode: 'OM',
        sellerName: name,
        taxId: tenant?.ota?.tin || vat,
        invoiceNumber,
        timestamp,
        grandTotal: total,
        totalTax: tax,
        currency: 'OMR',
      })
    }

    if (cur === 'BHD') {
      return invoice?.countryCompliance?.qrCode || generateGccQrValue({
        authority: 'NBR',
        countryCode: 'BH',
        sellerName: name,
        taxId: tenant?.bahrainNbr?.vatAccountNumber || vat,
        invoiceNumber,
        timestamp,
        grandTotal: total,
        totalTax: tax,
        currency: 'BHD',
      })
    }

    if (cur === 'KWD') {
      return invoice?.countryCompliance?.qrCode || generateGccQrValue({
        authority: 'MOF',
        countryCode: 'KW',
        sellerName: name,
        taxId: tenant?.mofKuwait?.civilId || tenant?.mofKuwait?.taxCardNumber || vat,
        invoiceNumber,
        timestamp,
        grandTotal: total,
        totalTax: tax,
        currency: 'KWD',
      })
    }

    if (cur === 'QAR') {
      return invoice?.countryCompliance?.qrCode || generateGccQrValue({
        authority: 'GTA',
        countryCode: 'QA',
        sellerName: name,
        taxId: tenant?.gtaQatar?.tin || vat,
        invoiceNumber,
        timestamp,
        grandTotal: total,
        totalTax: tax,
        currency: 'QAR',
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
