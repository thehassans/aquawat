import ChartOfAccount from '../models/ChartOfAccount.js';
import JournalEntry from '../models/JournalEntry.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Voucher from '../models/Voucher.js';
import Expense from '../models/Expense.js';
import PurchaseOrder from '../models/PurchaseOrder.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Standard SaaS/SME chart of accounts — bilingual for GCC. */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: '1000', name: 'Cash on Hand', nameAr: 'النقدية بالصندوق', type: 'asset', subtype: 'cash' },
  { code: '1100', name: 'Bank Accounts', nameAr: 'الحسابات البنكية', type: 'asset', subtype: 'bank' },
  { code: '1200', name: 'Accounts Receivable', nameAr: 'الذمم المدينة', type: 'asset', subtype: 'receivable' },
  { code: '1300', name: 'Inventory', nameAr: 'المخزون', type: 'asset', subtype: 'inventory' },
  { code: '1310', name: 'Stock Interim (Received)', nameAr: 'مخزون وسيط — استلام', type: 'liability', subtype: 'other_liability' },
  { code: '1320', name: 'Stock Interim (Delivered)', nameAr: 'مخزون وسيط — تسليم', type: 'expense', subtype: 'cogs' },
  { code: '1400', name: 'VAT Input (Recoverable)', nameAr: 'ضريبة المدخلات', type: 'asset', subtype: 'other_asset' },
  { code: '1500', name: 'Prepaid Expenses', nameAr: 'مصروفات مدفوعة مقدماً', type: 'asset', subtype: 'other_asset' },
  { code: '1600', name: 'Fixed Assets', nameAr: 'الأصول الثابتة', type: 'asset', subtype: 'fixed_asset' },
  { code: '2000', name: 'Accounts Payable', nameAr: 'الذمم الدائنة', type: 'liability', subtype: 'payable' },
  { code: '2100', name: 'VAT Output (Payable)', nameAr: 'ضريبة المخرجات', type: 'liability', subtype: 'tax' },
  { code: '2200', name: 'Accrued Expenses', nameAr: 'مصروفات مستحقة', type: 'liability', subtype: 'other_liability' },
  { code: '2300', name: 'Short-term Loans', nameAr: 'قروض قصيرة الأجل', type: 'liability', subtype: 'other_liability' },
  { code: '3000', name: 'Owner Capital', nameAr: 'رأس مال المالك', type: 'equity', subtype: 'capital' },
  { code: '3100', name: 'Retained Earnings', nameAr: 'الأرباح المحتجزة', type: 'equity', subtype: 'retained_earnings' },
  { code: '3200', name: 'Drawings', nameAr: 'المسحوبات', type: 'equity', subtype: 'other_equity' },
  { code: '4000', name: 'Sales Revenue', nameAr: 'إيرادات المبيعات', type: 'revenue', subtype: 'sales' },
  { code: '4100', name: 'Service Revenue', nameAr: 'إيرادات الخدمات', type: 'revenue', subtype: 'sales' },
  { code: '4200', name: 'Other Income', nameAr: 'إيرادات أخرى', type: 'revenue', subtype: 'other_income' },
  { code: '5000', name: 'Cost of Goods Sold', nameAr: 'تكلفة البضاعة المباعة', type: 'expense', subtype: 'cogs' },
  { code: '5100', name: 'Operating Expenses', nameAr: 'المصروفات التشغيلية', type: 'expense', subtype: 'operating' },
  { code: '5200', name: 'Salaries & Wages', nameAr: 'الرواتب والأجور', type: 'expense', subtype: 'payroll' },
  { code: '5300', name: 'Rent Expense', nameAr: 'مصروف الإيجار', type: 'expense', subtype: 'operating' },
  { code: '5400', name: 'Utilities', nameAr: 'المرافق', type: 'expense', subtype: 'operating' },
  { code: '5500', name: 'Bank Charges', nameAr: 'عمولات بنكية', type: 'expense', subtype: 'other_expense' },
  { code: '5600', name: 'Depreciation', nameAr: 'الاستهلاك', type: 'expense', subtype: 'other_expense' },
];

const ACCOUNT_CODE_MAP = {
  cash: '1000',
  bank: '1100',
  ar: '1200',
  inventory: '1300',
  vatInput: '1400',
  ap: '2000',
  vatOutput: '2100',
  capital: '3000',
  retained: '3100',
  sales: '4000',
  services: '4100',
  otherIncome: '4200',
  cogs: '5000',
  opex: '5100',
  salaries: '5200',
  rent: '5300',
  utilities: '5400',
  bankCharges: '5500',
};

export function normaliseLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      accountId: line.accountId,
      accountCode: String(line.accountCode || '').trim(),
      accountName: String(line.accountName || '').trim(),
      description: String(line.description || '').trim(),
      debit: round2(Math.max(0, Number(line.debit) || 0)),
      credit: round2(Math.max(0, Number(line.credit) || 0)),
    }))
    .filter((line) => line.accountId && (line.debit > 0 || line.credit > 0));
}

