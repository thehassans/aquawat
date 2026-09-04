/** Invoice payment-term presets (Odoo-style) with due-date and schedule calculation. */

import {
  addDaysToDateOnly,
  dateOnlyToUtcNoon,
  endOfMonthDateOnly,
  extractDateOnly,
} from './dateOnly.js'

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100

/** @deprecated Prefer addDaysToDateOnly for calendar math */
export const addDays = (date, days) => {
  const only = addDaysToDateOnly(extractDateOnly(date) || extractDateOnly(new Date()), days)
  return dateOnlyToUtcNoon(only) || new Date()
}

export const INVOICE_PAYMENT_TERMS = [
  { id: 'immediate', labelEn: 'Immediate Payment', labelAr: 'دفع فوري', kind: 'days', days: 0 },
  { id: 'net15', labelEn: '15 Days', labelAr: '15 يوم', kind: 'days', days: 15 },
  { id: 'net21', labelEn: '21 Days', labelAr: '21 يوم', kind: 'days', days: 21 },
  { id: 'net30', labelEn: '30 Days', labelAr: '30 يوم', kind: 'days', days: 30 },
  { id: 'net45', labelEn: '45 Days', labelAr: '45 يوم', kind: 'days', days: 45 },
  { id: 'eom_following', labelEn: 'End of Following Month', labelAr: 'نهاية الشهر التالي', kind: 'eom_following' },
  { id: 'eom_next_plus_10', labelEn: '10 Days after End of Next Month', labelAr: '10 أيام بعد نهاية الشهر التالي', kind: 'eom_next_plus_10' },
  {
    id: '30_now_60_balance',
    labelEn: '30% Advance, 70% Net 60',
    labelAr: '٣٠٪ مقدماً و٧٠٪ خلال ٦٠ يوم',
    kind: 'installments',
    installments: [
      { percent: 30, days: 0, labelEn: 'Advance', labelAr: 'مقدم' },
      { percent: 70, days: 60, labelEn: 'Balance', labelAr: 'الرصيد' },
    ],
  },
  {
    id: '2pct_10_net30',
    labelEn: '2% Discount within 10 Days, otherwise Net 30',
    labelAr: 'خصم ٢٪ خلال ١٠ أيام وإلا صافي ٣٠',
    kind: 'early_discount',
    discountPercent: 2,
    discountWithinDays: 10,
    standardDays: 30,
  },
  { id: 'net7', labelEn: '7 Days', labelAr: '7 أيام', kind: 'days', days: 7 },
  { id: 'net10', labelEn: '10 Days', labelAr: '10 أيام', kind: 'days', days: 10 },
  { id: 'net60', labelEn: '60 Days', labelAr: '60 يوم', kind: 'days', days: 60 },
  { id: 'net90', labelEn: '90 Days', labelAr: '90 يوم', kind: 'days', days: 90 },
  { id: 'end_of_month', labelEn: 'End of Current Month', labelAr: 'نهاية الشهر الحالي', kind: 'eom_current' },
  { id: 'cod', labelEn: 'Cash on Delivery', labelAr: 'الدفع عند الاستلام', kind: 'days', days: 0 },
]

export const findPaymentTerm = (paymentTermsId) => INVOICE_PAYMENT_TERMS.find((t) => t.id === paymentTermsId) || null

function dueFromDateOnly(dateOnly) {
  return dateOnlyToUtcNoon(dateOnly)
}

function computeSimpleDueDateOnly(baseOnly, term) {
  if (term.kind === 'days') return addDaysToDateOnly(baseOnly, Number(term.days || 0))
  if (term.kind === 'eom_current') return endOfMonthDateOnly(baseOnly)
  if (term.kind === 'eom_following') {
    const [y, m] = baseOnly.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return endOfMonthDateOnly(next)
  }
  if (term.kind === 'eom_next_plus_10') {
    const [y, m] = baseOnly.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return addDaysToDateOnly(endOfMonthDateOnly(next), 10)
  }
  return null
}

export const computeDueDateFromPaymentTerms = (issueDate, paymentTermsId) => {
  const baseOnly = extractDateOnly(issueDate) || extractDateOnly(new Date())
  if (!baseOnly) return null

  const term = findPaymentTerm(paymentTermsId)
  if (!term) return null

  if (term.kind === 'installments' && term.installments?.length) {
    let maxOnly = null
    for (const inst of term.installments) {
      const dueOnly = addDaysToDateOnly(baseOnly, Number(inst.days || 0))
      if (!maxOnly || dueOnly > maxOnly) maxOnly = dueOnly
    }
    return dueFromDateOnly(maxOnly)
  }

  if (term.kind === 'early_discount') {
    return dueFromDateOnly(addDaysToDateOnly(baseOnly, Number(term.standardDays || 30)))
  }

  const dueOnly = computeSimpleDueDateOnly(baseOnly, term)
  return dueOnly ? dueFromDateOnly(dueOnly) : null
}

