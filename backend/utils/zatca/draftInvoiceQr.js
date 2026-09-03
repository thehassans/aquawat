import ZatcaService from './ZatcaService.js'
import { formatZatcaQrTimestamp } from '../zatcaTimestamp.js'

const qrService = new ZatcaService()

/** Saudi VAT / TRN: exactly 15 digits, first and last must be 3 (ZATCA). */
export const isValidSaudiVatNumber = (vatNumber) => /^3\d{13}3$/.test(String(vatNumber || '').trim())

export async function buildDraftInvoiceQr({ seller, issueDate, issueTime, grandTotal, totalTax }) {
  const sellerName = seller?.legalNameAr || seller?.legalNameEn || seller?.nameAr || seller?.name || ''
  const vatNumber = String(seller?.vatNumber || '').trim()
  const timestamp = formatZatcaQrTimestamp(issueDate, issueTime)
  const totalWithVat = Number(grandTotal || 0).toFixed(2)
  const vatTotal = Number(totalTax || 0).toFixed(2)

  // Never emit a scannable QR with an empty/invalid TRN — ZATCA app rejects it
  // with "TRN must consist of 15 digits, where the first and last digits are [3]".
  if (!sellerName || !isValidSaudiVatNumber(vatNumber)) {
    return {
      qrCodeData: undefined,
      qrCodeImage: undefined,
      submissionStatus: 'pending',
      qrBlockedReason: !isValidSaudiVatNumber(vatNumber)
        ? 'missing_or_invalid_vat'
        : 'missing_seller_name',
    }
  }

  const qrCodeData = qrService.generateTLV({
    sellerName,
    vatNumber,
    timestamp,
    totalWithVat,
    vatTotal,
  })

  const qrCodeImage = await qrService.generateQRCode(qrCodeData)

  return {
    qrCodeData,
    qrCodeImage,
    submissionStatus: 'pending',
  }
}