export function assertBalanced(lines) {
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (lines.length < 2) {
    throw new Error('Journal entry requires at least two lines');
  }
  if (Math.abs(debit - credit) > 0.009) {
    throw new Error(`Journal is not balanced (debit ${debit} ≠ credit ${credit})`);
  }
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(`Line ${line.accountCode} cannot have both debit and credit`);
    }
  }
  return { debit, credit };
}

export async function ensureDefaultChartOfAccounts(tenantId, userId = null, currency = 'SAR') {
  const existing = await ChartOfAccount.countDocuments({ tenantId });
  if (existing > 0) {
    return ChartOfAccount.find({ tenantId }).sort({ code: 1 }).lean();
  }

  const docs = DEFAULT_CHART_OF_ACCOUNTS.map((row) => ({
    ...row,
    tenantId,
    currency,
    isSystem: true,
    isActive: true,
    isPostable: true,
    balance: 0,
    createdBy: userId || undefined,
  }));

  await ChartOfAccount.insertMany(docs);
  return ChartOfAccount.find({ tenantId }).sort({ code: 1 }).lean();
}

export async function getAccountByCode(tenantId, code) {
  return ChartOfAccount.findOne({ tenantId, code: String(code), isActive: true });
}

export async function getAccountMap(tenantId) {
  await ensureDefaultChartOfAccounts(tenantId);
  const rows = await ChartOfAccount.find({ tenantId, isActive: true }).lean();
  const byCode = {};
  const bySubtype = {};
  for (const row of rows) {
    byCode[row.code] = row;
    if (row.subtype && !bySubtype[row.subtype]) bySubtype[row.subtype] = row;
  }
  return { byCode, bySubtype, rows };
}

async function nextEntryNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;
  const last = await JournalEntry.findOne({ tenantId, entryNumber: new RegExp(`^${prefix}`) })
    .sort({ entryNumber: -1 })
    .select('entryNumber')
    .lean();
  const seq = last?.entryNumber ? (Number(String(last.entryNumber).split('-').pop()) || 0) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function applyBalanceDelta(tenantId, lines, direction = 1) {
  for (const line of lines) {
    const account = await ChartOfAccount.findOne({ _id: line.accountId, tenantId });
    if (!account) continue;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    let delta = 0;
    if (['asset', 'expense'].includes(account.type)) {
      delta = debit - credit;
    } else {
      delta = credit - debit;
    }
    account.balance = round2(Number(account.balance || 0) + direction * delta);
    await account.save();
  }
}

export async function createJournalEntry({
  tenantId,
  userId,
  entryDate = new Date(),
  type = 'manual',
  memo = '',
  memoAr = '',
  reference = '',
  currency = 'SAR',
  lines = [],
  sourceModel = '',
  sourceId = null,
  sourceNumber = '',
  status = 'draft',
  entryNumber = null,
}) {
  const normalised = normaliseLines(lines);
  assertBalanced(normalised);

  // Enrich names from COA
  const enriched = [];
  for (const line of normalised) {
    const account = await ChartOfAccount.findOne({ _id: line.accountId, tenantId, isActive: true });
    if (!account) throw new Error(`Account not found: ${line.accountCode || line.accountId}`);
    if (!account.isPostable) throw new Error(`Account ${account.code} is not postable`);
    enriched.push({
      ...line,
      accountCode: account.code,
      accountName: account.name,
    });
  }

  const { debit, credit } = assertBalanced(enriched);
  const number = entryNumber || await nextEntryNumber(tenantId);

  const entry = await JournalEntry.create({
    tenantId,
    entryNumber: number,
    entryDate: new Date(entryDate),
    type,
    status: 'draft',
    memo,
    memoAr,
    reference,
    currency,
    lines: enriched,
    totalDebit: debit,
    totalCredit: credit,
    sourceModel,
    sourceId: sourceId || undefined,
    sourceNumber,
    createdBy: userId || undefined,
  });

  if (status === 'posted') {
    return postJournalEntry(tenantId, entry._id, userId);
  }
  return entry;
}

export async function postJournalEntry(tenantId, entryId, userId) {
  const entry = await JournalEntry.findOne({ _id: entryId, tenantId });
  if (!entry) throw new Error('Journal entry not found');
  if (entry.status === 'posted') return entry;
  if (entry.status === 'void') throw new Error('Cannot post a voided entry');

  const lines = normaliseLines(entry.lines);
  assertBalanced(lines);
  await applyBalanceDelta(tenantId, lines, 1);

  entry.status = 'posted';
  entry.postingDate = new Date();
  entry.postedBy = userId || undefined;
  entry.totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  entry.totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  await entry.save();
  return entry;
}

export async function voidJournalEntry(tenantId, entryId, userId, reason = '') {
  const entry = await JournalEntry.findOne({ _id: entryId, tenantId });
  if (!entry) throw new Error('Journal entry not found');
  if (entry.status === 'void') return entry;
  if (entry.status === 'posted') {
    await applyBalanceDelta(tenantId, normaliseLines(entry.lines), -1);
  }
  entry.status = 'void';
  entry.voidedAt = new Date();
  entry.voidedBy = userId || undefined;
  entry.voidReason = reason || '';
  await entry.save();
  return entry;
}

