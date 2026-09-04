/**
 * Customer Statement of Account — balances from shared getPartnerBalances (GL 1200).
 * Period lines = posted AR control journal movements for the partner.
 */
import mongoose from 'mongoose';
import Partner from '../../models/Partner.js';
import Tenant from '../../models/Tenant.js';
import ChartOfAccount from '../../models/ChartOfAccount.js';
import JournalEntry from '../../models/JournalEntry.js';
import { getPartnerBalances, journalStatusMatch } from '../ledger/balances.js';
import { extractDateOnly } from '../../utils/dateOnly.js';
import { sendTenantEmail } from '../../utils/tenantEmailService.js';
import { tenantHasEmailAddon } from '../../middleware/auth.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function endOfDay(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfDay(d) {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayBefore(d) {
  const x = startOfDay(d);
  if (!x) return null;
  x.setDate(x.getDate() - 1);
  return endOfDay(x);
}

function formatDateEn(value) {
  const only = extractDateOnly(value);
  if (!only) return '—';
  const [y, m, d] = only.split('-');
  return `${d}/${m}/${y}`;
}

function partnerOpenResidual(balances, partnerId) {
  const row = (balances?.partners || []).find((p) => String(p.partnerId) === String(partnerId));
  return round2(row?.openResidual || 0);
}

function partnerAging(balances, partnerId) {
  const row = (balances?.partners || []).find((p) => String(p.partnerId) === String(partnerId));
  return row?.aging || {
    d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, d90plus: 0, total: 0,
  };
}

function classifyDoc({ type, sourceModel, sourceNumber, entryNumber, memo }) {
  const src = String(sourceModel || '').toLowerCase();
  const num = String(sourceNumber || entryNumber || '').trim();
  const upper = num.toUpperCase();
  let docType = 'JE';
  let labelEn = 'Journal';
  let labelAr = 'قيد';
  if (src.includes('invoice') || type === 'invoice' || upper.startsWith('INV') || upper.startsWith('CN')) {
    if (upper.startsWith('CN') || String(memo || '').toLowerCase().includes('credit')) {
      docType = 'CN';
      labelEn = 'Credit note';
      labelAr = 'إشعار دائن';
    } else {
      docType = 'INV';
      labelEn = 'Invoice';
      labelAr = 'فاتورة';
    }
  } else if (src.includes('payment') || type === 'payment' || upper.startsWith('RV') || upper.startsWith('PAY') || upper.startsWith('REC')) {
    docType = 'RV';
    labelEn = 'Receipt';
    labelAr = 'سند قبض';
  } else if (type === 'voucher' || src.includes('voucher')) {
    docType = 'RV';
    labelEn = 'Receipt';
    labelAr = 'سند قبض';
  }
  return {
    documentType: docType,
    documentNumber: num || entryNumber || '—',
    descriptionEn: labelEn,
    descriptionAr: labelAr,
  };
}

/**
 * Posted AR (1200) journal lines for one customer in [from, to].
 */
async function fetchPartnerArMovements(tenantId, customerId, from, to) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const pid = new mongoose.Types.ObjectId(String(customerId));
  const control = await ChartOfAccount.find({ tenantId: tid, code: '1200', isActive: true })
    .select('_id')
    .lean();
  if (!control.length) return [];

  const accountIds = control.map((a) => a._id);
  const fromD = startOfDay(from);
  const toD = endOfDay(to);

  const match = {
    tenantId: tid,
    ...journalStatusMatch({ includeDraft: false, includeReversed: false, includeVoid: false }),
  };
  if (fromD || toD) {
    match.entryDate = {};
    if (fromD) match.entryDate.$gte = fromD;
    if (toD) match.entryDate.$lte = toD;
  }

  const rows = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $match: {
        'lines.accountId': { $in: accountIds },
        'lines.partnerId': pid,
      },
    },
    {
      $project: {
        entryDate: 1,
        entryNumber: 1,
        type: 1,
        memo: 1,
        memoAr: 1,
        reference: 1,
        sourceModel: 1,
        sourceNumber: 1,
        sourceId: 1,
        debit: { $ifNull: ['$lines.debit', 0] },
        credit: { $ifNull: ['$lines.credit', 0] },
        lineDescription: '$lines.description',
      },
    },
    { $sort: { entryDate: 1, entryNumber: 1 } },
  ]);

  return rows;
}

/**
 * @returns Statement payload with opening/closing from getPartnerBalances and aging.
 */
