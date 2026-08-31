import Invoice from '../models/Invoice.js';
import Partner from '../models/Partner.js';
import Tenant from '../models/Tenant.js';
import { roundMoney } from '../utils/money.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function pickTopVote(votes = {}) {
  let best = null;
  let bestCount = 0;
  for (const [id, count] of Object.entries(votes)) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

const EXPENSE_ROLES = new Set(['expense', 'cogs', 'inventory', 'opex', 'stock', '']);

function isExpenseLine(line = {}) {
  const role = String(line.role || '').toLowerCase();
  if (role === 'ap' || role === 'vat_input' || role === 'vatinput') return false;
  if (EXPENSE_ROLES.has(role) || !role) return Number(line.debit) > 0;
  return false;
}

/**
 * Analyze historical vendor bills and predict GL accounts for new lines.
 */
export async function predictVendorLineAccounts(tenantId, supplierId) {
  if (!tenantId || !supplierId) {
    return { defaultAccountId: null, byProduct: {}, sampleSize: 0 };
  }

  const bills = await Invoice.find({
    tenantId,
    flow: 'purchase',
    invoiceType: '388',
    supplierId,
    status: { $nin: ['draft', 'cancelled'] },
  })
    .sort({ issueDate: -1 })
    .limit(40)
    .select('lineItems accountingLines')
    .lean();

  const globalVotes = {};
  const byProduct = {};

  for (const bill of bills) {
    const expenseLines = (bill.accountingLines || []).filter(isExpenseLine);
    for (const acct of expenseLines) {
      const id = String(acct.accountId || '');
      if (!id) continue;
      globalVotes[id] = (globalVotes[id] || 0) + 1;
    }

    for (const line of bill.lineItems || []) {
      const pid = String(line.productId || '');
      if (!pid || !expenseLines.length) continue;
      const acct = expenseLines[0];
      const accountId = String(acct?.accountId || '');
      if (!accountId) continue;
      if (!byProduct[pid]) byProduct[pid] = {};
      byProduct[pid][accountId] = (byProduct[pid][accountId] || 0) + 1;
    }
  }

  const byProductResolved = {};
  for (const [pid, votes] of Object.entries(byProduct)) {
    byProductResolved[pid] = pickTopVote(votes);
  }

  return {
    defaultAccountId: pickTopVote(globalVotes),
    byProduct: byProductResolved,
    sampleSize: bills.length,
  };
}

/** AP stats for vendor master-data stat buttons. */
export async function getVendorApStats(tenantId, supplierId) {
  if (!tenantId || !supplierId) {
    return { billCount: 0, billedTotal: 0, paidTotal: 0, outstanding: 0, refundCount: 0 };
  }

  const match = {
    tenantId,
    flow: 'purchase',
    supplierId,
    status: { $nin: ['cancelled'] },
  };

  const [billAgg, refundAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { ...match, invoiceType: '388' } },
      {
        $group: {
          _id: null,
          billCount: { $sum: 1 },
          billedTotal: { $sum: '$grandTotal' },
          paidTotal: { $sum: '$paidAmount' },
        },
      },
    ]),
    Invoice.countDocuments({ ...match, invoiceType: '381' }),
  ]);

  const row = billAgg[0] || {};
  const billedTotal = round2(row.billedTotal || 0);
  const paidTotal = round2(row.paidTotal || 0);

  return {
    billCount: row.billCount || 0,
    billedTotal,
    paidTotal,
    outstanding: round2(Math.max(0, billedTotal - paidTotal)),
    refundCount: refundAgg || 0,
  };
}

/** AR stats for customer master-data stat buttons. */
export async function getCustomerArStats(tenantId, customerId) {
  if (!tenantId || !customerId) {
    return { invoiceCount: 0, invoicedTotal: 0, paidTotal: 0, outstanding: 0, creditNoteCount: 0 };
  }

  const match = {
    tenantId,
    flow: 'sell',
    customerId,
    status: { $nin: ['cancelled'] },
  };

  const [invoiceAgg, creditNoteAgg] = await Promise.all([
    Invoice.aggregate([
      { $match: { ...match, invoiceType: '388' } },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          invoicedTotal: { $sum: '$grandTotal' },
          paidTotal: { $sum: '$paidAmount' },
        },
      },
    ]),
    Invoice.countDocuments({ ...match, invoiceType: '381' }),
  ]);

  const row = invoiceAgg[0] || {};
  const invoicedTotal = round2(row.invoicedTotal || 0);
  const paidTotal = round2(row.paidTotal || 0);

  return {
    invoiceCount: row.invoiceCount || 0,
    invoicedTotal,
    paidTotal,
    outstanding: round2(Math.max(0, invoicedTotal - paidTotal)),
    creditNoteCount: creditNoteAgg || 0,
  };
}