async function findExistingSourceEntry(tenantId, sourceModel, sourceId) {
  if (!sourceId) return null;
  return JournalEntry.findOne({
    tenantId,
    sourceModel,
    sourceId,
    status: { $ne: 'void' },
  });
}

function paymentAccountCode(method = 'bank_transfer') {
  const m = String(method || '').toLowerCase();
  if (m.includes('cash')) return ACCOUNT_CODE_MAP.cash;
  return ACCOUNT_CODE_MAP.bank;
}

/**
 * Sales invoice issued (AR + VAT output + Revenue).
 * Amounts: net (ex-VAT), tax, gross.
 */
export async function postSalesInvoiceJournal({
  tenantId,
  userId,
  invoice,
  currency = 'SAR',
}) {
  if (!invoice?._id) return null;
  const existing = await findExistingSourceEntry(tenantId, 'Invoice', invoice._id);
  if (existing) return existing;

  const { byCode } = await getAccountMap(tenantId);
  const ar = byCode[ACCOUNT_CODE_MAP.ar];
  const sales = byCode[ACCOUNT_CODE_MAP.sales];
  const vatOut = byCode[ACCOUNT_CODE_MAP.vatOutput];
  if (!ar || !sales) return null;

  const tax = round2(Number(invoice.totalTax ?? invoice.taxAmount ?? 0));
  const gross = round2(Number(invoice.grandTotal || 0));
  let net = round2(Number(invoice.taxableAmount ?? (gross - tax)));
  if (round2(net + tax) !== gross) {
    net = round2(gross - tax);
  }
  if (gross <= 0) return null;

  const lines = [
    { accountId: ar._id, accountCode: ar.code, debit: gross, credit: 0, description: `AR ${invoice.invoiceNumber}` },
    { accountId: sales._id, accountCode: sales.code, debit: 0, credit: net, description: `Sales ${invoice.invoiceNumber}` },
  ];
  if (tax > 0 && vatOut) {
    lines.push({
      accountId: vatOut._id,
      accountCode: vatOut.code,
      debit: 0,
      credit: tax,
      description: `VAT output ${invoice.invoiceNumber}`,
    });
  }

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: invoice.issueDate || new Date(),
    type: 'invoice',
    memo: `Sales invoice ${invoice.invoiceNumber}`,
    memoAr: `فاتورة مبيعات ${invoice.invoiceNumber}`,
    reference: invoice.invoiceNumber,
    currency,
    lines,
    sourceModel: 'Invoice',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber,
    status: 'posted',
  });
}

/** Customer payment against sales invoice — Cash/Bank Dr, AR Cr */
export async function postInvoicePaymentJournal({
  tenantId,
  userId,
  invoice,
  amount,
  paymentMethod = 'bank_transfer',
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
}) {
  const payAmt = round2(amount);
  if (!invoice?._id || payAmt <= 0) return null;

  const { byCode } = await getAccountMap(tenantId);
  const cashCode = paymentAccountCode(paymentMethod);
  const cash = byCode[cashCode] || byCode[ACCOUNT_CODE_MAP.bank];
  const ar = byCode[ACCOUNT_CODE_MAP.ar];
  if (!cash || !ar) return null;

  const key = `InvoicePayment:${invoice._id}:${payAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'InvoicePayment',
    sourceId: invoice._id,
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: `Payment for invoice ${invoice.invoiceNumber}`,
    reference: key,
    currency,
    lines: [
      { accountId: cash._id, accountCode: cash.code, debit: payAmt, credit: 0, description: 'Customer payment' },
      { accountId: ar._id, accountCode: ar.code, debit: 0, credit: payAmt, description: `Settle AR ${invoice.invoiceNumber}` },
    ],
    sourceModel: 'InvoicePayment',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber,
    status: 'posted',
  });
}

/** Supplier payment against purchase order / vendor bill — AP (Accounts Payable) Dr, Cash/Bank Cr */
export async function postSupplierPaymentJournal({
  tenantId,
  userId,
  purchaseOrder,
  amount,
  paymentMethod = 'bank_transfer',
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
  notes = '',
}) {
  const payAmt = round2(amount);
  if (!purchaseOrder?._id || payAmt <= 0) return null;

  const { byCode } = await getAccountMap(tenantId);
  const cashCode = paymentAccountCode(paymentMethod);
  const cash = byCode[cashCode] || byCode[ACCOUNT_CODE_MAP.bank] || byCode[ACCOUNT_CODE_MAP.cash];
  const ap = byCode[ACCOUNT_CODE_MAP.ap];
  if (!cash || !ap) return null;

  const refKey = reference || (paymentDate instanceof Date ? paymentDate.toISOString() : String(paymentDate)) || String(Date.now());
  const key = `POPayment:${purchaseOrder._id}:${payAmt}:${refKey}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'PurchaseOrderPayment',
    sourceId: purchaseOrder._id,
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  const poNumber = purchaseOrder.poNumber || 'PO';
  const supplierName = purchaseOrder.supplierId?.nameAr || purchaseOrder.supplierId?.nameEn || purchaseOrder.supplierId?.name || '';
  const desc = supplierName ? `${poNumber} (${supplierName})` : poNumber;

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: `Supplier payment for PO ${desc}`,
    memoAr: `سداد دفعة للمورد لأمر الشراء ${desc}`,
    reference: key,
    currency,
    lines: [
      {
        accountId: ap._id,
        accountCode: ap.code,
        accountName: ap.name,
        debit: payAmt,
        credit: 0,
        description: `Settle AP / ${desc}${notes ? ` - ${notes}` : ''}`,
      },
      {
        accountId: cash._id,
        accountCode: cash.code,
        accountName: cash.name,
        debit: 0,
        credit: payAmt,
        description: `Payment via ${paymentMethod} / ${desc}`,
      },
    ],
    sourceModel: 'PurchaseOrderPayment',
    sourceId: purchaseOrder._id,
    sourceNumber: poNumber,
    status: 'posted',
  });
}

