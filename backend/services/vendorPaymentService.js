import AccountPayment from '../models/AccountPayment.js';
import Invoice from '../models/Invoice.js';
import Partner from '../models/Partner.js';
import '../models/Journal.js'; // ensure populate('journalId') resolves
import { applyPaidAmountStatus } from '../utils/invoicePaymentStatus.js';
import { paymentMethodLabel } from './customerPaymentService.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function nextVendorPaymentNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = 'VP';
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

function billResidual(invoice) {
  const total = round2(invoice.grandTotal || 0);
  const paid = round2(invoice.paidAmount || 0);
  return round2(Math.max(0, total - paid));
}

/**
 * Unified vendor (outbound) payment.
 * Creates AccountPayment, allocates to purchase bills, posts GL.
 * Over-payment (unallocated) posts as Advance to Suppliers — never silent AP debit.
 */
export async function createVendorPayment({
  tenantId,
  userId,
  vendorId = null,
  vendorName = '',
  date = new Date(),
  amount,
  method = 'bank_transfer',
  journalId = null,
  reference = '',
  memo = '',
  currency = 'SAR',
  allocations: rawAllocations = [],
  source = 'payments_page',
  autoAllocateOldest = false,
  confirmNegativeCash = false,
  purchaseOrder = null,
  attachments = [],
  skipVoucherMirror = false,
}) {
  const payAmt = round2(amount);
  if (!Number.isFinite(payAmt) || payAmt <= 0) {
    const err = new Error('Payment amount must be greater than zero');
    err.status = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  let partnerId = vendorId || null;
  let partnerName = String(vendorName || '').trim();
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
      invoiceId: a.billId || a.invoiceId || a._id,
      amount: round2(a.amount),
    }))
    .filter((a) => a.invoiceId && a.amount > 0);

  if (autoAllocateOldest && partnerId && !allocations.length) {
    const open = await Invoice.find({
      tenantId,
      supplierId: partnerId,
      flow: 'purchase',
      status: { $nin: ['draft', 'cancelled'] },
      paymentStatus: { $nin: ['paid', 'credited'] },
    })
      .sort({ dueDate: 1, issueDate: 1 })
      .select('_id invoiceNumber grandTotal paidAmount')
      .lean();
    let remaining = payAmt;
    for (const inv of open) {
      if (remaining <= 0.005) break;
      const residual = billResidual(inv);
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
      flow: 'purchase',
    });
    if (!invoice) {
      const err = new Error(`Vendor bill not found: ${row.invoiceId}`);
      err.status = 404;
      err.code = 'BILL_NOT_FOUND';
      throw err;
    }
    const residual = billResidual(invoice);
    const billTotal = round2(invoice.grandTotal || 0);
    // Cap: allocation cannot exceed residual (and therefore cannot exceed bill.total)
    if (row.amount > residual + 0.005) {
      const err = new Error(
        `Allocation ${row.amount} exceeds residual ${residual} on bill ${invoice.invoiceNumber} (total ${billTotal})`,
      );
      err.status = 400;
      err.code = 'BILL_OVER_ALLOCATION';
      throw err;
    }
    if (!partnerId && invoice.supplierId) partnerId = invoice.supplierId;
    if (!partnerName) {
      partnerName = invoice.seller?.name
        || invoice.seller?.nameEn
        || invoice.supplierName
        || '';
    }
    invoiceDocs.push({ invoice, amount: row.amount });
  }

  const allocatedAmount = allocSum;
  const unallocatedAmount = round2(payAmt - allocatedAmount);
  const number = await nextVendorPaymentNumber(tenantId);
  const paymentDate = date ? new Date(date) : new Date();
  const safeMethod = ['cash', 'card', 'bank_transfer', 'cheque', 'other', 'khata'].includes(method)
    ? method
    : 'bank_transfer';

  const payment = await AccountPayment.create({
    tenantId,
    number,
    date: paymentDate,
    direction: 'outbound',
    partnerId,
    partnerName,
    amount: payAmt,
    allocatedAmount,
    unallocatedAmount,
    method: safeMethod,
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
    attachments: Array.isArray(attachments)
      ? attachments.filter((a) => a?.url).map((a) => ({
        name: a.name || '',
        url: a.url,
        type: a.type || '',
      }))
      : [],
    source,
    createdBy: userId || null,
  });

  const accounting = await import('./accountingService.js');
  let primaryJournal = null;

  for (const { invoice, amount: amt } of invoiceDocs) {
    const previousPaymentStatus = invoice.paymentStatus;
    invoice.paidAmount = round2((Number(invoice.paidAmount) || 0) + amt);
    invoice.payments = [
      ...(invoice.payments || []),
      {
        method: payment.method,
        amount: amt,
        accountPaymentId: payment._id,
        paymentNumber: payment.number,
        paidAt: paymentDate,
      },
    ];
    applyPaidAmountStatus(invoice);
    await invoice.save();

    const je = await accounting.postVendorBillPaymentJournal({
      tenantId,
      userId,
      invoice,
      amount: amt,
      paymentMethod: payment.method,
      paymentDate,
      reference: `${payment.number}:${invoice.invoiceNumber}`,
      currency,
      memo: memo || `Payment ${payment.number} for bill ${invoice.invoiceNumber}`,
      confirmNegativeCash,
      journalId: journalId || payment.journalId || null,
    });
    if (!primaryJournal && je) primaryJournal = je;
    void previousPaymentStatus;
  }

  // Over-payment / unallocated → Advance to Suppliers (never silent AP debit)
  if (unallocatedAmount > 0.005) {
    const advanceJe = await accounting.postVendorAdvanceJournal({
      tenantId,
      userId,
      partnerId,
      partnerName,
      amount: unallocatedAmount,
      paymentMethod: payment.method,
      paymentDate,
      reference: `${payment.number}:advance`,
      currency,
      memo: memo || `Advance to supplier — ${payment.number}`,
      confirmNegativeCash,
      purchaseOrder,
      journalId: journalId || payment.journalId || null,
    });
    if (!primaryJournal && advanceJe) primaryJournal = advanceJe;
  }

  if (primaryJournal?._id) {
    payment.journalEntryId = primaryJournal._id;
    payment.journalId = primaryJournal.journalId || payment.journalId;
    await payment.save();
  }

  if (!skipVoucherMirror) {
    try {
      const Voucher = (await import('../models/Voucher.js')).default;
      const existing = payment.voucherId
        ? await Voucher.findById(payment.voucherId)
        : null;
      if (!existing) {
        const voucher = await Voucher.create({
          tenantId,
          voucherNumber: payment.number,
          type: 'payment',
          date: paymentDate,
          amount: payAmt,
          partyType: 'supplier',
          partyId: partnerId,
          partyName,
          paymentMethod: payment.method === 'khata' ? 'other' : payment.method,
          reference: payment.reference || payment.number,
          description: payment.memo || `Vendor payment ${payment.number}`,
          status: 'approved',
          createdBy: userId,
        });
        payment.voucherId = voucher._id;
        await payment.save();
      }
    } catch (voucherErr) {
      console.warn('[vendorPayment] voucher mirror failed:', voucherErr.message);
    }
  }

  return payment.toObject ? payment.toObject() : payment;
}

