/** Invoice payment-term presets — keep in sync with frontend/src/lib/invoicePaymentTerms.js */

import {
  addDaysToDateOnly,
  dateOnlyToUtcNoon,
  endOfMonthDateOnly,
  extractDateOnly,
} from './dateOnly.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** @deprecated Prefer addDaysToDateOnly + dateOnlyToUtcNoon for invoice due dates */
export const addDays = (date, days) => {
  const only = addDaysToDateOnly(extractDateOnly(date) || extractDateOnly(new Date()), days);
  return dateOnlyToUtcNoon(only) || new Date();
};

export const INVOICE_PAYMENT_TERMS = [
  { id: 'immediate', labelEn: 'Immediate Payment', labelAr: 'دفع فوري', kind: 'days', days: 0 },
  { id: 'cod', labelEn: 'Cash on Delivery', labelAr: 'الدفع عند الاستلام', kind: 'days', days: 0 },
  { id: 'net7', labelEn: '7 Days', labelAr: '7 أيام', kind: 'days', days: 7 },
  { id: 'net10', labelEn: '10 Days', labelAr: '10 أيام', kind: 'days', days: 10 },
  { id: 'net15', labelEn: '15 Days', labelAr: '15 يوم', kind: 'days', days: 15 },
  { id: 'net21', labelEn: '21 Days', labelAr: '21 يوم', kind: 'days', days: 21 },
  { id: 'net30', labelEn: '30 Days', labelAr: '30 يوم', kind: 'days', days: 30 },
  { id: 'net45', labelEn: '45 Days', labelAr: '45 يوم', kind: 'days', days: 45 },
  { id: 'net60', labelEn: '60 Days', labelAr: '60 يوم', kind: 'days', days: 60 },
  { id: 'net90', labelEn: '90 Days', labelAr: '90 يوم', kind: 'days', days: 90 },
  { id: 'end_of_month', labelEn: 'End of Current Month', labelAr: 'نهاية الشهر الحالي', kind: 'eom_current' },
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
];

export const BUILTIN_PAYMENT_TERMS = INVOICE_PAYMENT_TERMS;

export function findPaymentTerm(paymentTermsId) {
  return INVOICE_PAYMENT_TERMS.find((t) => t.id === paymentTermsId) || null;
}

function dueFromDateOnly(dateOnly) {
  return dateOnlyToUtcNoon(dateOnly);
}

function computeSimpleDueDateOnly(baseOnly, term) {
  if (term.kind === 'days') {
    return addDaysToDateOnly(baseOnly, Number(term.days || 0));
  }
  if (term.kind === 'eom_current') {
    return endOfMonthDateOnly(baseOnly);
  }
  if (term.kind === 'eom_following') {
    const [y, m] = baseOnly.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return endOfMonthDateOnly(next);
  }
  if (term.kind === 'eom_next_plus_10') {
    const [y, m] = baseOnly.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return addDaysToDateOnly(endOfMonthDateOnly(next), 10);
  }
  return null;
}

export function computeDueDateFromPaymentTerms(issueDate, paymentTermsId) {
  const baseOnly = extractDateOnly(issueDate) || extractDateOnly(new Date());
  if (!baseOnly) return null;

  const term = findPaymentTerm(paymentTermsId);
  if (!term) return null;

  if (term.kind === 'installments' && Array.isArray(term.installments) && term.installments.length) {
    let maxOnly = null;
    for (const inst of term.installments) {
      const dueOnly = addDaysToDateOnly(baseOnly, Number(inst.days || 0));
      if (!maxOnly || dueOnly > maxOnly) maxOnly = dueOnly;
    }
    return dueFromDateOnly(maxOnly);
  }

  if (term.kind === 'early_discount') {
    return dueFromDateOnly(addDaysToDateOnly(baseOnly, Number(term.standardDays || 30)));
  }

  const dueOnly = computeSimpleDueDateOnly(baseOnly, term);
  return dueOnly ? dueFromDateOnly(dueOnly) : null;
}