/** Expense paid — Expense (+VAT input) Dr, Cash/Bank Cr */
export async function postExpensePaidJournal({
  tenantId,
  userId,
  expense,
  currency = 'SAR',
}) {
  if (!expense?._id) return null;
  const existing = await findExistingSourceEntry(tenantId, 'Expense', expense._id);
  if (existing) return existing;

  const { byCode } = await getAccountMap(tenantId);
  const category = String(expense.category || '').toLowerCase();
  let expenseCode = ACCOUNT_CODE_MAP.opex;
  if (category.includes('salary') || category.includes('payroll') || category.includes('wage')) {
    expenseCode = ACCOUNT_CODE_MAP.salaries;
  } else if (category.includes('rent')) {
    expenseCode = ACCOUNT_CODE_MAP.rent;
  } else if (category.includes('utilit')) {
    expenseCode = ACCOUNT_CODE_MAP.utilities;
  }

  const expenseAcct = byCode[expenseCode] || byCode[ACCOUNT_CODE_MAP.opex];
  const vatIn = byCode[ACCOUNT_CODE_MAP.vatInput];
  const cash = byCode[paymentAccountCode(expense.paymentMethod)] || byCode[ACCOUNT_CODE_MAP.bank];
  if (!expenseAcct || !cash) return null;

  const net = round2(Number(expense.amount || 0));
  const tax = round2(Number(expense.taxAmount || 0));
  const total = round2(Number(expense.totalAmount || net + tax));
  if (total <= 0) return null;

  const lines = [
    { accountId: expenseAcct._id, accountCode: expenseAcct.code, debit: net, credit: 0, description: expense.description || expense.expenseNumber },
  ];
  if (tax > 0 && vatIn) {
    lines.push({
      accountId: vatIn._id,
      accountCode: vatIn.code,
      debit: tax,
      credit: 0,
      description: `VAT input ${expense.expenseNumber}`,
    });
  }
  lines.push({
    accountId: cash._id,
    accountCode: cash.code,
    debit: 0,
    credit: total,
    description: `Pay ${expense.expenseNumber}`,
  });

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: expense.paymentDate || expense.expenseDate || new Date(),
    type: 'expense',
    memo: `Expense ${expense.expenseNumber}`,
    reference: expense.expenseNumber,
    currency,
    lines,
    sourceModel: 'Expense',
    sourceId: expense._id,
    sourceNumber: expense.expenseNumber,
    status: 'posted',
  });
}

/** Voucher — receive: Cash Dr / AR or Income Cr; payment: Expense or AP Dr / Cash Cr */
export async function postVoucherJournal({
  tenantId,
  userId,
  voucher,
  currency = 'SAR',
}) {
  if (!voucher?._id) return null;
  const existing = await findExistingSourceEntry(tenantId, 'Voucher', voucher._id);
  if (existing) return existing;

  const { byCode } = await getAccountMap(tenantId);
  const amount = round2(Number(voucher.amount || voucher.totalAmount || 0));
  if (amount <= 0) return null;

  const cash = byCode[paymentAccountCode(voucher.paymentMethod)] || byCode[ACCOUNT_CODE_MAP.bank];
  const ar = byCode[ACCOUNT_CODE_MAP.ar];
  const ap = byCode[ACCOUNT_CODE_MAP.ap];
  const opex = byCode[ACCOUNT_CODE_MAP.opex];
  const otherIncome = byCode[ACCOUNT_CODE_MAP.otherIncome];
  if (!cash) return null;

  const isReceive = String(voucher.type || voucher.voucherType || '').toLowerCase().includes('receiv');
  let lines;
  if (isReceive) {
    const creditAcct = ar || otherIncome;
    if (!creditAcct) return null;
    lines = [
      { accountId: cash._id, accountCode: cash.code, debit: amount, credit: 0, description: voucher.description || voucher.voucherNumber },
      { accountId: creditAcct._id, accountCode: creditAcct.code, debit: 0, credit: amount, description: `Receipt ${voucher.voucherNumber}` },
    ];
  } else {
    const debitAcct = ap || opex;
    if (!debitAcct) return null;
    lines = [
      { accountId: debitAcct._id, accountCode: debitAcct.code, debit: amount, credit: 0, description: voucher.description || voucher.voucherNumber },
      { accountId: cash._id, accountCode: cash.code, debit: 0, credit: amount, description: `Payment ${voucher.voucherNumber}` },
    ];
  }

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: voucher.voucherDate || voucher.date || new Date(),
    type: 'voucher',
    memo: `Voucher ${voucher.voucherNumber}`,
    reference: voucher.voucherNumber,
    currency,
    lines,
    sourceModel: 'Voucher',
    sourceId: voucher._id,
    sourceNumber: voucher.voucherNumber,
    status: 'posted',
  });
}

