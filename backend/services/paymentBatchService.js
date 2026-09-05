import PaymentBatch from '../models/PaymentBatch.js';
import Invoice from '../models/Invoice.js';
import Partner from '../models/Partner.js';
import { normalizeIban } from '../utils/iban.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function nextBatchNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = 'PB';
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  const latest = await PaymentBatch.find({
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

function partnerIban(partner) {
  if (!partner) return '';
  const accounts = Array.isArray(partner.bankAccounts) ? partner.bankAccounts : [];
  const preferred = accounts.find((a) => a.isDefault) || accounts[0];
  const raw = preferred?.iban || partner.bank?.iban || '';
  return normalizeIban(raw);
}

function partnerName(partner, bill) {
  if (partner) {
    return partner.nameEn || partner.name || partner.nameAr || bill?.seller?.name || 'Vendor';
  }
  return bill?.seller?.name || 'Vendor';
}

/**
 * Create a draft payment batch from selected vendor bill ids.
 */
export async function createPaymentBatch({
  tenantId,
  userId,
  invoiceIds = [],
  executionDate = new Date(),
  format = 'csv',
  notes = '',
}) {
  const ids = [...new Set((invoiceIds || []).map(String).filter(Boolean))];
  if (!ids.length) {
    const err = new Error('Select at least one vendor bill');
    err.status = 400;
    throw err;
  }

  const bills = await Invoice.find({
    _id: { $in: ids },
    tenantId,
    flow: 'purchase',
    invoiceType: '388',
    status: { $nin: ['draft', 'cancelled'] },
  }).lean();

  if (!bills.length) {
    const err = new Error('No payable vendor bills found');
    err.status = 400;
    throw err;
  }

  const supplierIds = [...new Set(bills.map((b) => String(b.supplierId || '')).filter(Boolean))];
  const partners = supplierIds.length
    ? await Partner.find({ _id: { $in: supplierIds }, tenantId })
      .select('nameEn name nameAr bankAccounts bank')
      .lean()
    : [];
  const partnerById = new Map(partners.map((p) => [String(p._id), p]));

  const lines = [];
  for (const bill of bills) {
    const remaining = round2(Math.max(0, Number(bill.grandTotal || 0) - Number(bill.paidAmount || 0)));
    if (remaining <= 0) continue;
    const partner = bill.supplierId ? partnerById.get(String(bill.supplierId)) : null;
    const iban = partnerIban(partner);
    lines.push({
      invoiceId: bill._id,
      invoiceNumber: bill.invoiceNumber || '',
      vendorId: bill.supplierId || null,
      vendorName: partnerName(partner, bill),
      iban,
      amount: remaining,
      currency: bill.currency || 'SAR',
      reference: bill.contractNumber || bill.invoiceNumber || String(bill._id),
    });
  }

  if (!lines.length) {
    const err = new Error('Selected bills have no outstanding balance');
    err.status = 400;
    throw err;
  }

  const totalAmount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const number = await nextBatchNumber(tenantId);

  const batch = await PaymentBatch.create({
    tenantId,
    number,
    status: 'draft',
    format: format === 'sepa' ? 'sepa' : 'csv',
    executionDate: executionDate ? new Date(executionDate) : new Date(),
    currency: lines[0]?.currency || 'SAR',
    totalAmount,
    lineCount: lines.length,
    lines,
    notes: String(notes || '').slice(0, 500),
    createdBy: userId || null,
  });

  return batch.toObject ? batch.toObject() : batch;
}

export async function listPaymentBatches(tenantId, { status, page = 1, limit = 25 } = {}) {
  const filter = { tenantId };
  if (status) filter.status = status;
  const skip = (Math.max(1, Number(page) || 1) - 1) * Math.min(100, Math.max(1, Number(limit) || 25));
  const lim = Math.min(100, Math.max(1, Number(limit) || 25));
  const [rows, total] = await Promise.all([
    PaymentBatch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    PaymentBatch.countDocuments(filter),
  ]);
  return {
    batches: rows,
    pagination: { page: Math.max(1, Number(page) || 1), limit: lim, total, pages: Math.ceil(total / lim) || 1 },
  };
}

export async function getPaymentBatch(tenantId, batchId) {
  const batch = await PaymentBatch.findOne({ _id: batchId, tenantId }).lean();
  if (!batch) {
    const err = new Error('Payment batch not found');
    err.status = 404;
    throw err;
  }
  return batch;
}

/**
 * Build generic CSV: vendor_name, iban, amount, reference (+ invoice_number for audit).
 * Marks batch as exported.
 */
export async function exportPaymentBatchCsv(tenantId, batchId) {
  const batch = await PaymentBatch.findOne({ _id: batchId, tenantId });
  if (!batch) {
    const err = new Error('Payment batch not found');
    err.status = 404;
    throw err;
  }
  if (batch.status === 'cancelled') {
    const err = new Error('Cannot export a cancelled batch');
    err.status = 400;
    throw err;
  }

  const header = ['vendor_name', 'iban', 'amount', 'reference', 'invoice_number', 'currency'];
  const rows = (batch.lines || []).map((line) => [
    csvEscape(line.vendorName),
    csvEscape(normalizeIban(line.iban)),
    csvEscape(round2(line.amount).toFixed(2)),
    csvEscape(line.reference),
    csvEscape(line.invoiceNumber),
    csvEscape(line.currency || batch.currency || 'SAR'),
  ].join(','));

  const csv = `\uFEFF${header.join(',')}\n${rows.join('\n')}\n`;
  const filename = `payment-batch-${batch.number}-${new Date().toISOString().slice(0, 10)}.csv`;

  batch.status = 'exported';
  batch.exportedAt = new Date();
  batch.exportFilename = filename;
  batch.format = 'csv';
  await batch.save();

  return {
    csv,
    filename,
    batch: batch.toObject(),
    contentType: 'text/csv; charset=utf-8',
  };
}

/**
 * Mark batch confirmed after bank statement match.
 */
export async function confirmPaymentBatch(tenantId, batchId, userId = null) {
  const batch = await PaymentBatch.findOne({ _id: batchId, tenantId });
  if (!batch) {
    const err = new Error('Payment batch not found');
    err.status = 404;
    throw err;
  }
  if (batch.status === 'cancelled') {
    const err = new Error('Cannot confirm a cancelled batch');
    err.status = 400;
    throw err;
  }
  if (batch.status === 'draft') {
    const err = new Error('Export the batch before confirming');
    err.status = 400;
    throw err;
  }

  batch.status = 'confirmed';
  batch.confirmedAt = new Date();
  batch.confirmedBy = userId || null;
  await batch.save();
  return batch.toObject();
}

export async function cancelPaymentBatch(tenantId, batchId) {
  const batch = await PaymentBatch.findOne({ _id: batchId, tenantId });
  if (!batch) {
    const err = new Error('Payment batch not found');
    err.status = 404;
    throw err;
  }
  if (batch.status === 'confirmed') {
    const err = new Error('Cannot cancel a confirmed batch');
    err.status = 400;
    throw err;
  }
  batch.status = 'cancelled';
  await batch.save();
  return batch.toObject();
}

export default {
  createPaymentBatch,
  listPaymentBatches,
  getPaymentBatch,
  exportPaymentBatchCsv,
  confirmPaymentBatch,
  cancelPaymentBatch,
};
