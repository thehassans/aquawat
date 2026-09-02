/** Shared status helpers for accounting documents (invoices, credit notes, payments). */

export const INVOICE_STATUS_STEPS = [
  { id: 'draft', en: 'Draft', ar: 'مسودة' },
  { id: 'posted', en: 'Posted', ar: 'مرحّلة' },
  { id: 'paid', en: 'Paid', ar: 'مدفوعة' },
]

export const PAYMENT_STATUS_STEPS = [
  { id: 'draft', en: 'Draft', ar: 'مسودة' },
  { id: 'posted', en: 'Posted', ar: 'مرحّلة' },
]

export const CREDIT_NOTE_STATUS_STEPS = [
  { id: 'draft', en: 'Draft', ar: 'مسودة' },
  { id: 'posted', en: 'Posted', ar: 'مرحّلة' },
  { id: 'reversed', en: 'Reversed', ar: 'معكوس' },
]

export const BILL_STATUS_STEPS = INVOICE_STATUS_STEPS
export const VENDOR_REFUND_STATUS_STEPS = CREDIT_NOTE_STATUS_STEPS

export function isVendorBill(invoice = {}) {
  return String(invoice?.flow || '') === 'purchase' && String(invoice?.invoiceType || '388') === '388'
}

export function isVendorRefund(invoice = {}) {
  return String(invoice?.flow || '') === 'purchase' && String(invoice?.invoiceType || '') === '381'
}

export function isCustomerCreditNote(invoice = {}) {
  return String(invoice?.flow || 'sell') !== 'purchase' && String(invoice?.invoiceType || '') === '381'
}

export function resolveInvoiceRibbonStep(invoice = {}) {
  const docStatus = String(invoice?.status || 'draft').toLowerCase()
  const payStatus = String(invoice?.paymentStatus || '').toLowerCase()
  const isCreditNote = String(invoice?.invoiceType || '') === '381'
  const isPurchase = String(invoice?.flow || '') === 'purchase'

  if (['cancelled', 'credited'].includes(docStatus)) return 'cancelled'
  if (isCreditNote && ['issued', 'approved', 'paid', 'sent'].includes(docStatus)) return 'reversed'
  if (payStatus === 'paid' || docStatus === 'paid') return 'paid'
  if (['issued', 'approved', 'sent'].includes(docStatus)) return 'posted'
  if (!isPurchase && invoice?.zatca?.signedXml) return 'posted'
  return 'draft'
}

export function resolvePaymentRibbonStep(payment = {}) {
  const status = String(payment?.status || 'approved').toLowerCase()
  if (status === 'draft') return 'draft'
  if (status === 'cancelled') return 'cancelled'
  return 'posted'
}

export function isDraftDocument(invoice = {}) {
  const status = String(invoice?.status || '').toLowerCase()
  return status === 'draft' || status === 'pending'
}

export function paymentStatusLabel(status, language = 'en', invoice = null) {
  if (invoice && isDraftDocument(invoice)) {
    return language === 'ar' ? 'غير مرحّلة' : 'Unposted'
  }
  const key = String(status || 'pending').toLowerCase()
  const map = {
    paid: { en: 'Paid', ar: 'مدفوعة' },
    partial: { en: 'Partially Paid', ar: 'مدفوعة جزئياً' },
    partially_paid: { en: 'Partially Paid', ar: 'مدفوعة جزئياً' },
    pending: { en: 'Unpaid', ar: 'غير مدفوعة' },
    unposted: { en: 'Unposted', ar: 'غير مرحّلة' },
    overdue: { en: 'Overdue', ar: 'متأخرة' },
    cancelled: { en: 'Cancelled', ar: 'ملغاة' },
    reversed: { en: 'Reversed', ar: 'معكوس' },
  }
  const entry = map[key] || { en: status || '—', ar: status || '—' }
  return language === 'ar' ? entry.ar : entry.en
}

export function documentStatusLabel(status, language = 'en') {
  const key = String(status || 'draft').toLowerCase()
  const map = {
    draft: { en: 'Draft', ar: 'مسودة' },
    issued: { en: 'Posted', ar: 'مرحّلة' },
    approved: { en: 'Posted', ar: 'مرحّلة' },
    sent: { en: 'Posted', ar: 'مرحّلة' },
    paid: { en: 'Paid', ar: 'مدفوعة' },
    partially_paid: { en: 'Partially Paid', ar: 'مدفوعة جزئياً' },
    cancelled: { en: 'Cancelled', ar: 'ملغاة' },
    credited: { en: 'Reversed', ar: 'معكوس' },
    overdue: { en: 'Overdue', ar: 'متأخرة' },
  }
  const entry = map[key] || { en: status || '—', ar: status || '—' }
  return language === 'ar' ? entry.ar : entry.en
}

export function invoiceRemainingBalance(invoice = {}) {
  if (isDraftDocument(invoice)) return 0
  return Math.max(0, Number(invoice?.grandTotal || 0) - Number(invoice?.paidAmount || 0))
}

export function canRegisterPaymentOnInvoice(invoice = {}) {
  if (invoice?.flow === 'purchase') return false
  if (['draft', 'cancelled', 'credited'].includes(String(invoice?.status || '').toLowerCase())) return false
  return invoiceRemainingBalance(invoice) > 0.005
}

export function canRegisterPaymentOnBill(invoice = {}) {
  if (invoice?.flow !== 'purchase') return false
  if (String(invoice?.invoiceType || '388') !== '388') return false
  if (['draft', 'cancelled', 'credited'].includes(String(invoice?.status || '').toLowerCase())) return false
  return invoiceRemainingBalance(invoice) > 0.005
}

export function canRegisterPaymentOnDocument(invoice = {}) {
  return canRegisterPaymentOnInvoice(invoice) || canRegisterPaymentOnBill(invoice)
}

/**
 * Whether the document can be cancelled from the UI.
 * ZATCA-cleared sales invoices should use a credit note instead (backend enforces).
 */
export function canCancelInvoice(invoice = {}, zatcaPhase = 2) {
  const status = String(invoice?.status || '').toLowerCase()
  if (['cancelled', 'credited'].includes(status)) return false
  if (String(invoice?.invoiceSubtype || '') === 'proforma' && status === 'sent') return false

  const isDraft = ['draft', 'pending'].includes(status)
  if (isDraft) return true

  const phase = Number(zatcaPhase) || 2
  const isPurchase = String(invoice?.flow || '') === 'purchase'
  const isCreditNote = String(invoice?.invoiceType || '') === '381'
  if (
    !isPurchase
    && !isCreditNote
    && phase >= 2
    && Boolean(invoice?.zatca?.signedXml)
  ) {
    return false
  }
  return true
}