/** Purchase stats for product master-data stat buttons. */
export async function getProductApStats(tenantId, productId) {
  if (!tenantId || !productId) {
    return { billCount: 0, qtyPurchased: 0, totalSpent: 0, lastBillDate: null };
  }

  const pid = String(productId);
  const bills = await Invoice.find({
    tenantId,
    flow: 'purchase',
    invoiceType: '388',
    status: { $nin: ['draft', 'cancelled'] },
    'lineItems.productId': productId,
  })
    .select('issueDate lineItems grandTotal')
    .lean();

  let qtyPurchased = 0;
  let totalSpent = 0;
  let lastBillDate = null;

  for (const bill of bills) {
    if (bill.issueDate && (!lastBillDate || new Date(bill.issueDate) > new Date(lastBillDate))) {
      lastBillDate = bill.issueDate;
    }
    for (const line of bill.lineItems || []) {
      if (String(line.productId || '') !== pid) continue;
      qtyPurchased += Math.abs(Number(line.quantity || 0));
      totalSpent += Math.abs(Number(line.lineTotalWithTax ?? line.lineTotal ?? 0));
    }
  }

  return {
    billCount: bills.length,
    qtyPurchased: round2(qtyPurchased),
    totalSpent: round2(totalSpent),
    lastBillDate,
  };
}

/** Sales stats for product master-data stat buttons. */
export async function getProductArStats(tenantId, productId) {
  if (!tenantId || !productId) {
    return { invoiceCount: 0, qtySold: 0, totalRevenue: 0, lastInvoiceDate: null };
  }

  const pid = String(productId);
  const invoices = await Invoice.find({
    tenantId,
    flow: 'sell',
    invoiceType: '388',
    status: { $nin: ['draft', 'cancelled'] },
    'lineItems.productId': productId,
  })
    .select('issueDate lineItems grandTotal')
    .lean();

  let qtySold = 0;
  let totalRevenue = 0;
  let lastInvoiceDate = null;

  for (const inv of invoices) {
    if (inv.issueDate && (!lastInvoiceDate || new Date(inv.issueDate) > new Date(lastInvoiceDate))) {
      lastInvoiceDate = inv.issueDate;
    }
    for (const line of inv.lineItems || []) {
      if (String(line.productId || '') !== pid) continue;
      qtySold += Math.abs(Number(line.quantity || 0));
      totalRevenue += Math.abs(Number(line.lineTotalWithTax ?? line.lineTotal ?? 0));
    }
  }

  return {
    invoiceCount: invoices.length,
    qtySold: round2(qtySold),
    totalRevenue: round2(totalRevenue),
    lastInvoiceDate,
  };
}

function escapeXml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSepaDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a simplified ISO 20022 pain.001.001.03 SEPA Credit Transfer file for vendor bills.
 */