export async function buildCustomerStatement({
  tenantId,
  customerId,
  startDate,
  endDate,
} = {}) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!customerId) throw new Error('customerId is required');

  const customer = await Partner.findOne({ _id: customerId, tenantId })
    .select('name nameEn nameAr email phone mobile vatNumber crNumber address customerCode contactPerson')
    .lean();
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const tenant = await Tenant.findById(tenantId)
    .select('name business branding settings')
    .lean();

  const start = startOfDay(startDate) || startOfDay('1970-01-01');
  const end = endOfDay(endDate) || endOfDay(new Date());
  const openingAsOf = dayBefore(start);
  const isAllTime = !startDate || extractDateOnly(start) <= '1970-01-02';

  const [openingBalances, closingBalances, movements] = await Promise.all([
    isAllTime
      ? Promise.resolve({ partners: [] })
      : getPartnerBalances({
        tenantId,
        partnerType: 'customer',
        partnerIds: [customerId],
        asOf: openingAsOf,
      }),
    getPartnerBalances({
      tenantId,
      partnerType: 'customer',
      partnerIds: [customerId],
      asOf: end,
    }),
    fetchPartnerArMovements(tenantId, customerId, start, end),
  ]);

  const openingBalance = isAllTime ? 0 : partnerOpenResidual(openingBalances, customerId);
  const closingBalance = partnerOpenResidual(closingBalances, customerId);
  const aging = partnerAging(closingBalances, customerId);
  const directoryReceivable = closingBalance;
  const agedArTotal = round2(aging.total || aging.d0_30 + aging.d31_60 + aging.d61_90 + aging.d90_plus);

  const statement = [];
  let running = openingBalance;
  statement.push({
    type: 'opening',
    id: 'OPEN',
    documentType: 'OPEN',
    documentNumber: 'OPEN',
    date: start,
    debit: openingBalance > 0 ? openingBalance : 0,
    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    desc: 'Opening Balance',
    descriptionEn: 'Opening balance',
    descriptionAr: 'رصيد افتتاحي',
    balance: running,
  });

  for (const mov of movements) {
    const debit = round2(mov.debit);
    const credit = round2(mov.credit);
    if (debit < 0.005 && credit < 0.005) continue;
    running = round2(running + debit - credit);
    const classified = classifyDoc(mov);
    const descEn = mov.lineDescription || mov.memo || classified.descriptionEn;
    const descAr = mov.memoAr || classified.descriptionAr;
    statement.push({
      type: classified.documentType.toLowerCase(),
      id: classified.documentNumber,
      documentType: classified.documentType,
      documentNumber: classified.documentNumber,
      date: mov.entryDate,
      debit,
      credit,
      desc: descEn,
      descriptionEn: descEn,
      descriptionAr: descAr,
      balance: running,
      sourceModel: mov.sourceModel || '',
      sourceId: mov.sourceId || null,
      entryNumber: mov.entryNumber,
    });
  }

  const computedClosing = statement.length
    ? round2(statement[statement.length - 1].balance)
    : openingBalance;

  // Prefer GL closing; flag if movement rebuild diverges (e.g. missing partner tags on old JE)
  const balancesMatch = Math.abs(computedClosing - closingBalance) < 0.02;
  const consistent = Math.abs(closingBalance - directoryReceivable) < 0.02
    && Math.abs(closingBalance - agedArTotal) < 0.02;

  const bank = tenant?.business?.bankDetails || {};

  return {
    customer: {
      _id: customer._id,
      name: customer.name || customer.nameEn || '',
      nameEn: customer.nameEn || customer.name || '',
      nameAr: customer.nameAr || '',
      email: customer.email || customer.contactPerson?.email || '',
      phone: customer.mobile || customer.phone || customer.contactPerson?.phone || '',
      vatNumber: customer.vatNumber || '',
      crNumber: customer.crNumber || '',
      customerCode: customer.customerCode || '',
      address: customer.address || {},
    },
    company: {
      nameEn: tenant?.business?.legalNameEn || tenant?.name || '',
      nameAr: tenant?.business?.legalNameAr || '',
      vatNumber: tenant?.business?.vatNumber || '',
      crNumber: tenant?.business?.crNumber || '',
      address: tenant?.business?.address || {},
      phone: tenant?.business?.phone || '',
      email: tenant?.business?.email || '',
    },
    bankDetails: {
      bankName: bank.bankName || '',
      accountName: bank.accountName || '',
      accountNumber: bank.accountNumber || '',
      iban: bank.iban || '',
    },
    period: {
      startDate: extractDateOnly(start),
      endDate: extractDateOnly(end),
      openingAsOf: isAllTime ? null : extractDateOnly(openingAsOf),
    },
    openingBalance,
    closingBalance,
    totalBalance: closingBalance,
    computedClosingFromLines: computedClosing,
    balancesMatch,
    aging: {
      d0_30: round2(aging.d0_30 || 0),
      d31_60: round2(aging.d31_60 || 0),
      d61_90: round2(aging.d61_90 || 0),
      d90_plus: round2(aging.d90_plus || aging.d90plus || 0),
      total: agedArTotal,
    },
    consistency: {
      closingBalance,
      directoryReceivable,
      agedArTotal,
      match: consistent,
    },
    statement,
    currency: tenant?.settings?.currency || 'SAR',
  };
}