/** Build receivable tranches for staggered or conditional payment terms. */
export function computePaymentSchedule(issueDate, paymentTermsId, amount = 0) {
  const baseOnly = extractDateOnly(issueDate) || extractDateOnly(new Date());
  if (!baseOnly) {
    return { tranches: [], dueDate: null, termKind: null };
  }

  const term = findPaymentTerm(paymentTermsId);
  if (!term) return { tranches: [], dueDate: null, termKind: null };

  const amt = Math.max(0, Number(amount) || 0);

  if (term.kind === 'installments' && Array.isArray(term.installments) && term.installments.length) {
    const tranches = term.installments.map((inst, index) => {
      const dueOnly = addDaysToDateOnly(baseOnly, Number(inst.days || 0));
      return {
        sequence: index + 1,
        percent: Number(inst.percent || 0),
        days: Number(inst.days || 0),
        labelEn: inst.labelEn || '',
        labelAr: inst.labelAr || '',
        dueDate: dueFromDateOnly(dueOnly),
        amount: round2(amt * (Number(inst.percent || 0) / 100)),
      };
    });
    const dueDate = tranches.reduce((max, row) => (!max || row.dueDate > max ? row.dueDate : max), null);
    return { tranches, dueDate, termKind: 'installments', termId: term.id };
  }

  if (term.kind === 'early_discount') {
    const discountPercent = Number(term.discountPercent || 0);
    const discountWithinDays = Number(term.discountWithinDays || 0);
    const standardDays = Number(term.standardDays || 30);
    const deadline = dueFromDateOnly(addDaysToDateOnly(baseOnly, discountWithinDays));
    const standardDue = dueFromDateOnly(addDaysToDateOnly(baseOnly, standardDays));
    const discountedAmount = round2(amt * (1 - discountPercent / 100));
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
          noteEn: `Pay by ${extractDateOnly(deadline)} for discount`,
          noteAr: `ادفع قبل ${extractDateOnly(deadline)} للخصم`,
        },
        {
          sequence: 2,
          percent: 100,
          days: standardDays,
          dueDate: standardDue,
          amount: amt,
          labelEn: 'Standard',
          labelAr: 'عادي',
          noteEn: 'Full amount if discount window missed',
          noteAr: 'المبلغ كاملاً بعد انتهاء الخصم',
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
    };
  }

  const dueOnly = computeSimpleDueDateOnly(baseOnly, term);
  const dueDate = dueOnly ? dueFromDateOnly(dueOnly) : null;
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
    : [];

  return { tranches, dueDate, termKind: term.kind, termId: term.id };
}

export function describePaymentTerm(term, language = 'en') {
  if (!term) return '';
  const isAr = language === 'ar';
  if (term.kind === 'installments' && term.installments?.length) {
    return term.installments
      .map((inst) => `${inst.percent}% @ ${inst.days}d`)
      .join(isAr ? '، ' : ', ');
  }
  if (term.kind === 'early_discount') {
    return isAr
      ? `${term.discountPercent}% خلال ${term.discountWithinDays} يوم وإلا ${term.standardDays} يوم`
      : `${term.discountPercent}% / ${term.discountWithinDays}d else Net ${term.standardDays}`;
  }
  if (term.kind === 'days') return `${term.days || 0}d`;
  return term.kind || '';
}

export function resolveInvoicePaymentTerms({
  paymentTerms,
  customer = null,
  companyDefault = 'net30',
} = {}) {
  const explicit = String(paymentTerms || '').trim();
  if (explicit && findPaymentTerm(explicit)) return explicit;

  const fromCustomer = String(
    customer?.paymentTermsCustomer || customer?.paymentTerms || '',
  ).trim();
  if (fromCustomer && findPaymentTerm(fromCustomer)) return fromCustomer;

  const fallback = String(companyDefault || 'net30').trim();
  if (fallback && findPaymentTerm(fallback)) return fallback;
  return 'net30';
}

export function applyInvoicePaymentTerms(invoiceData, {
  customer = null,
  companyDefault = 'net30',
  bodyPaymentTerms,
  bodyDueDate,
  dueDateOverride = false,
} = {}) {
  if (!invoiceData) return invoiceData;

  const rawBodyTerms = String(
    bodyPaymentTerms !== undefined ? bodyPaymentTerms : (invoiceData.paymentTerms || ''),
  ).trim();
  const customerTerms = String(
    customer?.paymentTermsCustomer || customer?.paymentTerms || '',
  ).trim();

  const effectiveBodyTerms = (rawBodyTerms && rawBodyTerms !== 'immediate')
    ? rawBodyTerms
    : (customerTerms || rawBodyTerms || '');

  invoiceData.paymentTerms = resolveInvoicePaymentTerms({
    paymentTerms: effectiveBodyTerms,
    customer,
    companyDefault,
  });

  const hadManualDue = dueDateOverride
    || (
      bodyDueDate != null
      && String(bodyDueDate).trim() !== ''
      && rawBodyTerms
      && rawBodyTerms !== 'immediate'
    );

  if (!hadManualDue) {
    invoiceData.dueDate = undefined;
  } else if (bodyDueDate !== undefined) {
    const only = extractDateOnly(bodyDueDate);
    invoiceData.dueDate = only ? dateOnlyToUtcNoon(only) : bodyDueDate;
  }

  return ensureInvoiceDueDate(invoiceData);
}