/** Credit note — reverse sales invoice economics */
export async function postCreditNoteJournal({
  tenantId,
  userId,
  creditNote,
  currency = 'SAR',
}) {
  if (!creditNote?._id) return null;
  const existing = await findExistingSourceEntry(tenantId, 'CreditNote', creditNote._id);
  if (existing) return existing;

  const { byCode } = await getAccountMap(tenantId);
  const ar = byCode[ACCOUNT_CODE_MAP.ar];
  const sales = byCode[ACCOUNT_CODE_MAP.sales];
  const vatOut = byCode[ACCOUNT_CODE_MAP.vatOutput];
  if (!ar || !sales) return null;

  const net = Math.abs(round2(Number(creditNote.subtotal ?? 0)));
  const tax = Math.abs(round2(Number(creditNote.taxAmount || 0)));
  const gross = Math.abs(round2(Number(creditNote.grandTotal || net + tax)));
  if (gross <= 0) return null;

  const lines = [
    { accountId: sales._id, accountCode: sales.code, debit: net, credit: 0, description: `CN ${creditNote.invoiceNumber}` },
    { accountId: ar._id, accountCode: ar.code, debit: 0, credit: gross, description: `CN settle ${creditNote.invoiceNumber}` },
  ];
  if (tax > 0 && vatOut) {
    lines.splice(1, 0, {
      accountId: vatOut._id,
      accountCode: vatOut.code,
      debit: tax,
      credit: 0,
      description: `CN VAT ${creditNote.invoiceNumber}`,
    });
  }

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: creditNote.issueDate || new Date(),
    type: 'adjustment',
    memo: `Credit note ${creditNote.invoiceNumber}`,
    reference: creditNote.invoiceNumber,
    currency,
    lines,
    sourceModel: 'CreditNote',
    sourceId: creditNote._id,
    sourceNumber: creditNote.invoiceNumber,
    status: 'posted',
  });
}

export async function buildTrialBalance(tenantId, { asOf = null } = {}) {
  await ensureDefaultChartOfAccounts(tenantId);
  const accounts = await ChartOfAccount.find({ tenantId, isActive: true }).sort({ code: 1 }).lean();

  if (!asOf) {
    const rows = accounts.map((a) => {
      const bal = round2(a.balance || 0);
      const isDebitNature = ['asset', 'expense'].includes(a.type);
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        nameAr: a.nameAr,
        type: a.type,
        debit: bal > 0 && isDebitNature ? bal : (bal < 0 && !isDebitNature ? Math.abs(bal) : (bal > 0 && !isDebitNature ? 0 : (bal < 0 && isDebitNature ? 0 : 0))),
        credit: bal > 0 && !isDebitNature ? bal : (bal < 0 && isDebitNature ? Math.abs(bal) : 0),
        balance: bal,
      };
    }).map((row) => {
      // Cleaner: show natural side
      const isDebitNature = ['asset', 'expense'].includes(row.type);
      let debit = 0;
      let credit = 0;
      if (row.balance >= 0) {
        if (isDebitNature) debit = row.balance;
        else credit = row.balance;
      } else {
        if (isDebitNature) credit = Math.abs(row.balance);
        else debit = Math.abs(row.balance);
      }
      return { ...row, debit: round2(debit), credit: round2(credit) };
    }).filter((r) => r.debit !== 0 || r.credit !== 0 || true);

    const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
    const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
    return { asOf: asOf || new Date(), rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.02 };
  }

  // Rebuild from posted journals up to asOf
  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $lte: new Date(asOf) },
  }).lean();

  const map = {};
  for (const a of accounts) {
    map[String(a._id)] = {
      accountId: a._id,
      code: a.code,
      name: a.name,
      nameAr: a.nameAr,
      type: a.type,
      debit: 0,
      credit: 0,
      balance: 0,
    };
  }
  for (const entry of entries) {
    for (const line of entry.lines || []) {
      const key = String(line.accountId);
      if (!map[key]) continue;
      map[key].debit = round2(map[key].debit + Number(line.debit || 0));
      map[key].credit = round2(map[key].credit + Number(line.credit || 0));
    }
  }
  const rows = Object.values(map).map((row) => {
    const isDebitNature = ['asset', 'expense'].includes(row.type);
    const raw = isDebitNature ? row.debit - row.credit : row.credit - row.debit;
    return { ...row, balance: round2(raw) };
  });
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { asOf: new Date(asOf), rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.02 };
}