function sanitizeFileName(value) {
  return String(value || 'statement').replace(/[^\w.\-]+/g, '_').slice(0, 80);
}

/**
 * Lightweight bilingual PDF (jsPDF when available).
 */
export async function buildCustomerStatementPdfBuffer(statementData, { language = 'bilingual' } = {}) {
  let jsPDF = null;
  try {
    const mod = await import('jspdf');
    jsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default;
  } catch {
    jsPDF = null;
  }

  const lines = [];
  const co = statementData.company || {};
  const cu = statementData.customer || {};
  const period = statementData.period || {};
  lines.push('STATEMENT OF ACCOUNT / كشف حساب');
  lines.push(`${co.nameEn || ''} | ${co.nameAr || ''}`);
  if (co.vatNumber) lines.push(`VAT / الرقم الضريبي: ${co.vatNumber}`);
  lines.push(`Customer / العميل: ${cu.nameEn || cu.name || ''} | ${cu.nameAr || ''}`);
  if (cu.vatNumber) lines.push(`Customer VAT: ${cu.vatNumber}`);
  lines.push(`Period / الفترة: ${period.startDate || ''} — ${period.endDate || ''}`);
  lines.push(`Opening / افتتاحي: ${Number(statementData.openingBalance || 0).toFixed(2)}`);
  lines.push('---');
  for (const row of statementData.statement || []) {
    lines.push(
      `${formatDateEn(row.date)} | ${row.documentNumber || row.id || ''} | ${(row.descriptionEn || row.desc || '').slice(0, 40)} | Dr ${Number(row.debit || 0).toFixed(2)} | Cr ${Number(row.credit || 0).toFixed(2)} | Bal ${Number(row.balance || 0).toFixed(2)}`,
    );
  }
  lines.push('---');
  lines.push(`Closing / إقفال: ${Number(statementData.closingBalance || 0).toFixed(2)}`);
  const ag = statementData.aging || {};
  lines.push(`Aging 0-30: ${Number(ag.d0_30 || 0).toFixed(2)} | 31-60: ${Number(ag.d31_60 || 0).toFixed(2)} | 61-90: ${Number(ag.d61_90 || 0).toFixed(2)} | 90+: ${Number(ag.d90_plus || 0).toFixed(2)} | Total: ${Number(ag.total || 0).toFixed(2)}`);
  const bank = statementData.bankDetails || {};
  if (bank.bankName || bank.iban) {
    lines.push(`Bank / البنك: ${bank.bankName || ''} | ${bank.accountName || ''} | ${bank.iban || bank.accountNumber || ''}`);
  }

  if (!jsPDF) {
    // Minimal PDF text fallback
    const escape = (t) => String(t).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const ops = ['BT', '/F1 9 Tf', '40 800 Td', '12 TL'];
    lines.slice(0, 60).forEach((line, i) => {
      if (i) ops.push('T*');
      ops.push(`(${escape(line.slice(0, 110))}) Tj`);
    });
    ops.push('ET');
    const content = `${ops.join('\n')}\n`;
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
      `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream\nendobj\n`,
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ];
    let output = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object) => {
      offsets.push(Buffer.byteLength(output, 'utf8'));
      output += object;
    });
    const xrefOffset = Buffer.byteLength(output, 'utf8');
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) {
      output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(output, 'utf8');
  }

  void language;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Statement of Account', margin, y);
  doc.text('كشف حساب', pageWidth - margin, y, { align: 'right' });
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(co.nameEn || '', margin, y);
  if (co.nameAr) doc.text(co.nameAr, pageWidth - margin, y, { align: 'right' });
  y += 14;
  doc.text(`VAT: ${co.vatNumber || '—'}`, margin, y);
  doc.text(`الرقم الضريبي: ${co.vatNumber || '—'}`, pageWidth - margin, y, { align: 'right' });
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text(cu.nameEn || cu.name || '', margin, y);
  if (cu.nameAr) doc.text(cu.nameAr, pageWidth - margin, y, { align: 'right' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${period.startDate} — ${period.endDate}`, margin, y);
  y += 16;
  doc.text(`Opening: ${Number(statementData.openingBalance || 0).toFixed(2)}`, margin, y);
  doc.text(`Closing: ${Number(statementData.closingBalance || 0).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 20;

  const col = {
    date: margin,
    doc: margin + 55,
    desc: margin + 130,
    debit: pageWidth - margin - 150,
    credit: pageWidth - margin - 90,
    bal: pageWidth - margin,
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Date', col.date, y);
  doc.text('Document', col.doc, y);
  doc.text('Description', col.desc, y);
  doc.text('Debit', col.debit, y, { align: 'right' });
  doc.text('Credit', col.credit, y, { align: 'right' });
  doc.text('Balance', col.bal, y, { align: 'right' });
  y += 10;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');

  for (const row of statementData.statement || []) {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    doc.text(formatDateEn(row.date), col.date, y);
    doc.text(String(row.documentNumber || row.id || '').slice(0, 14), col.doc, y);
    doc.text(String(row.descriptionEn || row.desc || '').slice(0, 28), col.desc, y);
    doc.text(Number(row.debit || 0) > 0 ? Number(row.debit).toFixed(2) : '—', col.debit, y, { align: 'right' });
    doc.text(Number(row.credit || 0) > 0 ? Number(row.credit).toFixed(2) : '—', col.credit, y, { align: 'right' });
    doc.text(Number(row.balance || 0).toFixed(2), col.bal, y, { align: 'right' });
    y += 12;
  }

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text(`Closing balance: ${Number(statementData.closingBalance || 0).toFixed(2)}`, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Aging 0-30: ${Number(ag.d0_30 || 0).toFixed(2)}   31-60: ${Number(ag.d31_60 || 0).toFixed(2)}   61-90: ${Number(ag.d61_90 || 0).toFixed(2)}   90+: ${Number(ag.d90_plus || 0).toFixed(2)}   Total: ${Number(ag.total || 0).toFixed(2)}`,
    margin,
    y,
  );
  y += 20;
  if (bank.bankName || bank.iban) {
    doc.setFont('helvetica', 'bold');
    doc.text('Bank details / بيانات البنك', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.text(`${bank.bankName || ''} — ${bank.accountName || ''}`, margin, y);
    y += 11;
    doc.text(`IBAN: ${bank.iban || bank.accountNumber || '—'}`, margin, y);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export async function sendCustomerStatementEmail({
  tenant,
  statementData,
  to,
  language = 'en',
} = {}) {
  if (!tenantHasEmailAddon(tenant)) {
    const err = new Error('Email Marketing is not installed for this tenant');
    err.status = 403;
    throw err;
  }
  const recipient = String(to || statementData?.customer?.email || '').trim();
  if (!recipient) {
    const err = new Error('Customer email is missing');
    err.status = 400;
    throw err;
  }
  const pdf = await buildCustomerStatementPdfBuffer(statementData, { language: 'bilingual' });
  const name = statementData?.customer?.nameEn || statementData?.customer?.name || 'Customer';
  const period = statementData?.period || {};
  const subject = language === 'ar'
    ? `كشف حساب — ${name} (${period.startDate} — ${period.endDate})`
    : `Statement of Account — ${name} (${period.startDate} — ${period.endDate})`;
  const filename = `${sanitizeFileName(`SOA-${name}-${period.endDate || 'statement'}`)}.pdf`;

  return sendTenantEmail({
    tenant,
    to: recipient,
    subject,
    html: `<p>${language === 'ar' ? 'مرفق كشف حساب الفترة' : 'Please find attached your statement of account for the period'} <strong>${period.startDate} — ${period.endDate}</strong>.</p>
           <p>${language === 'ar' ? 'الرصيد الختامي' : 'Closing balance'}: <strong>${Number(statementData.closingBalance || 0).toFixed(2)} ${statementData.currency || 'SAR'}</strong></p>`,
    text: `Statement of Account ${period.startDate} — ${period.endDate}. Closing: ${Number(statementData.closingBalance || 0).toFixed(2)}`,
    attachments: [{
      filename,
      content: pdf,
      contentType: 'application/pdf',
    }],
    metadata: { purpose: 'customer_statement', customerId: statementData?.customer?._id },
  });
}

export { sanitizeFileName };