export function ensureInvoiceDueDate(invoiceData) {
  if (!invoiceData) return invoiceData;
  const issueDate = invoiceData.issueDate || new Date();
  const amount = Number(invoiceData.grandTotal || invoiceData.total || 0);
  const schedule = computePaymentSchedule(issueDate, invoiceData.paymentTerms, amount);

  if (schedule.dueDate && !invoiceData.dueDate) {
    invoiceData.dueDate = schedule.dueDate;
  } else if (!invoiceData.dueDate) {
    const due = computeDueDateFromPaymentTerms(issueDate, invoiceData.paymentTerms);
    if (due) invoiceData.dueDate = due;
  } else {
    const only = extractDateOnly(invoiceData.dueDate);
    if (only) invoiceData.dueDate = dateOnlyToUtcNoon(only);
  }

  // Never allow due before issue (date-only).
  const issueOnly = extractDateOnly(issueDate);
  const dueOnly = extractDateOnly(invoiceData.dueDate);
  if (issueOnly && dueOnly && dueOnly < issueOnly) {
    invoiceData.dueDate = dateOnlyToUtcNoon(issueOnly);
  }

  if (schedule.tranches?.length) {
    invoiceData.paymentSchedule = schedule.tranches.map((row) => ({
      sequence: row.sequence,
      percent: row.percent,
      days: row.days,
      dueDate: row.dueDate,
      amount: row.amount,
      labelEn: row.labelEn,
      labelAr: row.labelAr,
      noteEn: row.noteEn,
      noteAr: row.noteAr,
    }));
    if (schedule.earlyDiscount) {
      invoiceData.earlyPaymentDiscount = {
        percent: schedule.earlyDiscount.percent,
        deadline: schedule.earlyDiscount.deadline,
        discountedAmount: schedule.earlyDiscount.discountedAmount,
        standardDueDate: schedule.earlyDiscount.standardDueDate,
        standardAmount: schedule.earlyDiscount.standardAmount,
      };
    }
  }

  return invoiceData;
}

export function computePaymentSettlement(invoice, {
  amount,
  paymentDate = new Date(),
  differenceMode = 'keep_open',
} = {}) {
  const payAmt = round2(Number(amount) || 0);
  const gross = round2(Number(invoice?.grandTotal || 0));
  const paid = round2(Number(invoice?.paidAmount || 0));
  const remaining = round2(Math.max(0, gross - paid));

  let cashAmount = payAmt;
  let discountAmount = 0;
  let targetPaidAmount = round2(paid + payAmt);
  let applyEarlyDiscount = false;

  const disc = invoice?.earlyPaymentDiscount;
  if (disc?.deadline && disc.discountedAmount != null) {
    const deadlineOnly = extractDateOnly(disc.deadline);
    const payOnly = extractDateOnly(paymentDate);
    const discountedTotal = round2(Number(disc.discountedAmount || 0));
    const isFullSettlement = differenceMode === 'mark_paid' || payAmt >= remaining - 0.005;

    if (deadlineOnly && payOnly && payOnly <= deadlineOnly && isFullSettlement && remaining > 0.005) {
      const cashDue = round2(Math.max(0, discountedTotal - paid));
      discountAmount = round2(Math.max(0, remaining - cashDue));
      cashAmount = round2(Math.min(payAmt, cashDue));
      applyEarlyDiscount = discountAmount > 0.005;
      if (applyEarlyDiscount && (differenceMode === 'mark_paid' || cashAmount >= cashDue - 0.005)) {
        targetPaidAmount = gross;
      } else if (applyEarlyDiscount) {
        targetPaidAmount = round2(paid + cashAmount);
      }
    }
  }

  if (differenceMode === 'mark_paid' && !applyEarlyDiscount) {
    targetPaidAmount = gross;
  }

  return {
    cashAmount,
    discountAmount,
    targetPaidAmount,
    remaining,
    applyEarlyDiscount,
  };
}