export async function buildSepaCreditTransferXml(tenantId, invoiceIds = [], options = {}) {
  const ids = [...new Set((invoiceIds || []).map(String).filter(Boolean))];
  if (!ids.length) throw new Error('Select at least one vendor bill');

  const tenant = await Tenant.findById(tenantId).select('name business settings').lean();
  const bills = await Invoice.find({
    _id: { $in: ids },
    tenantId,
    flow: 'purchase',
    invoiceType: '388',
    status: { $nin: ['draft', 'cancelled'] },
  }).lean();

  if (!bills.length) throw new Error('No payable vendor bills found');

  const supplierIds = [...new Set(bills.map((b) => String(b.supplierId || '')).filter(Boolean))];
  const partners = supplierIds.length
    ? await Partner.find({ _id: { $in: supplierIds }, tenantId }).select('nameEn name nameAr bankAccounts bank').lean()
    : [];
  const partnerById = new Map(partners.map((p) => [String(p._id), p]));

  const executionDate = formatSepaDate(options.executionDate || new Date());
  const msgId = `SEPA-${Date.now()}`;
  const sepaCfg = tenant?.settings?.accounting?.sepa || {};
  const debtorName = escapeXml(
    sepaCfg.debtorName
    || tenant?.business?.legalNameEn
    || tenant?.name
    || 'Company',
  );
  const debtorIban = escapeXml(
    sepaCfg.debtorIban
    || tenant?.business?.bankIban
    || '',
  );
  const debtorBic = escapeXml(sepaCfg.debtorBic || '');
  if (!debtorIban) {
    throw new Error('Configure company SEPA debtor IBAN in Accounting → Default accounts before exporting');
  }

  let ctrlSum = 0;
  const txBlocks = [];

  for (const bill of bills) {
    const remaining = round2(Math.max(0, Number(bill.grandTotal || 0) - Number(bill.paidAmount || 0)));
    if (remaining <= 0) continue;

    const partner = bill.supplierId ? partnerById.get(String(bill.supplierId)) : null;
    const bank = partner?.bankAccounts?.find((b) => b.isDefault) || partner?.bankAccounts?.[0] || partner?.bank || {};
    const creditorIban = escapeXml(bank.iban || '');
    const creditorName = escapeXml(partner?.nameEn || partner?.name || bill.seller?.name || 'Vendor');
    const endToEndId = escapeXml(bill.invoiceNumber || String(bill._id));
    const amount = remaining.toFixed(2);

    ctrlSum += remaining;
    txBlocks.push(`
        <CdtTrfTxInf>
          <PmtId><EndToEndId>${endToEndId}</EndToEndId></PmtId>
          <Amt><InstdAmt Ccy="${escapeXml(bill.currency || 'SAR')}">${amount}</InstdAmt></Amt>
          <CdtrAgt><FinInstnId><BIC>${escapeXml(bank.swift || 'NOTPROVIDED')}</BIC></FinInstnId></CdtrAgt>
          <Cdtr><Nm>${creditorName}</Nm></Cdtr>
          <CdtrAcct><Id><IBAN>${creditorIban || 'NOTPROVIDED'}</IBAN></Id></CdtrAcct>
          <RmtInf><Ustrd>${escapeXml(bill.contractNumber || bill.invoiceNumber || '')}</Ustrd></RmtInf>
        </CdtTrfTxInf>`);
  }

  if (!txBlocks.length) throw new Error('Selected bills have no outstanding balance');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${txBlocks.length}</NbOfTxs>
      <CtrlSum>${ctrlSum.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${debtorName}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${txBlocks.length}</NbOfTxs>
      <CtrlSum>${ctrlSum.toFixed(2)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${executionDate}</ReqdExctnDt>
      <Dbtr><Nm>${debtorName}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${debtorIban}</IBAN></Id></DbtrAcct>
      ${debtorBic ? `<DbtrAgt><FinInstnId><BIC>${debtorBic}</BIC></FinInstnId></DbtrAgt>` : ''}
      ${txBlocks.join('\n')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return {
    xml,
    filename: `sepa-vendor-payments-${executionDate}.xml`,
    transactionCount: txBlocks.length,
    totalAmount: round2(ctrlSum),
    invoiceIds: bills.map((b) => String(b._id)),
  };
}

/** Stamp SEPA export metadata after a successful pain.001 download. */
export async function markSepaExported(tenantId, invoiceIds = [], { filename = '' } = {}) {
  const ids = [...new Set((invoiceIds || []).map(String).filter(Boolean))];
  if (!ids.length) return { updated: 0 };
  const result = await Invoice.updateMany(
    {
      _id: { $in: ids },
      tenantId,
      flow: 'purchase',
    },
    {
      $set: {
        'sepaExport.exportedAt': new Date(),
        'sepaExport.filename': String(filename || '').slice(0, 200),
      },
    },
  );
  return { updated: result.modifiedCount || 0 };
}

/** Mark bills as uploaded to the bank portal after the user confirms. */
export async function markSepaUploadedToBank(tenantId, invoiceIds = []) {
  const ids = [...new Set((invoiceIds || []).map(String).filter(Boolean))];
  if (!ids.length) throw new Error('Select at least one vendor bill');
  const result = await Invoice.updateMany(
    {
      _id: { $in: ids },
      tenantId,
      flow: 'purchase',
    },
    {
      $set: {
        'sepaExport.markedUploadedAt': new Date(),
      },
    },
  );
  return { updated: result.modifiedCount || 0 };
}

/**
 * Atomically allocate the next vendor check number for a tenant.
 * Returns { checkNumber, nextNumber }.
 */
export async function allocateNextCheckNumber(tenantId) {
  const tenant = await Tenant.findByIdAndUpdate(
    tenantId,
    {
      $inc: { 'settings.accounting.checkPrint.nextNumber': 1 },
      $setOnInsert: {
        'settings.accounting.checkPrint.prefix': 'CHK',
      },
    },
    { new: true, upsert: false },
  ).select('settings.accounting.checkPrint').lean();

  if (!tenant) throw new Error('Tenant not found');

  const cfg = tenant.settings?.accounting?.checkPrint || {};
  const used = Math.max(1, Number(cfg.nextNumber || 1002) - 1);
  const prefix = String(cfg.prefix || 'CHK').trim() || 'CHK';
  return {
    checkNumber: `${prefix}-${String(used).padStart(6, '0')}`,
    nextNumber: Number(cfg.nextNumber || used + 1),
    prefix,
    micrRouting: cfg.micrRouting || '',
    micrAccount: cfg.micrAccount || '',
  };
}

/** Printable check payload for AP disbursements. */
export function buildCheckPrintPayload({
  tenant = {},
  payeeName = '',
  amount = 0,
  currency = 'SAR',
  memo = '',
  checkNumber = '',
  paymentDate = new Date(),
  micrRouting = '',
  micrAccount = '',
}) {
  const company = tenant?.business?.legalNameEn || tenant?.name || 'Company';
  const amountWords = `${Number(amount || 0).toFixed(2)} ${currency}`;
  const checkCfg = tenant?.settings?.accounting?.checkPrint || {};
  return {
    company,
    companyAddress: tenant?.business?.address?.street || '',
    payeeName: String(payeeName || '').trim() || 'Payee',
    amount: round2(amount),
    amountWords,
    currency,
    memo: String(memo || '').trim(),
    checkNumber: String(checkNumber || '').trim() || `CHK-${Date.now()}`,
    date: paymentDate instanceof Date ? paymentDate.toISOString().slice(0, 10) : formatSepaDate(paymentDate),
    printedAt: new Date().toISOString(),
    micrRouting: String(micrRouting || checkCfg.micrRouting || '').trim(),
    micrAccount: String(micrAccount || checkCfg.micrAccount || '').trim(),
  };
}

export function buildCheckPrintHtml(payload = {}) {
  const p = payload;
  const micrParts = [
    p.checkNumber ? `⑆${p.checkNumber}⑆` : '',
    p.micrRouting ? `⑈${p.micrRouting}⑈` : '',
    p.micrAccount ? `⑆${p.micrAccount}⑆` : '',
  ].filter(Boolean);
  const micrLine = micrParts.join('  ');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Check ${escapeXml(p.checkNumber)}</title>
<style>
  body { font-family: 'Courier New', monospace; margin: 0; padding: 24px; color: #111; }
  .check { width: 800px; border: 2px solid #111; padding: 24px 28px 18px; position: relative; }
  .row { display: flex; justify-content: space-between; margin: 12px 0; }
  .amount { font-size: 22px; font-weight: bold; }
  .micr { margin-top: 28px; padding-top: 10px; border-top: 1px dashed #999; font-size: 18px; letter-spacing: 2px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head><body>
  <div class="check">
    <div class="row"><strong>${escapeXml(p.company)}</strong><span>${escapeXml(p.date)}</span></div>
    <div class="row"><span>Pay to the order of</span><span># ${escapeXml(p.checkNumber)}</span></div>
    <div style="font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 4px;">${escapeXml(p.payeeName)}</div>
    <div class="row amount"><span>${escapeXml(p.currency)} ${Number(p.amount || 0).toFixed(2)}</span></div>
    <div>${escapeXml(p.amountWords)}</div>
    <div style="margin-top: 16px;">Memo: ${escapeXml(p.memo)}</div>
    ${micrLine ? `<div class="micr">${escapeXml(micrLine)}</div>` : ''}
  </div>
  <p class="no-print"><button onclick="window.print()">Print</button></p>
</body></html>`;
}

export async function getApPaymentSettings(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.sepa settings.accounting.checkPrint settings.accounting.useOutstandingPayments business').lean();
  const sepa = tenant?.settings?.accounting?.sepa || {};
  const checkPrint = tenant?.settings?.accounting?.checkPrint || {};
  return {
    sepa: {
      debtorIban: sepa.debtorIban || tenant?.business?.bankIban || '',
      debtorBic: sepa.debtorBic || '',
      debtorName: sepa.debtorName || '',
    },
    checkPrint: {
      prefix: checkPrint.prefix || 'CHK',
      nextNumber: Number(checkPrint.nextNumber || 1001),
      micrRouting: checkPrint.micrRouting || '',
      micrAccount: checkPrint.micrAccount || '',
    },
    useOutstandingPayments: tenant?.settings?.accounting?.useOutstandingPayments !== false,
  };
}

export async function setApPaymentSettings(tenantId, patch = {}) {
  const update = {};
  if (patch.sepa && typeof patch.sepa === 'object') {
    if (patch.sepa.debtorIban !== undefined) update['settings.accounting.sepa.debtorIban'] = String(patch.sepa.debtorIban || '').trim();
    if (patch.sepa.debtorBic !== undefined) update['settings.accounting.sepa.debtorBic'] = String(patch.sepa.debtorBic || '').trim().toUpperCase();
    if (patch.sepa.debtorName !== undefined) update['settings.accounting.sepa.debtorName'] = String(patch.sepa.debtorName || '').trim();
  }
  if (patch.checkPrint && typeof patch.checkPrint === 'object') {
    if (patch.checkPrint.prefix !== undefined) update['settings.accounting.checkPrint.prefix'] = String(patch.checkPrint.prefix || 'CHK').trim() || 'CHK';
    if (patch.checkPrint.nextNumber !== undefined) {
      const n = Number(patch.checkPrint.nextNumber);
      if (!Number.isFinite(n) || n < 1) throw new Error('checkPrint.nextNumber must be a positive number');
      update['settings.accounting.checkPrint.nextNumber'] = Math.floor(n);
    }
    if (patch.checkPrint.micrRouting !== undefined) update['settings.accounting.checkPrint.micrRouting'] = String(patch.checkPrint.micrRouting || '').trim();
    if (patch.checkPrint.micrAccount !== undefined) update['settings.accounting.checkPrint.micrAccount'] = String(patch.checkPrint.micrAccount || '').trim();
  }
  if (patch.useOutstandingPayments !== undefined) {
    update['settings.accounting.useOutstandingPayments'] = Boolean(patch.useOutstandingPayments);
  }
  if (Object.keys(update).length) {
    await Tenant.findByIdAndUpdate(tenantId, { $set: update });
  }
  return getApPaymentSettings(tenantId);
}

export async function getArPaymentSettings(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.useOutstandingReceipts').lean();
  return {
    useOutstandingReceipts: tenant?.settings?.accounting?.useOutstandingReceipts !== false,
  };
}

export async function setArPaymentSettings(tenantId, patch = {}) {
  const update = {};
  if (patch.useOutstandingReceipts !== undefined) {
    update['settings.accounting.useOutstandingReceipts'] = Boolean(patch.useOutstandingReceipts);
  }
  if (Object.keys(update).length) {
    await Tenant.findByIdAndUpdate(tenantId, { $set: update });
  }
  return getArPaymentSettings(tenantId);
}

export default {
  predictVendorLineAccounts,
  getVendorApStats,
  getCustomerArStats,
  getProductApStats,
  getProductArStats,
  buildSepaCreditTransferXml,
  markSepaExported,
  markSepaUploadedToBank,
  allocateNextCheckNumber,
  buildCheckPrintPayload,
  buildCheckPrintHtml,
  getApPaymentSettings,
  setApPaymentSettings,
  getArPaymentSettings,
  setArPaymentSettings,
};