export async function listVendorPayments(tenantId, {
  search = '',
  page = 1,
  limit = 50,
  partnerId = null,
} = {}) {
  const filter = {
    tenantId,
    direction: 'outbound',
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

export async function getOpenVendorBills(tenantId, vendorId) {
  if (!vendorId) return [];
  const invoices = await Invoice.find({
    tenantId,
    supplierId: vendorId,
    flow: 'purchase',
    status: { $nin: ['draft', 'cancelled'] },
  })
    .sort({ dueDate: 1, issueDate: 1 })
    .select('invoiceNumber issueDate dueDate grandTotal paidAmount paymentStatus currency')
    .lean();

  return invoices
    .map((inv) => {
      const residual = billResidual(inv);
      return { ...inv, residual };
    })
    .filter((inv) => inv.residual > 0.005);
}

/**
 * Dry-run / apply: create outbound AccountPayment rows from VendorBillPayment journals
 * (and payment vouchers) that have none.
 */
export async function backfillVendorPaymentsFromJournals(tenantId, { dryRun = true, limit = 500 } = {}) {
  const JournalEntry = (await import('../models/JournalEntry.js')).default;
  const entries = await JournalEntry.find({
    tenantId,
    type: 'payment',
    status: { $nin: ['void', 'reversed'] },
    $or: [
      { sourceModel: { $in: ['VendorBillPayment', 'VendorAdvance', 'PurchaseOrderAdvance', 'PurchaseOrderPayment'] } },
      { memo: /Supplier payment for PO/i },
      { memo: /Advance to Suppliers/i },
    ],
  })
    .sort({ entryDate: 1 })
    .limit(Math.min(2000, Math.max(1, Number(limit) || 500)))
    .select('_id entryDate reference memo sourceId sourceNumber sourceModel totalDebit totalCredit lines journalId')
    .lean();

  const report = {
    dryRun: !!dryRun,
    scanned: entries.length,
    wouldCreate: 0,
    created: 0,
    skippedExisting: 0,
    linkedToBill: 0,
    linkedToPoAdvance: 0,
    ambiguous: 0,
    rows: [],
  };

  for (const entry of entries) {
    const existing = await AccountPayment.findOne({
      tenantId,
      direction: 'outbound',
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

    const isBillPay = entry.sourceModel === 'VendorBillPayment';
    const isPoPay = entry.sourceModel === 'PurchaseOrderPayment'
      || /Supplier payment for PO/i.test(String(entry.memo || ''));
    const invoice = (isBillPay && entry.sourceId)
      ? await Invoice.findOne({ _id: entry.sourceId, tenantId, flow: 'purchase' })
        .select('invoiceNumber supplierId seller paidAmount payments grandTotal')
        .lean()
      : null;

    let partnerId = invoice?.supplierId
      || (entry.lines || []).find((l) => l.partnerId)?.partnerId
      || null;
    let partnerName = invoice?.seller?.name || '';
    if (!partnerName && partnerId) {
      const p = await Partner.findOne({ _id: partnerId, tenantId }).select('name nameEn nameAr').lean();
      partnerName = p?.nameEn || p?.name || p?.nameAr || '';
    }

    const linkKind = invoice
      ? 'bill'
      : (isPoPay || entry.sourceModel === 'PurchaseOrderAdvance' || entry.sourceModel === 'VendorAdvance'
        ? 'advance_or_po'
        : 'ambiguous');
    if (linkKind === 'bill') report.linkedToBill += 1;
    else if (linkKind === 'advance_or_po') report.linkedToPoAdvance += 1;
    else report.ambiguous += 1;

    const row = {
      numberHint: entry.sourceNumber ? `BF-${entry.sourceNumber}` : null,
      journalEntryId: String(entry._id),
      date: entry.entryDate,
      amount,
      invoiceId: invoice?._id ? String(invoice._id) : null,
      invoiceNumber: invoice?.invoiceNumber || entry.sourceNumber || '',
      partnerId: partnerId ? String(partnerId) : null,
      partnerName,
      reference: entry.reference || '',
      sourceModel: entry.sourceModel,
      memo: entry.memo || '',
      linkKind,
      wouldLinkTo: invoice
        ? `Bill ${invoice.invoiceNumber}`
        : (isPoPay ? `PO advance (no bill) — ${entry.sourceNumber || entry.memo || ''}` : 'Unlinked / ambiguous'),
    };
    report.wouldCreate += 1;
    report.rows.push(row);

    if (!dryRun) {
      const number = await nextVendorPaymentNumber(tenantId);
      const allocated = invoice ? amount : 0;
      await AccountPayment.create({
        tenantId,
        number,
        date: entry.entryDate || new Date(),
        direction: 'outbound',
        partnerId: partnerId || null,
        partnerName,
        amount,
        allocatedAmount: allocated,
        unallocatedAmount: round2(amount - allocated),
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

export { paymentMethodLabel };
