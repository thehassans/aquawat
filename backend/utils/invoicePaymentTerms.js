/** Invoice payment-term presets — keep in sync with frontend/src/lib/invoicePaymentTerms.js */

const INVOICE_PAYMENT_TERMS = [
  { id: 'immediate', kind: 'days', days: 0 },
  { id: 'net7', kind: 'days', days: 7 },
  { id: 'net10', kind: 'days', days: 10 },
  { id: 'net15', kind: 'days', days: 15 },
  { id: 'net21', kind: 'days', days: 21 },
  { id: 'net30', kind: 'days', days: 30 },
  { id: 'net45', kind: 'days', days: 45 },
  { id: 'net60', kind: 'days', days: 60 },
  { id: 'net90', kind: 'days', days: 90 },
  { id: 'cod', kind: 'days', days: 0 },
  { id: '30_now_60_balance', kind: 'days', days: 60 },
  { id: 'eom_following', kind: 'eom_following' },
  { id: 'eom_next_plus_10', kind: 'eom_next_plus_10' },
  { id: 'end_of_month', kind: 'eom_current' },
];

const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

export function computeDueDateFromPaymentTerms(issueDate, paymentTermsId) {
  const base = issueDate instanceof Date ? new Date(issueDate) : new Date(issueDate || Date.now());
  if (Number.isNaN(base.getTime())) return null;

  const term = INVOICE_PAYMENT_TERMS.find((t) => t.id === paymentTermsId);
  if (!term) return null;

  if (term.kind === 'days') {
    const due = new Date(base);
    due.setDate(due.getDate() + Number(term.days || 0));
    return due;
  }

  if (term.kind === 'eom_current') {
    return endOfMonth(base);
  }

  if (term.kind === 'eom_following') {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    return endOfMonth(nextMonth);
  }

  if (term.kind === 'eom_next_plus_10') {
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    const eom = endOfMonth(nextMonth);
    eom.setDate(eom.getDate() + 10);
    return eom;
  }

  return null;
}

export function ensureInvoiceDueDate(invoiceData) {
  if (invoiceData?.dueDate) return invoiceData;
  const due = computeDueDateFromPaymentTerms(invoiceData?.issueDate, invoiceData?.paymentTerms);
  if (due) invoiceData.dueDate = due;
  return invoiceData;
}