/** Returns YYYY-MM-DD for form date inputs (timezone-safe). */
export const computeDueDateOnlyFromPaymentTerms = (issueDate, paymentTermsId) => {
  const due = computeDueDateFromPaymentTerms(issueDate, paymentTermsId)
  return extractDateOnly(due)
}

export const computePaymentSchedule = (issueDate, paymentTermsId, amount = 0) => {
  const baseOnly = extractDateOnly(issueDate) || extractDateOnly(new Date())
  if (!baseOnly) return { tranches: [], dueDate: null, termKind: null }

  const term = findPaymentTerm(paymentTermsId)
  if (!term) return { tranches: [], dueDate: null, termKind: null }

  const amt = Math.max(0, Number(amount) || 0)

  if (term.kind === 'installments' && term.installments?.length) {
    const tranches = term.installments.map((inst, index) => {
      const dueOnly = addDaysToDateOnly(baseOnly, Number(inst.days || 0))
      return {
        sequence: index + 1,
        percent: Number(inst.percent || 0),
        days: Number(inst.days || 0),
        labelEn: inst.labelEn || '',
        labelAr: inst.labelAr || '',
        dueDate: dueFromDateOnly(dueOnly),
        amount: round2(amt * (Number(inst.percent || 0) / 100)),
      }
    })
    const dueDate = tranches.reduce((max, row) => (!max || row.dueDate > max ? row.dueDate : max), null)
    return { tranches, dueDate, termKind: 'installments', termId: term.id }
  }

  if (term.kind === 'early_discount') {
    const discountPercent = Number(term.discountPercent || 0)
    const discountWithinDays = Number(term.discountWithinDays || 0)
    const standardDays = Number(term.standardDays || 30)
    const deadline = dueFromDateOnly(addDaysToDateOnly(baseOnly, discountWithinDays))
    const standardDue = dueFromDateOnly(addDaysToDateOnly(baseOnly, standardDays))
    const discountedAmount = round2(amt * (1 - discountPercent / 100))
    return {
      tranches: [
        {
          sequence: 1,
          percent: 100,
          days: discountWithinDays,
          dueDate: deadline,
          amount: discountedAmount,
          labelEn: `${discountPercent}% discount`,
          labelAr: `خصم ${discountPercent}%`,
        },
        {
          sequence: 2,
          percent: 100,
          days: standardDays,
          dueDate: standardDue,
          amount: amt,
          labelEn: 'Standard',
          labelAr: 'عادي',
        },
      ],
      dueDate: standardDue,
      termKind: 'early_discount',
      termId: term.id,
      earlyDiscount: {
        percent: discountPercent,
        deadline,
        discountedAmount,
        standardDueDate: standardDue,
        standardAmount: amt,
      },
    }
  }

  const dueOnly = computeSimpleDueDateOnly(baseOnly, term)
  const dueDate = dueOnly ? dueFromDateOnly(dueOnly) : null
  const tranches = dueDate
    ? [{
      sequence: 1,
      percent: 100,
      days: term.days ?? 0,
      dueDate,
      amount: round2(amt),
      labelEn: term.labelEn || '',
      labelAr: term.labelAr || '',
    }]
    : []

  return { tranches, dueDate, termKind: term.kind, termId: term.id }
}

export const describePaymentTerm = (term, language = 'en') => {
  if (!term) return ''
  const isAr = language === 'ar'
  if (term.kind === 'installments' && term.installments?.length) {
    return term.installments.map((inst) => `${inst.percent}% @ ${inst.days}d`).join(isAr ? '، ' : ', ')
  }
  if (term.kind === 'early_discount') {
    return isAr
      ? `${term.discountPercent}% خلال ${term.discountWithinDays} يوم وإلا ${term.standardDays} يوم`
      : `${term.discountPercent}% / ${term.discountWithinDays}d else Net ${term.standardDays}`
  }
  if (term.kind === 'days') return `${term.days || 0}d`
  return term.kind || ''
}

export const getPaymentTermLabel = (id, language = 'en') => {
  const term = findPaymentTerm(id)
  if (!term) return id || ''
  return language === 'ar' ? term.labelAr : term.labelEn
}

const IMMEDIATE_PAYMENT_TERM_IDS = new Set(['immediate', 'cod'])

export const isImmediatePaymentTerm = (id) => IMMEDIATE_PAYMENT_TERM_IDS.has(String(id || ''))

export const formPaymentStatusFromInvoice = (invoice, { defaultTerms = 'immediate' } = {}) => {
  const status = String(invoice?.paymentStatus || '').toLowerCase()
  if (status === 'paid') return 'paid'
  if (['pending', 'partial', 'overdue', 'cancelled'].includes(status)) return 'pending'
  return isImmediatePaymentTerm(invoice?.paymentTerms || defaultTerms) ? 'paid' : 'pending'
}

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