export async function buildProfitAndLoss(tenantId, { from, to } = {}) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const accounts = await ChartOfAccount.find({
    tenantId,
    isActive: true,
    type: { $in: ['revenue', 'expense'] },
  }).sort({ code: 1 }).lean();

  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: start, $lte: end },
  }).lean();

  const totals = {};
  for (const a of accounts) {
    totals[String(a._id)] = { ...a, amount: 0 };
  }

  for (const entry of entries) {
    for (const line of entry.lines || []) {
      const key = String(line.accountId);
      if (!totals[key]) continue;
      const a = totals[key];
      if (a.type === 'revenue') {
        a.amount = round2(a.amount + Number(line.credit || 0) - Number(line.debit || 0));
      } else {
        a.amount = round2(a.amount + Number(line.debit || 0) - Number(line.credit || 0));
      }
    }
  }

  const revenue = Object.values(totals).filter((a) => a.type === 'revenue');
  const expenses = Object.values(totals).filter((a) => a.type === 'expense');
  const totalRevenue = round2(revenue.reduce((s, a) => s + a.amount, 0));
  const totalExpenses = round2(expenses.reduce((s, a) => s + a.amount, 0));
  const netIncome = round2(totalRevenue - totalExpenses);

  return {
    from: start,
    to: end,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome,
  };
}

export async function buildBalanceSheet(tenantId, { asOf = null } = {}) {
  const tb = await buildTrialBalance(tenantId, { asOf });
  const assets = [];
  const liabilities = [];
  const equity = [];

  for (const row of tb.rows) {
    const item = {
      code: row.code,
      name: row.name,
      nameAr: row.nameAr,
      balance: row.balance,
    };
    if (row.type === 'asset') assets.push(item);
    else if (row.type === 'liability') liabilities.push(item);
    else if (row.type === 'equity') equity.push(item);
  }

  // Current period net income into equity
  const pnl = await buildProfitAndLoss(tenantId, {
    from: new Date(new Date().getFullYear(), 0, 1),
    to: asOf || new Date(),
  });
  if (Math.abs(pnl.netIncome) > 0.009) {
    equity.push({
      code: 'NI',
      name: 'Net Income (Current Period)',
      nameAr: 'صافي الدخل (الفترة الحالية)',
      balance: pnl.netIncome,
    });
  }

  const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0));
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0));
  const totalEquity = round2(equity.reduce((s, a) => s + a.balance, 0));

  return {
    asOf: tb.asOf,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05,
  };
}

export async function buildGeneralLedger(tenantId, accountId, { from, to } = {}) {
  const account = await ChartOfAccount.findOne({ _id: accountId, tenantId }).lean();
  if (!account) throw new Error('Account not found');

  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: start, $lte: end },
    'lines.accountId': account._id,
  }).sort({ entryDate: 1, entryNumber: 1 }).lean();

  let running = 0;
  const lines = [];
  for (const entry of entries) {
    for (const line of entry.lines || []) {
      if (String(line.accountId) !== String(account._id)) continue;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      if (['asset', 'expense'].includes(account.type)) {
        running = round2(running + debit - credit);
      } else {
        running = round2(running + credit - debit);
      }
      lines.push({
        entryId: entry._id,
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        memo: entry.memo,
        reference: entry.reference || entry.sourceNumber,
        debit,
        credit,
        balance: running,
      });
    }
  }

  return { account, from: start, to: end, lines };
}

export async function getAccountingDashboard(tenantId) {
  await ensureDefaultChartOfAccounts(tenantId);
  const [accountCount, draftCount, postedCount, pnl, tb] = await Promise.all([
    ChartOfAccount.countDocuments({ tenantId, isActive: true }),
    JournalEntry.countDocuments({ tenantId, status: 'draft' }),
    JournalEntry.countDocuments({ tenantId, status: 'posted' }),
    buildProfitAndLoss(tenantId),
    buildTrialBalance(tenantId),
  ]);

  const cash = tb.rows.find((r) => r.code === '1000');
  const bank = tb.rows.find((r) => r.code === '1100');
  const ar = tb.rows.find((r) => r.code === '1200');
  const ap = tb.rows.find((r) => r.code === '2000');

  const recent = await JournalEntry.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  return {
    accountCount,
    draftCount,
    postedCount,
    netIncome: pnl.netIncome,
    totalRevenue: pnl.totalRevenue,
    totalExpenses: pnl.totalExpenses,
    cashBalance: round2((cash?.balance || 0) + (bank?.balance || 0)),
    arBalance: ar?.balance || 0,
    apBalance: ap?.balance || 0,
    trialBalanced: tb.balanced,
    recent,
  };
}

