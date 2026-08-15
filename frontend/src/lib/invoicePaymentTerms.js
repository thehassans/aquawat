/** Invoice payment-term presets (Odoo-style) with due-date calculation. */

export const INVOICE_PAYMENT_TERMS = [
  { id: 'immediate', labelEn: 'Immediate Payment', labelAr: 'دفع فوري', kind: 'days', days: 0 },
  { id: 'net15', labelEn: '15 Days', labelAr: '15 يوم', kind: 'days', days: 15 },
  { id: 'net21', labelEn: '21 Days', labelAr: '21 يوم', kind: 'days', days: 21 },
  { id: 'net30', labelEn: '30 Days', labelAr: '30 يوم', kind: 'days', days: 30 },
  { id: 'net45', labelEn: '45 Days', labelAr: '45 يوم', kind: 'days', days: 45 },
  { id: 'eom_following', labelEn: 'End of Following Month', labelAr: 'نهاية الشهر التالي', kind: 'eom_following' },
  { id: 'eom_next_plus_10', labelEn: '10 Days after End of Next Month', labelAr: '10 أيام بعد نهاية الشهر التالي', kind: 'eom_next_plus_10' },
  { id: '30_now_60_balance', labelEn: '30% Now, Balance 60 Days', labelAr: '٣٠٪ الآن والباقي خلال ٦٠ يوم', kind: 'days', days: 60 },
  { id: 'net7', labelEn: '7 Days', labelAr: '7 أيام', kind: 'days', days: 7 },
  { id: 'net10', labelEn: '10 Days', labelAr: '10 أيام', kind: 'days', days: 10 },
  { id: 'net60', labelEn: '60 Days', labelAr: '60 يوم', kind: 'days', days: 60 },
  { id: 'net90', labelEn: '90 Days', labelAr: '90 يوم', kind: 'days', days: 90 },
  { id: 'end_of_month', labelEn: 'End of Current Month', labelAr: 'نهاية الشهر الحالي', kind: 'eom_current' },
  { id: 'cod', labelEn: 'Cash on Delivery', labelAr: 'الدفع عند الاستلام', kind: 'days', days: 0 },
]

const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

export const computeDueDateFromPaymentTerms = (issueDate, paymentTermsId) => {
  const base = issueDate instanceof Date ? new Date(issueDate) : new Date(issueDate || Date.now())
  if (Number.isNaN(base.getTime())) return null

  const term = INVOICE_PAYMENT_TERMS.find((t) => t.id === paymentTermsId)
  if (!term) return null

  if (term.kind === 'days') {
    const due = new Date(base)
    due.setDate(due.getDate() + Number(term.days || 0))
    return due
  }

  if (term.kind === 'eom_current') {
    return endOfMonth(base)
  }

  if (term.kind === 'eom_following') {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    return endOfMonth(nextMonth)
  }

  if (term.kind === 'eom_next_plus_10') {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    const eom = endOfMonth(nextMonth)
    eom.setDate(eom.getDate() + 10)
    return eom
  }

  return null
}

export const getPaymentTermLabel = (id, language = 'en') => {
  const term = INVOICE_PAYMENT_TERMS.find((t) => t.id === id)
  if (!term) return id || ''
  return language === 'ar' ? term.labelAr : term.labelEn
}

const IMMEDIATE_PAYMENT_TERM_IDS = new Set(['immediate', 'cod'])

export const isImmediatePaymentTerm = (id) => IMMEDIATE_PAYMENT_TERM_IDS.has(String(id || ''))

/** Map stored invoice status to the Paid / Unpaid form control. */
export const formPaymentStatusFromInvoice = (invoice, { defaultTerms = 'immediate' } = {}) => {
  const status = String(invoice?.paymentStatus || '').toLowerCase()
  if (status === 'paid') return 'paid'
  if (['pending', 'partial', 'overdue', 'cancelled'].includes(status)) return 'pending'
  return isImmediatePaymentTerm(invoice?.paymentTerms || defaultTerms) ? 'paid' : 'pending'
}

/** Apply the Paid / Unpaid control to a create/update payload. */
export const applyFormPaymentToPayload = (payload, { paymentStatus, paidAmount, grandTotal } = {}) => {
  const total = Math.max(0, Number(grandTotal) || 0)
  if (paymentStatus === 'paid') {
    payload.paymentStatus = 'paid'
    payload.paidAmount = total
    return payload
  }
  const paid = Math.max(0, Number(paidAmount) || 0)
  payload.paymentStatus = 'pending'
  payload.paidAmount = total > 0 && paid >= total ? 0 : paid
  return payload
}
