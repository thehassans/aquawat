import AccountPayment from '../models/AccountPayment.js';
import Invoice from '../models/Invoice.js';
import Partner from '../models/Partner.js';
import { applyPaidAmountStatus } from '../utils/invoicePaymentStatus.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const METHOD_LABELS = {
  cash: { en: 'Cash', ar: 'نقداً' },
  bank_transfer: { en: 'Bank transfer', ar: 'تحويل بنكي' },
  cheque: { en: 'Check', ar: 'شيك' },
  card: { en: 'Card', ar: 'بطاقة' },
  other: { en: 'Other', ar: 'أخرى' },
  khata: { en: 'Khata', ar: 'خانة' },
};

export function paymentMethodLabel(method, language = 'en') {
  const row = METHOD_LABELS[String(method || '').toLowerCase()] || METHOD_LABELS.other;
  return language === 'ar' ? row.ar : row.en;
}

async function nextPaymentNumber(tenantId, direction = 'inbound') {
  const year = new Date().getFullYear();
  const prefix = direction === 'outbound' ? 'VP' : 'CP';
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  const latest = await AccountPayment.find({
    tenantId,
    number: { $regex: `^${prefix}-${year}-` },
  })
    .select('number')
    .sort({ number: -1 })
    .limit(1)
    .lean();
  let seq = 1;
  const m = String(latest[0]?.number || '').match(re);
  if (m) seq = (parseInt(m[1], 10) || 0) + 1;
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

function invoiceResidual(invoice) {
  const total = round2(invoice.grandTotal || 0);
  const paid = round2(invoice.paidAmount || 0);
  return round2(Math.max(0, total - paid));
}

/**
 * Unified customer (inbound) payment.
 * Creates AccountPayment, updates invoice paid amounts, posts GL once.
 */
export async function createCustomerPayment({
  tenantId,
  userId,
  customerId = null,
  customerName = '',
  date = new Date(),
  amount,
  method = 'bank_transfer',
  journalId = null,
  reference = '',
  memo = '',
  currency = 'SAR',
  allocations: rawAllocations = [],
  source = 'payments_page',
  differenceMode = 'keep_open',
  differenceAccountId = null,
  autoAllocateOldest = false,
}) {
  const payAmt = round2(amount);
  if (!Number.isFinite(payAmt) || payAmt <= 0) {
    const err = new Error('Payment amount must be greater than zero');
    err.status = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  let partnerId = customerId || null;
  let partnerName = String(customerName || '').trim();
  if (partnerId) {
    const partner = await Partner.findOne({ _id: partnerId, tenantId })
      .select('name nameEn nameAr')
      .lean();
    if (partner) {
      partnerName = partnerName || partner.nameEn || partner.name || partner.nameAr || '';
    }
  }

  let allocations = (Array.isArray(rawAllocations) ? rawAllocations : [])
    .map((a) => ({
      invoiceId: a.invoiceId || a._id,
      amount: round2(a.amount),
    }))
    .filter((a) => a.invoiceId && a.amount > 0);

  if (autoAllocateOldest && partnerId && !allocations.length) {
    const open = await Invoice.find({
      tenantId,
      customerId: partnerId,
      flow: { $ne: 'purchase' },
      status: { $nin: ['draft', 'cancelled'] },
      paymentStatus: { $nin: ['paid', 'credited'] },
    })
      .sort({ dueDate: 1, issueDate: 1 })
      .select('_id invoiceNumber grandTotal paidAmount')
      .lean();
    let remaining = payAmt;
    for (const inv of open) {
      if (remaining <= 0.005) break;
      const residual = invoiceResidual(inv);
      if (residual <= 0.005) continue;
      const take = round2(Math.min(residual, remaining));
      allocations.push({ invoiceId: inv._id, amount: take });
      remaining = round2(remaining - take);
    }
  }

  const allocSum = round2(allocations.reduce((s, a) => s + a.amount, 0));
  if (allocSum > payAmt + 0.005) {
    const err = new Error('Sum of allocations exceeds payment amount');
    err.status = 400;
    err.code = 'ALLOCATION_OVERFLOW';
    throw err;
  }

  const invoiceDocs = [];
  for (const row of allocations) {
    const invoice = await Invoice.findOne({
      _id: row.invoiceId,
      tenantId,
      flow: { $ne: 'purchase' },
    });
    if (!invoice) {
      const err = new Error(`Invoice not found: ${row.invoiceId}`);
      err.status = 404;
      err.code = 'INVOICE_NOT_FOUND';
      throw err;
    }
    const residual = invoiceResidual(invoice);
    if (row.amount > residual + 0.005) {
      const err = new Error(
        `Allocation ${row.amount} exceeds residual ${residual} on ${invoice.invoiceNumber}`,
      );
      err.status = 400;
      err.code = 'INVOICE_OVER_ALLOCATION';
      throw err;
    }
    if (!partnerId && invoice.customerId) partnerId = invoice.customerId;
    if (!partnerName) {
      partnerName = invoice.buyer?.name
        || invoice.customerName
        || invoice.customer?.name
        || '';
    }
    invoiceDocs.push({ invoice, amount: row.amount });
  }

  const allocatedAmount = allocSum;
  const unallocatedAmount = round2(payAmt - allocatedAmount);
  const number = await nextPaymentNumber(tenantId, 'inbound');
  const paymentDate = date ? new Date(date) : new Date();

  const payment = await AccountPayment.create({
    tenantId,
    number,
    date: paymentDate,
    direction: 'inbound',
    partnerId,
    partnerName,
    amount: payAmt,
    allocatedAmount,
    unallocatedAmount,
    method: ['cash', 'card', 'bank_transfer', 'cheque', 'other', 'khata'].includes(method)
      ? method
      : 'bank_transfer',
    journalId: journalId || null,
    reference: reference || '',
    memo: memo || '',
    currency,
    status: 'posted',
    allocations: invoiceDocs.map(({ invoice, amount: amt }) => ({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber || '',
      amount: amt,
    })),
    source,
    createdBy: userId || null,
  });

  const accounting = await import('./accountingService.js');
  let primaryJournal = null;

  for (const { invoice, amount: amt } of invoiceDocs) {
    const previousPaymentStatus = invoice.paymentStatus;
    const remainingBefore = invoiceResidual(invoice);
    let applyAmount = amt;

    // Optional write-off on last/single allocation when mark_paid
    let writeOff = 0;
    if (
      differenceMode === 'mark_paid'
      && differenceAccountId
      && invoiceDocs.length === 1
      && round2(remainingBefore - amt) > 0.005
    ) {
      writeOff = round2(remainingBefore - amt);
      applyAmount = remainingBefore;
    }

    invoice.paidAmount = round2((Number(invoice.paidAmount) || 0) + applyAmount);
    invoice.payments = [
      ...(invoice.payments || []),
      {
        method: payment.method,
        amount: amt,
        accountPaymentId: payment._id,
        paymentNumber: payment.number,
        differenceMode: writeOff > 0.005 ? 'mark_paid' : undefined,
        differenceAccountId: writeOff > 0.005 ? differenceAccountId : undefined,
      },
    ];
    applyPaidAmountStatus(invoice);
    await invoice.save();

    const je = await accounting.postInvoicePaymentJournal({
      tenantId,
      userId,
      invoice,
      amount: amt,
      paymentMethod: payment.method,
      paymentDate,
      reference: `${payment.number}:${invoice.invoiceNumber}`,
      currency,
    });
    if (!primaryJournal && je) primaryJournal = je;

    if (writeOff > 0.005) {
      await accounting.postInvoicePaymentDifferenceJournal({
        tenantId,
        userId,
        invoice,
        amount: writeOff,
        differenceAccountId,
        paymentDate,
        reference: `${payment.number}-diff:${invoice.invoiceNumber}`,
        currency,
      });
    }

    void previousPaymentStatus;
  }

  // Unallocated remainder: still post cash/AR (or cash/unearned) against partner AR as advance
  if (unallocatedAmount > 0.005 && partnerId) {
    try {
      const advanceJe = await accounting.postCustomerAdvanceReceiptJournal?.({
        tenantId,
        userId,
        partnerId,
        partnerName,
        amount: unallocatedAmount,
        paymentMethod: payment.method,
        paymentDate,
        reference: `${payment.number}:advance`,
        currency,
        memo: memo || `Unallocated receipt ${payment.number}`,
      });
      if (!primaryJournal && advanceJe) primaryJournal = advanceJe;
    } catch {
      // optional helper may not exist yet — create a soft AR credit via a synthetic invoice-less journal below
    }
  }

  if (primaryJournal?._id) {
    payment.journalEntryId = primaryJournal._id;
    payment.journalId = primaryJournal.journalId || payment.journalId;
    await payment.save();
  }

  // Mirror a receive voucher so legacy voucher screens stay in sync
  try {
    const Voucher = (await import('../models/Voucher.js')).default;
    const existing = payment.voucherId
      ? await Voucher.findById(payment.voucherId)
      : null;
    if (!existing) {
      const voucher = await Voucher.create({
        tenantId,
        voucherNumber: payment.number,
        type: 'receive',
        date: paymentDate,
        amount: payAmt,
        partyType: 'customer',
        partyId: partnerId,
        partyName,
        paymentMethod: payment.method === 'khata' ? 'other' : payment.method,
        reference: payment.reference || payment.number,
        description: payment.memo || `Customer payment ${payment.number}`,
        status: 'approved',
        createdBy: userId,
      });
      payment.voucherId = voucher._id;
      await payment.save();
      // Avoid double-posting voucher GL when invoice journals already posted
      if (!invoiceDocs.length && unallocatedAmount > 0.005) {
        await accounting.postVoucherJournal({
          tenantId,
          userId,
          voucher,
          currency,
        });
      }
    }
  } catch (voucherErr) {
    console.warn('[customerPayment] voucher mirror failed:', voucherErr.message);
  }

  return payment.toObject ? payment.toObject() : payment;
}

export async function listCustomerPayments(tenantId, {
  search = '',
  page = 1,
  limit = 50,
  partnerId = null,
} = {}) {
  const filter = {
    tenantId,
    direction: 'inbound',
    status: { $ne: 'cancelled' },
  };
  if (partnerId) filter.partnerId = partnerId;
  if (search) {
    const q = String(search).trim();
    filter.$or = [
      { number: { $regex: q, $options: 'i' } },
      { partnerName: { $regex: q, $options: 'i' } },
      { reference: { $regex: q, $options: 'i' } },
      { memo: { $regex: q, $options: 'i' } },
      { 'allocations.invoiceNumber': { $regex: q, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const [total, rows] = await Promise.all([
    AccountPayment.countDocuments(filter),
    AccountPayment.find(filter)
      .populate('journalId', 'code name nameAr type')
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    payments: rows.map((row) => ({
      ...row,
      methodLabel: paymentMethodLabel(row.method),
      methodLabelAr: paymentMethodLabel(row.method, 'ar'),
      journalLabel: row.journalId?.code
        ? `${row.journalId.code}${row.journalId.name ? ` — ${row.journalId.name}` : ''}`
        : null,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 0,
    },
  };
}

/**
 * Dry-run / apply: create AccountPayment rows from InvoicePayment journals that have none.
 */
export async function backfillCustomerPaymentsFromJournals(tenantId, { dryRun = true, limit = 500 } = {}) {
  const JournalEntry = (await import('../models/JournalEntry.js')).default;
  const entries = await JournalEntry.find({
    tenantId,
    type: 'payment',
    sourceModel: 'InvoicePayment',
    status: { $nin: ['void', 'reversed'] },
  })
    .sort({ entryDate: 1 })
    .limit(Math.min(2000, Math.max(1, Number(limit) || 500)))
    .select('_id entryDate reference memo sourceId sourceNumber totalDebit totalCredit lines journalId')
    .lean();

  const report = {
    dryRun: !!dryRun,
    scanned: entries.length,
    wouldCreate: 0,
    created: 0,
    skippedExisting: 0,
    rows: [],
  };

  for (const entry of entries) {
    const existing = await AccountPayment.findOne({
      tenantId,
      $or: [
        { journalEntryId: entry._id },
        { reference: entry.reference },
      ],
    }).select('_id number').lean();
    if (existing) {
      report.skippedExisting += 1;
      continue;
    }

    const amount = round2(entry.totalDebit || entry.totalCredit
      || (entry.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0));
    if (amount <= 0) continue;

    const invoice = entry.sourceId
      ? await Invoice.findOne({ _id: entry.sourceId, tenantId })
        .select('invoiceNumber customerId buyer paidAmount payments grandTotal')
        .lean()
      : null;

    const row = {
      numberHint: entry.sourceNumber ? `BF-${entry.sourceNumber}` : null,
      journalEntryId: String(entry._id),
      date: entry.entryDate,
      amount,
      invoiceId: invoice?._id ? String(invoice._id) : null,
      invoiceNumber: invoice?.invoiceNumber || entry.sourceNumber || '',
      partnerId: invoice?.customerId ? String(invoice.customerId) : null,
      partnerName: invoice?.buyer?.name || '',
      reference: entry.reference || '',
    };
    report.wouldCreate += 1;
    report.rows.push(row);

    if (!dryRun) {
      const number = await nextPaymentNumber(tenantId, 'inbound');
      await AccountPayment.create({
        tenantId,
        number,
        date: entry.entryDate || new Date(),
        direction: 'inbound',
        partnerId: invoice?.customerId || null,
        partnerName: invoice?.buyer?.name || '',
        amount,
        allocatedAmount: invoice ? amount : 0,
        unallocatedAmount: invoice ? 0 : amount,
        method: /cash/i.test(String(entry.memo || entry.reference || '')) ? 'cash' : 'bank_transfer',
        journalId: entry.journalId || null,
        journalEntryId: entry._id,
        reference: entry.reference || '',
        memo: entry.memo || `Backfill from ${entry.sourceNumber || entry._id}`,
        status: 'posted',
        allocations: invoice
          ? [{ invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber || '', amount }]
          : [],
        source: 'backfill',
      });
      report.created += 1;
    }
  }

  return report;
}

export async function getOpenCustomerInvoices(tenantId, customerId) {
  if (!customerId) return [];
  const invoices = await Invoice.find({
    tenantId,
    customerId,
    flow: { $ne: 'purchase' },
    status: { $nin: ['draft', 'cancelled'] },
  })
    .sort({ dueDate: 1, issueDate: 1 })
    .select('invoiceNumber issueDate dueDate grandTotal paidAmount paymentStatus currency')
    .lean();

  return invoices
    .map((inv) => {
      const residual = invoiceResidual(inv);
      return {
        ...inv,
        residual,
      };
    })
    .filter((inv) => inv.residual > 0.005);
}