function periodRange({ from, to } = {}) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function buildCustomerAccountReport(tenantId, customerId, { from, to } = {}) {
  if (!customerId) throw new Error('customerId is required');
  const customer = await Customer.findOne({ _id: customerId, tenantId }).lean();
  if (!customer) throw new Error('Customer not found');

  const { start, end } = periodRange({ from, to });
  const invoices = await Invoice.find({
    tenantId,
    customerId,
    flow: 'sell',
    status: { $nin: ['draft', 'cancelled'] },
    issueDate: { $lte: end },
  }).select('invoiceNumber issueDate grandTotal paidAmount').lean();

  let receipts = [];
  try {
    receipts = await Voucher.find({
      tenantId,
      partyId: customerId,
      type: 'receive',
      date: { $lte: end },
    }).select('voucherNumber date amount description').lean();
  } catch {
    receipts = [];
  }

  const events = [];
  for (const invoice of invoices) {
    events.push({
      date: invoice.issueDate,
      type: 'invoice',
      ref: invoice.invoiceNumber,
      debit: round2(invoice.grandTotal),
      credit: 0,
      memo: 'Invoice',
    });
    if (Number(invoice.paidAmount) > 0) {
      events.push({
        date: invoice.issueDate,
        type: 'payment',
        ref: invoice.invoiceNumber,
        debit: 0,
        credit: round2(invoice.paidAmount),
        memo: 'Invoice payment',
      });
    }
  }
  for (const receipt of receipts) {
    events.push({
      date: receipt.date,
      type: 'receipt',
      ref: receipt.voucherNumber,
      debit: 0,
      credit: round2(receipt.amount),
      memo: receipt.description || 'Receipt voucher',
    });
  }
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  let openingBalance = 0;
  const lines = [];
  for (const event of events) {
    running = round2(running + event.debit - event.credit);
    if (new Date(event.date) < start) {
      openingBalance = running;
      continue;
    }
    lines.push({ ...event, balance: running });
  }

  return {
    customer,
    from: start,
    to: end,
    openingBalance,
    closingBalance: lines.length ? lines[lines.length - 1].balance : openingBalance,
    lines,
  };
}

export async function buildCustomerSummaryReport(tenantId, { from, to } = {}) {
  const { start, end } = periodRange({ from, to });
  const [invoices, receipts] = await Promise.all([
    Invoice.find({
      tenantId,
      flow: 'sell',
      status: { $nin: ['draft', 'cancelled'] },
      issueDate: { $gte: start, $lte: end },
    }).select('customerId buyer.name grandTotal paidAmount').lean(),
    Voucher.find({
      tenantId,
      type: 'receive',
      partyType: 'customer',
      date: { $gte: start, $lte: end },
    }).select('partyId partyName amount').lean().catch(() => []),
  ]);

  const map = new Map();
  const bump = (id, name, patch) => {
    const key = String(id || name || 'unknown');
    if (!map.has(key)) {
      map.set(key, {
        partyId: id || null,
        name: name || 'Unknown',
        invoices: 0,
        invoiced: 0,
        paid: 0,
        receipts: 0,
        outstanding: 0,
      });
    }
    const row = map.get(key);
    if (name && row.name === 'Unknown') row.name = name;
    row.invoices += patch.invoices || 0;
    row.invoiced = round2(row.invoiced + (patch.invoiced || 0));
    row.paid = round2(row.paid + (patch.paid || 0));
    row.receipts = round2(row.receipts + (patch.receipts || 0));
    row.outstanding = round2(row.invoiced - row.paid);
  };

  for (const invoice of invoices) {
    bump(invoice.customerId, invoice.buyer?.name, {
      invoices: 1,
      invoiced: Number(invoice.grandTotal) || 0,
      paid: Number(invoice.paidAmount) || 0,
    });
  }
  for (const receipt of receipts) {
    bump(receipt.partyId, receipt.partyName, { receipts: Number(receipt.amount) || 0 });
  }

  const rows = [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
  return {
    from: start,
    to: end,
    rows,
    totals: rows.reduce((sum, row) => ({
      invoices: sum.invoices + row.invoices,
      invoiced: round2(sum.invoiced + row.invoiced),
      paid: round2(sum.paid + row.paid),
      receipts: round2(sum.receipts + row.receipts),
      outstanding: round2(sum.outstanding + row.outstanding),
    }), { invoices: 0, invoiced: 0, paid: 0, receipts: 0, outstanding: 0 }),
  };
}

export async function buildSupplierSummaryReport(tenantId, { from, to } = {}) {
  const { start, end } = periodRange({ from, to });
  const [invoices, payments, suppliers] = await Promise.all([
    Invoice.find({
      tenantId,
      flow: 'purchase',
      status: { $nin: ['draft', 'cancelled'] },
      issueDate: { $gte: start, $lte: end },
    }).select('supplierId seller.name buyer.name grandTotal paidAmount').lean(),
    Voucher.find({
      tenantId,
      type: 'payment',
      partyType: 'supplier',
      date: { $gte: start, $lte: end },
    }).select('partyId partyName amount').lean().catch(() => []),
    Supplier.find({ tenantId }).select('nameEn nameAr code').lean(),
  ]);

  const supplierNames = new Map(suppliers.map((s) => [String(s._id), s.nameEn || s.nameAr || s.code]));
  const map = new Map();
  const bump = (id, name, patch) => {
    const key = String(id || name || 'unknown');
    if (!map.has(key)) {
      map.set(key, {
        partyId: id || null,
        name: name || 'Unknown',
        invoices: 0,
        invoiced: 0,
        paid: 0,
        payments: 0,
        outstanding: 0,
      });
    }
    const row = map.get(key);
    if (name && row.name === 'Unknown') row.name = name;
    row.invoices += patch.invoices || 0;
    row.invoiced = round2(row.invoiced + (patch.invoiced || 0));
    row.paid = round2(row.paid + (patch.paid || 0));
    row.payments = round2(row.payments + (patch.payments || 0));
    row.outstanding = round2(row.invoiced - row.paid);
  };

  for (const invoice of invoices) {
    const name = supplierNames.get(String(invoice.supplierId)) || invoice.seller?.name || invoice.buyer?.name;
    bump(invoice.supplierId, name, {
      invoices: 1,
      invoiced: Number(invoice.grandTotal) || 0,
      paid: Number(invoice.paidAmount) || 0,
    });
  }
  for (const payment of payments) {
    bump(payment.partyId, payment.partyName, { payments: Number(payment.amount) || 0 });
  }

  const rows = [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
  return {
    from: start,
    to: end,
    rows,
    totals: rows.reduce((sum, row) => ({
      invoices: sum.invoices + row.invoices,
      invoiced: round2(sum.invoiced + row.invoiced),
      paid: round2(sum.paid + row.paid),
      payments: round2(sum.payments + row.payments),
      outstanding: round2(sum.outstanding + row.outstanding),
    }), { invoices: 0, invoiced: 0, paid: 0, payments: 0, outstanding: 0 }),
  };
}

export async function buildSupplierAccountReport(tenantId, supplierId, { from, to } = {}) {
  if (!supplierId) throw new Error('supplierId is required');
  const supplier = await Supplier.findOne({ _id: supplierId, tenantId }).lean();
  if (!supplier) throw new Error('Supplier not found');

  const { start, end } = periodRange({ from, to });
  const [invoices, payments, expenses, purchaseOrders] = await Promise.all([
    Invoice.find({
      tenantId,
      supplierId,
      flow: 'purchase',
      status: { $nin: ['draft', 'cancelled'] },
      issueDate: { $lte: end },
    }).select('invoiceNumber issueDate grandTotal paidAmount sourcePurchaseOrderId').lean(),
    Voucher.find({
      tenantId,
      partyId: supplierId,
      type: 'payment',
      date: { $lte: end },
    }).select('voucherNumber date amount description').lean().catch(() => []),
    Expense.find({
      tenantId,
      supplierId,
      status: { $in: ['approved', 'paid'] },
      expenseDate: { $lte: end },
    }).select('expenseNumber expenseDate totalAmount amount taxAmount status description').lean().catch(() => []),
    PurchaseOrder.find({
      tenantId,
      supplierId,
      status: { $nin: ['draft', 'cancelled'] },
      orderDate: { $lte: end },
    }).select('poNumber orderDate grandTotal paidAmount payments billedInvoiceId').lean().catch(() => []),
  ]);

  const events = [];
  for (const invoice of invoices) {
    events.push({
      date: invoice.issueDate,
      type: 'bill',
      ref: invoice.invoiceNumber,
      debit: 0,
      credit: round2(invoice.grandTotal),
      memo: 'Purchase invoice',
    });
    if (Number(invoice.paidAmount) > 0) {
      events.push({
        date: invoice.issueDate,
        type: 'payment',
        ref: invoice.invoiceNumber,
        debit: round2(invoice.paidAmount),
        credit: 0,
        memo: 'Invoice payment',
      });
    }
  }
  for (const payment of payments) {
    events.push({
      date: payment.date,
      type: 'payment',
      ref: payment.voucherNumber,
      debit: round2(payment.amount),
      credit: 0,
      memo: payment.description || 'Payment voucher',
    });
  }
  for (const expense of expenses) {
    const amount = round2(expense.totalAmount || (Number(expense.amount || 0) + Number(expense.taxAmount || 0)));
    events.push({
      date: expense.expenseDate,
      type: 'expense',
      ref: expense.expenseNumber,
      debit: expense.status === 'paid' ? amount : 0,
      credit: amount,
      memo: expense.description || 'Expense',
    });
  }
  const invoicedPoIds = new Set(invoices.map((inv) => String(inv.sourcePurchaseOrderId || '')).filter(Boolean));
  for (const po of purchaseOrders || []) {
    if (!invoicedPoIds.has(String(po._id))) {
      events.push({
        date: po.orderDate,
        type: 'po',
        ref: po.poNumber,
        debit: 0,
        credit: round2(po.grandTotal),
        memo: `Purchase Order ${po.poNumber}`,
      });
      for (const p of po.payments || []) {
        events.push({
          date: p.date || po.orderDate,
          type: 'payment',
          ref: p.voucherNumber || p.reference || po.poNumber,
          debit: round2(p.amount),
          credit: 0,
          memo: p.notes || `PO Payment ${po.poNumber}`,
        });
      }
    }
  }
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  let openingBalance = 0;
  const lines = [];
  for (const event of events) {
    running = round2(running + event.credit - event.debit);
    if (new Date(event.date) < start) {
      openingBalance = running;
      continue;
    }
    lines.push({ ...event, balance: running });
  }

  return {
    supplier,
    from: start,
    to: end,
    openingBalance,
    closingBalance: running,
    lines,
  };
}

export default {
  ensureDefaultChartOfAccounts,
  createJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  postSalesInvoiceJournal,
  postInvoicePaymentJournal,
  postSupplierPaymentJournal,
  postExpensePaidJournal,
  postVoucherJournal,
  postCreditNoteJournal,
  buildTrialBalance,
  buildProfitAndLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  getAccountingDashboard,
  buildCustomerAccountReport,
  buildCustomerSummaryReport,
  buildSupplierSummaryReport,
  buildSupplierAccountReport,
};
