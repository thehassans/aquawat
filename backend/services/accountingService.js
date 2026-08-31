import ChartOfAccount from '../models/ChartOfAccount.js';
import JournalEntry from '../models/JournalEntry.js';
import JournalItem from '../models/JournalItem.js';
import Tenant from '../models/Tenant.js';
import { BUILTIN_PAYMENT_TERMS, describePaymentTerm, computePaymentSchedule } from '../utils/invoicePaymentTerms.js';
import InvProductCategory from '../models/inventory/InvProductCategory.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Voucher from '../models/Voucher.js';
import Expense from '../models/Expense.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { applyPaidAmountStatus } from '../utils/invoicePaymentStatus.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Standard SaaS/SME chart of accounts — bilingual for GCC. */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: '1000', name: 'Cash on Hand', nameAr: 'النقدية بالصندوق', type: 'asset', subtype: 'cash' },
  { code: '1100', name: 'Bank Accounts', nameAr: 'الحسابات البنكية', type: 'asset', subtype: 'bank' },
  { code: '1200', name: 'Accounts Receivable', nameAr: 'الذمم المدينة', type: 'asset', subtype: 'receivable' },
  { code: '1250', name: 'Outstanding Receipts', nameAr: 'مقبوضات معلقة', type: 'asset', subtype: 'other_asset' },
  { code: '1300', name: 'Inventory', nameAr: 'المخزون', type: 'asset', subtype: 'inventory' },
  { code: '1400', name: 'VAT Input (Recoverable)', nameAr: 'ضريبة المدخلات', type: 'asset', subtype: 'other_asset' },
  { code: '1500', name: 'Prepaid Expenses', nameAr: 'مصروفات مدفوعة مقدماً', type: 'asset', subtype: 'other_asset' },
  { code: '1600', name: 'Fixed Assets', nameAr: 'الأصول الثابتة', type: 'asset', subtype: 'fixed_asset' },
  { code: '1650', name: 'Accumulated Depreciation', nameAr: 'مجمع الإهلاك', type: 'asset', subtype: 'accum_depreciation' },
  { code: '1900', name: 'Suspense / Clearing', nameAr: 'حساب وسيط / مقاصة', type: 'asset', subtype: 'other_asset' },
  { code: '2400', name: 'Deferred Revenue', nameAr: 'إيرادات مؤجلة', type: 'liability', subtype: 'other_liability' },
  { code: '2000', name: 'Accounts Payable', nameAr: 'الذمم الدائنة', type: 'liability', subtype: 'payable' },
  { code: '2050', name: 'Outstanding Payments', nameAr: 'مدفوعات معلقة', type: 'liability', subtype: 'other_liability' },
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
  outstandingReceipts: '1250',
  inventory: '1300',
  vatInput: '1400',
  suspense: '1900',
  ap: '2000',
  outstandingPayments: '2050',
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
  depreciation: '5600',
  accumDepreciation: '1650',
  prepaid: '1500',
  deferredRevenue: '2400',
};

/** Tenant settings.accounting.defaultAccounts keys ↔ posting roles */
export const DEFAULT_ACCOUNT_KEYS = [
  'receivableAccountId',
  'payableAccountId',
  'incomeAccountId',
  'expenseAccountId',
  'cogsAccountId',
  'bankAccountId',
  'cashAccountId',
  'taxInputAccountId',
  'taxOutputAccountId',
  'suspenseAccountId',
  'inventoryAccountId',
  'outstandingPaymentsAccountId',
  'outstandingReceiptsAccountId',
];

const ROLE_TO_DEFAULT_KEY = {
  ar: 'receivableAccountId',
  ap: 'payableAccountId',
  sales: 'incomeAccountId',
  opex: 'expenseAccountId',
  cogs: 'cogsAccountId',
  bank: 'bankAccountId',
  cash: 'cashAccountId',
  vatInput: 'taxInputAccountId',
  vatOutput: 'taxOutputAccountId',
  suspense: 'suspenseAccountId',
  inventory: 'inventoryAccountId',
  outstandingPayments: 'outstandingPaymentsAccountId',
  outstandingReceipts: 'outstandingReceiptsAccountId',
};

const DEFAULT_KEY_TO_CODE = {
  receivableAccountId: ACCOUNT_CODE_MAP.ar,
  payableAccountId: ACCOUNT_CODE_MAP.ap,
  incomeAccountId: ACCOUNT_CODE_MAP.sales,
  expenseAccountId: ACCOUNT_CODE_MAP.opex,
  cogsAccountId: ACCOUNT_CODE_MAP.cogs,
  bankAccountId: ACCOUNT_CODE_MAP.bank,
  cashAccountId: ACCOUNT_CODE_MAP.cash,
  taxInputAccountId: ACCOUNT_CODE_MAP.vatInput,
  taxOutputAccountId: ACCOUNT_CODE_MAP.vatOutput,
  suspenseAccountId: ACCOUNT_CODE_MAP.suspense,
  inventoryAccountId: ACCOUNT_CODE_MAP.inventory,
  outstandingPaymentsAccountId: ACCOUNT_CODE_MAP.outstandingPayments,
  outstandingReceiptsAccountId: ACCOUNT_CODE_MAP.outstandingReceipts,
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
      partnerId: line.partnerId || null,
      taxIds: Array.isArray(line.taxIds) ? line.taxIds.filter(Boolean) : [],
      analyticAccountId: line.analyticAccountId || null,
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
  if (existing === 0) {
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
  } else {
    // Backfill any newly added system codes (e.g. suspense 1900) without wiping custom CoA
    for (const row of DEFAULT_CHART_OF_ACCOUNTS) {
      const found = await ChartOfAccount.findOne({ tenantId, code: row.code }).select('_id').lean();
      if (found) continue;
      await ChartOfAccount.create({
        ...row,
        tenantId,
        currency,
        isSystem: true,
        isActive: true,
        isPostable: true,
        balance: 0,
        createdBy: userId || undefined,
      });
    }
  }

  return ChartOfAccount.find({ tenantId }).sort({ code: 1 }).lean();
}

export async function getAccountByCode(tenantId, code) {
  return ChartOfAccount.findOne({ tenantId, code: String(code), isActive: true });
}

export async function getAccountMap(tenantId) {
  await ensureDefaultChartOfAccounts(tenantId);
  const rows = await ChartOfAccount.find({ tenantId, isActive: true }).lean();
  const byCode = {};
  const byId = {};
  const bySubtype = {};
  for (const row of rows) {
    byCode[row.code] = row;
    byId[String(row._id)] = row;
    if (row.subtype && !bySubtype[row.subtype]) bySubtype[row.subtype] = row;
  }
  return { byCode, byId, bySubtype, rows };
}

/**
 * Raw ObjectIds from tenant.settings.accounting.defaultAccounts (may be null).
 */
export async function getAccountingDefaultAccountIds(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.defaultAccounts').lean();
  const raw = tenant?.settings?.accounting?.defaultAccounts || {};
  const out = {};
  for (const key of DEFAULT_ACCOUNT_KEYS) {
    out[key] = raw[key] || null;
  }
  return out;
}

/**
 * Ensure missing default account ids are filled from standard CoA codes.
 * Returns { ids, accounts } where accounts are lean CoA docs keyed by DEFAULT_ACCOUNT_KEYS.
 */
export async function ensureAccountingDefaults(tenantId, userId = null) {
  await ensureDefaultChartOfAccounts(tenantId, userId);
  const { byCode, byId } = await getAccountMap(tenantId);
  const ids = await getAccountingDefaultAccountIds(tenantId);
  const update = {};
  let changed = false;

  for (const key of DEFAULT_ACCOUNT_KEYS) {
    const current = ids[key];
    if (current && byId[String(current)]) continue;
    const code = DEFAULT_KEY_TO_CODE[key];
    const acct = code ? byCode[code] : null;
    if (acct?._id) {
      ids[key] = acct._id;
      update[`settings.accounting.defaultAccounts.${key}`] = acct._id;
      changed = true;
    } else {
      ids[key] = null;
    }
  }

  if (changed) {
    await Tenant.findByIdAndUpdate(tenantId, { $set: update });
  }

  const accounts = {};
  for (const key of DEFAULT_ACCOUNT_KEYS) {
    accounts[key] = ids[key] ? (byId[String(ids[key])] || null) : null;
  }
  return { ids, accounts };
}

export async function getAccountingDefaults(tenantId) {
  const { ids, accounts } = await ensureAccountingDefaults(tenantId);
  return {
    ...ids,
    accounts,
    roles: Object.fromEntries(
      Object.entries(ROLE_TO_DEFAULT_KEY).map(([role, key]) => [role, accounts[key] || null]),
    ),
  };
}

export async function setAccountingDefaults(tenantId, patch = {}) {
  const { byId } = await getAccountMap(tenantId);
  const update = {};
  for (const key of DEFAULT_ACCOUNT_KEYS) {
    if (patch[key] === undefined) continue;
    const val = patch[key];
    if (val === null || val === '') {
      update[`settings.accounting.defaultAccounts.${key}`] = null;
      continue;
    }
    if (!byId[String(val)]) {
      throw new Error(`Invalid account for ${key}`);
    }
    update[`settings.accounting.defaultAccounts.${key}`] = val;
  }
  if (Object.keys(update).length) {
    await Tenant.findByIdAndUpdate(tenantId, { $set: update });
  }
  return getAccountingDefaults(tenantId);
}

/** Ensure system 15% VAT sales/purchase taxes linked to default tax GL accounts. */
export async function ensureDefaultTaxes(tenantId, userId = null) {
  const Tax = (await import('../models/Tax.js')).default;
  const { byCode } = await getAccountMap(tenantId);
  const salesAcct = byCode[ACCOUNT_CODE_MAP.vatOutput]
    || (await resolveRoleAccount(tenantId, 'vatOutput'));
  const purchaseAcct = byCode[ACCOUNT_CODE_MAP.vatInput]
    || (await resolveRoleAccount(tenantId, 'vatInput'));
  const seeds = [
    {
      code: 'VAT15-OUT',
      name: 'VAT 15% (Output)',
      nameAr: 'ضريبة القيمة المضافة ١٥٪ (مخرجات)',
      rate: 15,
      type: 'sales',
      accountId: salesAcct?._id,
    },
    {
      code: 'VAT15-IN',
      name: 'VAT 15% (Input)',
      nameAr: 'ضريبة القيمة المضافة ١٥٪ (مدخلات)',
      rate: 15,
      type: 'purchase',
      accountId: purchaseAcct?._id,
    },
  ];

  const out = [];
  for (const seed of seeds) {
    if (!seed.accountId) continue;
    let tax = await Tax.findOne({ tenantId, code: seed.code });
    if (!tax) {
      tax = await Tax.create({
        ...seed,
        tenantId,
        active: true,
        isSystem: true,
        createdBy: userId || undefined,
      });
    } else if (!tax.accountId) {
      tax.accountId = seed.accountId;
      await tax.save();
    }
    out.push(tax);
  }
  return out;
}

export async function listTaxes(tenantId, { type = null, activeOnly = true } = {}) {
  await ensureDefaultTaxes(tenantId);
  const Tax = (await import('../models/Tax.js')).default;
  const filter = { tenantId };
  if (type) filter.type = type;
  if (activeOnly) filter.active = { $ne: false };
  return Tax.find(filter)
    .populate('accountId', 'code name nameAr')
    .sort({ type: 1, rate: 1, code: 1 })
    .lean();
}

export async function createTax(tenantId, userId, payload = {}) {
  const Tax = (await import('../models/Tax.js')).default;
  const code = String(payload.code || '').trim().toUpperCase();
  const name = String(payload.name || '').trim();
  const type = payload.type === 'purchase' ? 'purchase' : 'sales';
  const rate = Number(payload.rate);
  const accountId = payload.accountId;
  if (!code || !name) throw new Error('code and name required');
  if (!(rate >= 0)) throw new Error('rate required');
  if (!accountId) throw new Error('accountId required');
  const existing = await Tax.findOne({ tenantId, code });
  if (existing) throw new Error('Tax code already exists');
  return Tax.create({
    tenantId,
    code,
    name,
    nameAr: payload.nameAr || '',
    rate,
    type,
    accountId,
    active: payload.active !== false,
    createdBy: userId || undefined,
  });
}

export async function updateTax(tenantId, userId, taxId, patch = {}) {
  const Tax = (await import('../models/Tax.js')).default;
  const tax = await Tax.findOne({ _id: taxId, tenantId });
  if (!tax) throw new Error('Tax not found');
  if (patch.name !== undefined) tax.name = String(patch.name).trim();
  if (patch.nameAr !== undefined) tax.nameAr = String(patch.nameAr || '').trim();
  if (patch.rate !== undefined) tax.rate = Number(patch.rate);
  if (patch.accountId !== undefined) tax.accountId = patch.accountId;
  if (patch.active !== undefined) tax.active = Boolean(patch.active);
  if (patch.type !== undefined && !tax.isSystem) {
    tax.type = patch.type === 'purchase' ? 'purchase' : 'sales';
  }
  tax.updatedBy = userId || undefined;
  await tax.save();
  return tax;
}

/** Default tax ObjectId for sales or purchase (system VAT 15% preferred). */
export async function resolveDefaultTaxId(tenantId, type = 'sales') {
  await ensureDefaultTaxes(tenantId);
  const Tax = (await import('../models/Tax.js')).default;
  const tax = await Tax.findOne({
    tenantId,
    type: type === 'purchase' ? 'purchase' : 'sales',
    active: { $ne: false },
  }).sort({ isSystem: -1, rate: -1 }).select('_id').lean();
  return tax?._id || null;
}

/**
 * Resolve a posting role account: partner override → tenant default → CoA code.
 * @param {string} role — ACCOUNT_CODE_MAP key (ar, ap, sales, cash, bank, …)
 */
export async function resolveRoleAccount(tenantId, role, {
  byCode = null,
  byId = null,
  defaultIds = null,
  partnerAccountId = null,
} = {}) {
  const map = byCode && byId
    ? { byCode, byId }
    : await getAccountMap(tenantId);

  if (partnerAccountId) {
    const partnerAcct = map.byId[String(partnerAccountId)]
      || await ChartOfAccount.findOne({ _id: partnerAccountId, tenantId, isActive: true }).lean();
    if (partnerAcct) return partnerAcct;
  }

  const ids = defaultIds || (await ensureAccountingDefaults(tenantId)).ids;
  const key = ROLE_TO_DEFAULT_KEY[role];
  if (key && ids[key]) {
    const fromDefault = map.byId[String(ids[key])];
    if (fromDefault) return fromDefault;
  }

  const code = ACCOUNT_CODE_MAP[role];
  return (code && map.byCode[code]) || null;
}

async function nextEntryNumber(tenantId, sequencePrefix = null) {
  const year = new Date().getFullYear();
  const base = String(sequencePrefix || 'JE').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'JE';
  const prefix = `${base}-${year}-`;
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

/** Start-of-day UTC for date-only comparison */
function startOfDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function getAccountingLockDates(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting').lean();
  const a = tenant?.settings?.accounting || {};
  return {
    lockDate: a.lockDate || null,
    taxLockDate: a.taxLockDate || null,
    hardLockDate: a.hardLockDate || null,
  };
}

export async function setAccountingLockDates(tenantId, { lockDate, taxLockDate, hardLockDate } = {}) {
  const update = {};
  if (lockDate !== undefined) {
    update['settings.accounting.lockDate'] = lockDate ? new Date(lockDate) : null;
  }
  if (taxLockDate !== undefined) {
    update['settings.accounting.taxLockDate'] = taxLockDate ? new Date(taxLockDate) : null;
  }
  if (hardLockDate !== undefined) {
    update['settings.accounting.hardLockDate'] = hardLockDate ? new Date(hardLockDate) : null;
  }
  await Tenant.findByIdAndUpdate(tenantId, { $set: update });
  return getAccountingLockDates(tenantId);
}

/**
 * Block posting (and hard-block reverses) when entryDate is on/before a lock date.
 * @param {'post'|'reverse'|'tax'} mode — tax also respects taxLockDate
 */
export async function assertAccountingPeriodOpen(tenantId, entryDate, mode = 'post') {
  const locks = await getAccountingLockDates(tenantId);
  const day = startOfDay(entryDate || new Date());
  if (!day) throw new Error('Invalid entry date');

  const hard = locks.hardLockDate ? startOfDay(locks.hardLockDate) : null;
  if (hard && day.getTime() <= hard.getTime()) {
    throw new Error(
      `Accounting period is hard-locked through ${hard.toISOString().slice(0, 10)}. No posts or reversals allowed.`,
    );
  }

  if (mode === 'post' || mode === 'tax') {
    const soft = locks.lockDate ? startOfDay(locks.lockDate) : null;
    if (soft && day.getTime() <= soft.getTime()) {
      throw new Error(
        `Accounting period is locked through ${soft.toISOString().slice(0, 10)}. Cannot post entries on or before this date.`,
      );
    }
  }

  if (mode === 'tax' || mode === 'post') {
    const tax = locks.taxLockDate ? startOfDay(locks.taxLockDate) : null;
    if (mode === 'tax' && tax && day.getTime() <= tax.getTime()) {
      throw new Error(
        `Tax period is locked through ${tax.toISOString().slice(0, 10)}. Cannot post tax-affecting entries on or before this date.`,
      );
    }
  }
}

async function syncJournalItemsFromMove(entry, { state = 'posted' } = {}) {
  if (!entry?._id) return;
  // Preserve reconciliation matches across re-sync
  const existing = await JournalItem.find({ tenantId: entry.tenantId, moveId: entry._id })
    .select('lineIndex reconcileId')
    .lean();
  const reconcileByIndex = new Map(
    existing.filter((r) => r.reconcileId).map((r) => [Number(r.lineIndex), r.reconcileId]),
  );

  await JournalItem.deleteMany({ tenantId: entry.tenantId, moveId: entry._id });
  const lines = Array.isArray(entry.lines) ? entry.lines : [];
  if (!lines.length) return;
  const docs = lines.map((line, lineIndex) => ({
    tenantId: entry.tenantId,
    moveId: entry._id,
    journalId: entry.journalId || null,
    entryNumber: entry.entryNumber || '',
    entryDate: entry.entryDate,
    postingDate: entry.postingDate || (state === 'posted' ? new Date() : null),
    accountId: line.accountId,
    accountCode: line.accountCode || '',
    accountName: line.accountName || '',
    partnerId: line.partnerId || null,
    taxIds: Array.isArray(line.taxIds) ? line.taxIds : [],
    analyticAccountId: line.analyticAccountId || null,
    reconcileId: reconcileByIndex.get(lineIndex) || null,
    description: line.description || '',
    debit: Number(line.debit || 0),
    credit: Number(line.credit || 0),
    currency: entry.currency || 'SAR',
    state,
    sourceModel: entry.sourceModel || '',
    sourceId: entry.sourceId || undefined,
    lineIndex,
  }));
  await JournalItem.insertMany(docs);
}

async function cancelJournalItemsForMove(tenantId, moveId) {
  await JournalItem.updateMany(
    { tenantId, moveId },
    { $set: { state: 'cancelled' } },
  );
}

/**
 * Backfill JournalItem rows for already-posted moves (idempotent per move).
 */
export async function backfillJournalItems(tenantId, { limit = 500 } = {}) {
  const posted = await JournalEntry.find({
    tenantId,
    status: 'posted',
  })
    .sort({ entryDate: 1 })
    .limit(Math.min(2000, Number(limit) || 500));

  let synced = 0;
  for (const entry of posted) {
    const existing = await JournalItem.countDocuments({ tenantId, moveId: entry._id, state: 'posted' });
    if (existing === (entry.lines || []).length && existing > 0) continue;
    await syncJournalItemsFromMove(entry, { state: 'posted' });
    synced += 1;
  }
  return { scanned: posted.length, synced };
}

export async function listJournalItems(tenantId, {
  accountId,
  partnerId,
  moveId,
  analyticAccountId,
  journalId,
  accountType,
  q,
  from,
  to,
  state = 'posted',
  limit = 100,
  skip = 0,
} = {}) {
  const filter = { tenantId };
  if (accountId) filter.accountId = accountId;
  if (partnerId) filter.partnerId = partnerId;
  if (moveId) filter.moveId = moveId;
  if (analyticAccountId) filter.analyticAccountId = analyticAccountId;
  if (journalId) filter.journalId = journalId;
  if (state && state !== 'all') filter.state = state;
  if (accountType) {
    const acctIds = await ChartOfAccount.find({
      tenantId,
      type: String(accountType),
      isActive: true,
    }).select('_id').lean();
    filter.accountId = { $in: acctIds.map((a) => a._id) };
  }
  if (from || to) {
    filter.entryDate = {};
    if (from) filter.entryDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = end;
    }
  }
  const query = String(q || '').trim();
  if (query) {
    const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { entryNumber: rx },
      { accountCode: rx },
      { accountName: rx },
      { description: rx },
    ];
  }
  const cap = Math.min(2000, Math.max(1, Number(limit) || 100));
  const [items, total] = await Promise.all([
    JournalItem.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(Number(skip) || 0)
      .limit(cap)
      .lean(),
    JournalItem.countDocuments(filter),
  ]);

  const partnerIds = [...new Set(items.map((i) => String(i.partnerId || '')).filter(Boolean))];
  const analyticIds = [...new Set(items.map((i) => String(i.analyticAccountId || '')).filter(Boolean))];
  const journalIds = [...new Set(items.map((i) => String(i.journalId || '')).filter(Boolean))];

  let partnerMap = {};
  let analyticMap = {};
  let journalMap = {};
  if (partnerIds.length) {
    try {
      const Partner = (await import('../models/Partner.js')).default;
      const partners = await Partner.find({ _id: { $in: partnerIds }, tenantId })
        .select('name nameAr nameEn displayName')
        .lean();
      partnerMap = Object.fromEntries(partners.map((p) => [String(p._id), p]));
    } catch { /* optional */ }
  }
  if (analyticIds.length) {
    try {
      const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;
      const rows = await AnalyticAccount.find({ _id: { $in: analyticIds }, tenantId })
        .select('code name nameAr')
        .lean();
      analyticMap = Object.fromEntries(rows.map((a) => [String(a._id), a]));
    } catch { /* optional */ }
  }
  if (journalIds.length) {
    try {
      const Journal = (await import('../models/Journal.js')).default;
      const books = await Journal.find({ _id: { $in: journalIds }, tenantId })
        .select('code name nameAr')
        .lean();
      journalMap = Object.fromEntries(books.map((j) => [String(j._id), j]));
    } catch { /* optional */ }
  }

  const enriched = items.map((item) => {
    const partner = item.partnerId ? partnerMap[String(item.partnerId)] : null;
    const analytic = item.analyticAccountId ? analyticMap[String(item.analyticAccountId)] : null;
    const book = item.journalId ? journalMap[String(item.journalId)] : null;
    return {
      ...item,
      partnerName: partner?.displayName || partner?.nameEn || partner?.name || partner?.nameAr || '',
      partnerNameAr: partner?.nameAr || partner?.name || '',
      analyticCode: analytic?.code || '',
      analyticName: analytic?.name || '',
      journalCode: book?.code || '',
      journalName: book?.name || '',
    };
  });

  const totalDebit = round2(enriched.reduce((s, r) => s + (Number(r.debit) || 0), 0));
  const totalCredit = round2(enriched.reduce((s, r) => s + (Number(r.credit) || 0), 0));

  return { items: enriched, total, totalDebit, totalCredit, limit: cap, skip: Number(skip) || 0 };
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
  journalId = null,
  bypassLockCheck = false,
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
      partnerId: line.partnerId || null,
      taxIds: line.taxIds || [],
      analyticAccountId: line.analyticAccountId || null,
    });
  }

  const { debit, credit } = assertBalanced(enriched);

  let resolvedJournalId = journalId || null;
  let sequencePrefix = null;
  if (resolvedJournalId) {
    const Journal = (await import('../models/Journal.js')).default;
    const book = await Journal.findOne({ _id: resolvedJournalId, tenantId, active: { $ne: false } }).lean();
    if (!book) throw new Error('Journal book not found');
    sequencePrefix = book.sequencePrefix || book.code || null;
    resolvedJournalId = book._id;
  }

  const number = entryNumber || await nextEntryNumber(tenantId, sequencePrefix);

  // Soft/hard lock applies to draft creates too (controllership: no backdating into locked periods)
  if (!bypassLockCheck) {
    await assertAccountingPeriodOpen(tenantId, entryDate, 'post');
    const hasTax = enriched.some((l) => Array.isArray(l.taxIds) && l.taxIds.length);
    if (hasTax) {
      await assertAccountingPeriodOpen(tenantId, entryDate, 'tax');
    }
  }

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
    journalId: resolvedJournalId || undefined,
    createdBy: userId || undefined,
  });

  await syncJournalItemsFromMove(entry, { state: 'draft' });

  if (status === 'posted') {
    return postJournalEntry(tenantId, entry._id, userId, { bypassLockCheck });
  }
  return entry;
}

export async function postJournalEntry(tenantId, entryId, userId, { bypassLockCheck = false } = {}) {
  const entry = await JournalEntry.findOne({ _id: entryId, tenantId });
  if (!entry) throw new Error('Journal entry not found');
  if (entry.status === 'posted') return entry;
  if (entry.status === 'void') throw new Error('Cannot post a voided entry');
  if (entry.status === 'reversed') throw new Error('Cannot post a reversed entry');

  if (!bypassLockCheck) {
    await assertAccountingPeriodOpen(tenantId, entry.entryDate, 'post');
    const hasTax = (entry.lines || []).some((l) => Array.isArray(l.taxIds) && l.taxIds.length);
    if (hasTax) {
      await assertAccountingPeriodOpen(tenantId, entry.entryDate, 'tax');
    }
  }

  const lines = normaliseLines(entry.lines);
  assertBalanced(lines);
  await applyBalanceDelta(tenantId, lines, 1);

  entry.status = 'posted';
  entry.postingDate = new Date();
  entry.postedBy = userId || undefined;
  entry.totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  entry.totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  await entry.save();
  await syncJournalItemsFromMove(entry, { state: 'posted' });
  return entry;
}

/**
 * Draft → void (no balance impact).
 * Posted → formal reverse move (immutability). Never mutate posted balances in-place.
 */
export async function voidJournalEntry(tenantId, entryId, userId, reason = '') {
  const entry = await JournalEntry.findOne({ _id: entryId, tenantId });
  if (!entry) throw new Error('Journal entry not found');
  if (entry.status === 'void' || entry.status === 'reversed') return entry;

  if (entry.status === 'posted') {
    return reverseJournalEntry(tenantId, entryId, userId, reason || 'Reversal');
  }

  entry.status = 'void';
  entry.voidedAt = new Date();
  entry.voidedBy = userId || undefined;
  entry.voidReason = reason || '';
  await entry.save();
  await cancelJournalItemsForMove(tenantId, entry._id);
  return entry;
}

/**
 * Create a counter-entry that reverses a posted move. Original stays posted→reversed.
 */
export async function reverseJournalEntry(tenantId, entryId, userId, reason = '') {
  const entry = await JournalEntry.findOne({ _id: entryId, tenantId });
  if (!entry) throw new Error('Journal entry not found');
  if (entry.status === 'reversed') {
    if (entry.reversedById) {
      const existing = await JournalEntry.findOne({ _id: entry.reversedById, tenantId });
      if (existing) return existing;
    }
    throw new Error('Entry already reversed');
  }
  if (entry.status !== 'posted') {
    throw new Error('Only posted entries can be reversed');
  }
  if (entry.reversedById) {
    throw new Error('Entry already has a reversal');
  }

  await assertAccountingPeriodOpen(tenantId, entry.entryDate, 'reverse');

  const reverseLines = normaliseLines(entry.lines).map((line) => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    description: reason
      ? `${reason} — reverse ${entry.entryNumber}`
      : `Reverse ${entry.entryNumber}`,
    debit: line.credit,
    credit: line.debit,
    partnerId: line.partnerId || null,
    taxIds: line.taxIds || [],
    analyticAccountId: line.analyticAccountId || null,
  }));

  const reversal = await createJournalEntry({
    tenantId,
    userId,
    entryDate: new Date(),
    type: 'reversal',
    memo: reason || `Reversal of ${entry.entryNumber}`,
    memoAr: '',
    reference: entry.entryNumber,
    currency: entry.currency || 'SAR',
    lines: reverseLines,
    sourceModel: entry.sourceModel || 'JournalEntry',
    sourceId: entry._id,
    sourceNumber: entry.entryNumber,
    status: 'posted',
    journalId: entry.journalId || null,
  });

  // createJournalEntry with posted already posts; attach reverse linkage
  const postedReversal = await JournalEntry.findOne({ _id: reversal._id, tenantId });
  if (postedReversal) {
    postedReversal.reversalOfId = entry._id;
    postedReversal.type = 'reversal';
    await postedReversal.save();
  }

  entry.status = 'reversed';
  entry.reversedById = postedReversal?._id || reversal._id;
  entry.voidedAt = new Date();
  entry.voidedBy = userId || undefined;
  entry.voidReason = reason || 'Reversed';
  await entry.save();
  // Keep original JournalItems posted; reversal items provide the counter-lines.
  // Net of all posted items matches COA balances.

  return postedReversal || reversal;
}

async function findExistingSourceEntry(tenantId, sourceModel, sourceId) {
  if (!sourceId) return null;
  return JournalEntry.findOne({
    tenantId,
    sourceModel,
    sourceId,
    status: { $nin: ['void', 'reversed'] },
  });
}

function paymentAccountCode(method = 'bank_transfer') {
  const m = String(method || '').toLowerCase();
  if (m.includes('cash')) return ACCOUNT_CODE_MAP.cash;
  return ACCOUNT_CODE_MAP.bank;
}

function paymentLiquidityRole(method = 'bank_transfer') {
  return paymentAccountCode(method) === ACCOUNT_CODE_MAP.cash ? 'cash' : 'bank';
}

async function resolveLiquidityAccount(tenantId, paymentMethod, ctx = {}) {
  const role = paymentLiquidityRole(paymentMethod);
  const primary = await resolveRoleAccount(tenantId, role, ctx);
  if (primary) return { account: primary, role };
  const fallbackRole = role === 'cash' ? 'bank' : 'cash';
  const fallback = await resolveRoleAccount(tenantId, fallbackRole, ctx);
  return { account: fallback, role: fallback ? fallbackRole : role };
}

async function resolveJournalBookId(tenantId, userId, ensureFnName) {
  try {
    const mod = await import('./inventory/stockAccounting.js');
    const fn = mod[ensureFnName];
    if (typeof fn !== 'function') return null;
    const book = await fn(tenantId, userId);
    return book?._id || null;
  } catch {
    return null;
  }
}

function stampPartnerId(lines = [], partnerId = null) {
  if (!partnerId) return lines;
  return lines.map((l) => ({ ...l, partnerId: l.partnerId || partnerId }));
}

async function loadPartnerAccountIds(tenantId, partnerId) {
  if (!partnerId) return { receivableAccountId: null, payableAccountId: null };
  try {
    const Partner = (await import('../models/Partner.js')).default;
    const partner = await Partner.findOne({ _id: partnerId, tenantId })
      .select('receivableAccountId payableAccountId')
      .lean();
    return {
      receivableAccountId: partner?.receivableAccountId || null,
      payableAccountId: partner?.payableAccountId || null,
    };
  } catch {
    return { receivableAccountId: null, payableAccountId: null };
  }
}

/**
 * Absolute economics from an invoice/credit-note document (handles negative ZATCA CN totals).
 */
function absInvoiceAmounts(doc = {}) {
  const tax = Math.abs(round2(Number(doc.totalTax ?? doc.taxAmount ?? 0)));
  const gross = Math.abs(round2(Number(doc.grandTotal || 0)));
  let net = Math.abs(round2(Number(doc.taxableAmount ?? doc.subtotal ?? (gross - tax))));
  if (round2(net + tax) !== gross && gross > 0) net = round2(Math.max(0, gross - tax));
  return { net, tax, gross };
}

/**
 * Split AR debit into payment-term tranches when invoice has a multi-line schedule.
 */
export function buildReceivableDebitLines({
  ar,
  gross,
  paymentSchedule = null,
  description = '',
  partnerId = null,
}) {
  const amount = round2(Math.abs(Number(gross) || 0));
  if (amount <= 0 || !ar) return [];

  const schedule = (Array.isArray(paymentSchedule) ? paymentSchedule : [])
    .filter((row) => round2(Number(row.amount || 0)) > 0)
    .map((row, index) => ({
      sequence: Number(row.sequence) || index + 1,
      amount: round2(Number(row.amount || 0)),
      dueDate: row.dueDate ? new Date(row.dueDate) : null,
      labelEn: row.labelEn || '',
      labelAr: row.labelAr || '',
    }));

  if (schedule.length <= 1) {
    return [{
      accountId: ar._id,
      accountCode: ar.code,
      debit: amount,
      credit: 0,
      description: description || 'Accounts receivable',
      partnerId: partnerId || null,
      dueDate: schedule[0]?.dueDate || null,
      trancheSequence: schedule[0]?.sequence || null,
    }];
  }

  const scheduleTotal = round2(schedule.reduce((s, row) => s + row.amount, 0));
  return schedule.map((row, index) => {
    let debit = row.amount;
    if (scheduleTotal > 0 && Math.abs(scheduleTotal - amount) > 0.02) {
      debit = round2((row.amount / scheduleTotal) * amount);
    }
    if (index === schedule.length - 1) {
      const prior = schedule.slice(0, -1).reduce((s, r, i) => {
        const part = scheduleTotal > 0 && Math.abs(scheduleTotal - amount) > 0.02
          ? round2((r.amount / scheduleTotal) * amount)
          : r.amount;
        return round2(s + part);
      }, 0);
      debit = round2(amount - prior);
    }
    return {
      accountId: ar._id,
      accountCode: ar.code,
      debit,
      credit: 0,
      description: `${description || 'Accounts receivable'} — ${row.labelEn || row.labelAr || `Tranche ${row.sequence}`}`.trim(),
      partnerId: partnerId || null,
      dueDate: row.dueDate,
      trancheSequence: row.sequence,
    };
  });
}

/**
 * Split AP credit into payment-term tranches when bill has a multi-line schedule.
 */
export function buildPayableCreditLines({
  ap,
  gross,
  paymentSchedule = null,
  description = '',
  partnerId = null,
}) {
  const amount = round2(Math.abs(Number(gross) || 0));
  if (amount <= 0 || !ap) return [];

  const schedule = (Array.isArray(paymentSchedule) ? paymentSchedule : [])
    .filter((row) => round2(Number(row.amount || 0)) > 0)
    .map((row, index) => ({
      sequence: Number(row.sequence) || index + 1,
      amount: round2(Number(row.amount || 0)),
      dueDate: row.dueDate ? new Date(row.dueDate) : null,
      labelEn: row.labelEn || '',
      labelAr: row.labelAr || '',
    }));

  if (schedule.length <= 1) {
    return [{
      accountId: ap._id,
      accountCode: ap.code,
      debit: 0,
      credit: amount,
      description: description || 'Accounts payable',
      partnerId: partnerId || null,
      dueDate: schedule[0]?.dueDate || null,
      trancheSequence: schedule[0]?.sequence || null,
    }];
  }

  const scheduleTotal = round2(schedule.reduce((s, row) => s + row.amount, 0));
  return schedule.map((row, index) => {
    let credit = row.amount;
    if (scheduleTotal > 0 && Math.abs(scheduleTotal - amount) > 0.02) {
      credit = round2((row.amount / scheduleTotal) * amount);
    }
    if (index === schedule.length - 1) {
      const prior = schedule.slice(0, -1).reduce((s, r, i) => {
        const part = scheduleTotal > 0 && Math.abs(scheduleTotal - amount) > 0.02
          ? round2((r.amount / scheduleTotal) * amount)
          : r.amount;
        return round2(s + part);
      }, 0);
      credit = round2(amount - prior);
    }
    return {
      accountId: ap._id,
      accountCode: ap.code,
      debit: 0,
      credit,
      description: `${description || 'Accounts payable'} — ${row.labelEn || row.labelAr || `Tranche ${row.sequence}`}`.trim(),
      partnerId: partnerId || null,
      dueDate: row.dueDate,
      trancheSequence: row.sequence,
    };
  });
}

/**
 * Allocate payment against open tranches (FIFO). Early-discount schedules use one active path.
 */
export function allocatePaymentToTranches(invoice, payAmount) {
  const amount = round2(Number(payAmount) || 0);
  if (amount <= 0) return [];

  const schedule = (Array.isArray(invoice?.paymentSchedule) ? invoice.paymentSchedule : [])
    .filter((row) => round2(Number(row.amount || 0)) > 0)
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));

  if (!schedule.length) {
    return [{
      trancheSequence: null,
      amount,
      dueDate: invoice?.dueDate || null,
    }];
  }

  if (invoice?.earlyPaymentDiscount?.deadline && schedule.length === 2) {
    const paid = round2(Number(invoice.paidAmount || 0));
    const gross = round2(Number(invoice.grandTotal || 0));
    const discounted = round2(Number(invoice.earlyPaymentDiscount.discountedAmount || 0));
    const onDiscountPath = paid < discounted - 0.005 && round2(gross - paid) > 0.005;
    const active = onDiscountPath ? schedule[0] : schedule[1];
    const activeResidual = onDiscountPath
      ? round2(Math.max(0, discounted - paid))
      : round2(Math.max(0, gross - paid));
    const applied = round2(Math.min(amount, activeResidual));
    if (applied <= 0) return [];
    return [{
      trancheSequence: active.sequence,
      amount: applied,
      dueDate: active.dueDate || null,
    }];
  }

  if (schedule.length === 1) {
    return [{
      trancheSequence: schedule[0].sequence,
      amount,
      dueDate: schedule[0].dueDate || invoice?.dueDate || null,
    }];
  }

  let remainingPaid = round2(Number(invoice.paidAmount || 0));
  let remainingPay = amount;
  const allocations = [];

  for (const tranche of schedule) {
    const trancheAmount = round2(Number(tranche.amount || 0));
    const paidOnTranche = Math.min(remainingPaid, trancheAmount);
    remainingPaid = round2(remainingPaid - paidOnTranche);
    const trancheResidual = round2(trancheAmount - paidOnTranche);
    if (trancheResidual < 0.01) continue;
    if (remainingPay <= 0) break;

    const applied = round2(Math.min(remainingPay, trancheResidual));
    allocations.push({
      trancheSequence: tranche.sequence,
      amount: applied,
      dueDate: tranche.dueDate || null,
    });
    remainingPay = round2(remainingPay - applied);
  }

  if (remainingPay > 0.005) {
    if (allocations.length) {
      allocations[allocations.length - 1].amount = round2(allocations[allocations.length - 1].amount + remainingPay);
    } else {
      allocations.push({
        trancheSequence: schedule[schedule.length - 1]?.sequence || null,
        amount: remainingPay,
        dueDate: schedule[schedule.length - 1]?.dueDate || invoice?.dueDate || null,
      });
    }
  }

  return allocations.length
    ? allocations
    : [{ trancheSequence: null, amount, dueDate: invoice?.dueDate || null }];
}

function resolveInvoicePaymentScheduleForPosting(invoice, gross) {
  if (invoice?.earlyPaymentDiscount?.deadline) return null;
  if (invoice?.paymentSchedule?.length) return invoice.paymentSchedule;
  return computePaymentSchedule(invoice?.issueDate, invoice?.paymentTerms, gross).tranches;
}

/**
 * Sales invoice journal lines: AR Dr, revenue Cr (optionally split), VAT Cr.
 * @param {{ account: {_id, code}, amount: number }[]} [revenueCredits]
 */
export function buildSalesInvoiceJournalLines({
  netAmount,
  taxAmount = 0,
  ar,
  vatOut = null,
  defaultSales = null,
  revenueCredits = null,
  description = '',
  partnerId = null,
  taxIds = null,
  paymentSchedule = null,
}) {
  const net = round2(Math.abs(Number(netAmount) || 0));
  const tax = round2(Math.max(0, Number(taxAmount) || 0));
  const gross = round2(net + tax);
  if (gross <= 0 || !ar) return [];
  const vatTaxIds = Array.isArray(taxIds) && taxIds.length ? taxIds.filter(Boolean) : [];

  const lines = buildReceivableDebitLines({
    ar,
    gross,
    paymentSchedule,
    description,
    partnerId,
  });

  if (Array.isArray(revenueCredits) && revenueCredits.length) {
    const byAcct = new Map();
    for (const r of revenueCredits) {
      const amt = round2(Math.abs(Number(r.amount) || 0));
      if (amt <= 0 || !r.account?._id) continue;
      const analyticKey = r.analyticAccountId ? String(r.analyticAccountId) : '';
      const key = `${r.account._id}|${analyticKey}`;
      const prev = byAcct.get(key);
      if (prev) prev.credit = round2(prev.credit + amt);
      else {
        byAcct.set(key, {
          accountId: r.account._id,
          accountCode: r.account.code,
          debit: 0,
          credit: amt,
          description: description || 'Sales revenue',
          partnerId: partnerId || null,
          analyticAccountId: r.analyticAccountId || null,
        });
      }
    }
    lines.push(...byAcct.values());
  } else if (defaultSales) {
    lines.push({
      accountId: defaultSales._id,
      accountCode: defaultSales.code,
      debit: 0,
      credit: net,
      description: description || 'Sales revenue',
      partnerId: partnerId || null,
    });
  } else {
    return [];
  }

  if (tax > 0 && vatOut) {
    lines.push({
      accountId: vatOut._id,
      accountCode: vatOut.code,
      debit: 0,
      credit: tax,
      description: description || 'VAT output',
      partnerId: partnerId || null,
      taxIds: vatTaxIds,
    });
  } else if (tax > 0 && lines.length > 1) {
    // Fold tax into first revenue credit when no VAT account
    const rev = lines.find((l) => l.credit > 0);
    if (rev) rev.credit = round2(rev.credit + tax);
  }

  return stampPartnerId(lines, partnerId);
}

function normalizeAccountingOverrideLines(rawLines = []) {
  const lines = (Array.isArray(rawLines) ? rawLines : [])
    .map((line) => ({
      accountId: line?.accountId,
      accountCode: String(line?.accountCode || '').trim(),
      accountName: String(line?.accountName || '').trim(),
      debit: round2(Math.max(0, Number(line?.debit) || 0)),
      credit: round2(Math.max(0, Number(line?.credit) || 0)),
      description: String(line?.description || '').trim(),
      role: String(line?.role || '').trim(),
      partnerId: line?.partnerId || null,
    }))
    .filter((line) => line.accountId && (line.debit > 0 || line.credit > 0));
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  const balanced = lines.length >= 2 && Math.abs(debit - credit) < 0.02;
  return { lines, debit, credit, balanced };
}

/**
 * Preview sales invoice GL lines (no persistence) for the invoice composer journal panel.
 */
export async function previewSalesInvoiceJournal({ tenantId, invoice = {} }) {
  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const ctx = { byCode, byId, defaultIds };
  const ar = await resolveRoleAccount(tenantId, 'ar', ctx);
  const sales = await resolveRoleAccount(tenantId, 'sales', ctx);
  const vatOut = await resolveRoleAccount(tenantId, 'vatOutput', ctx);
  if (!ar || !sales) {
    return { lines: [], debit: 0, credit: 0, balanced: false, error: 'Missing AR or Sales account in chart of accounts' };
  }

  const tax = round2(Number(invoice.totalTax ?? invoice.taxAmount ?? 0));
  const gross = round2(Number(invoice.grandTotal || 0));
  let net = round2(Number(invoice.taxableAmount ?? (gross - tax)));
  if (round2(net + tax) !== gross) net = round2(gross - tax);
  if (gross <= 0) return { lines: [], debit: 0, credit: 0, balanced: false };

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  let revenueCredits = null;
  if (lineItems.length) {
    const lineNets = lineItems.map((li) => round2(Math.abs(Number(li.lineTotal) || Number(li.lineTotalWithTax) - Number(li.taxAmount) || 0)));
    const sumLines = round2(lineNets.reduce((s, n) => s + n, 0));
    revenueCredits = [];
    for (let i = 0; i < lineItems.length; i += 1) {
      let share = lineNets[i];
      if (sumLines > 0 && sumLines !== net) share = round2((lineNets[i] / sumLines) * net);
      if (share <= 0) continue;
      let account = null;
      if (lineItems[i].incomeAccountId) {
        account = byId[String(lineItems[i].incomeAccountId)]
          || await loadActiveCoa(tenantId, lineItems[i].incomeAccountId);
      }
      if (!account) {
        account = await resolveSalesIncomeAccount(
          tenantId,
          lineItems[i].productId,
          lineItems[i].productType === 'service'
            ? (byCode[ACCOUNT_CODE_MAP.services] || sales)
            : sales,
        );
      }
      if (!account) continue;
      revenueCredits.push({ account, amount: share });
    }
    if (!revenueCredits.length) revenueCredits = null;
    else {
      const allocated = round2(revenueCredits.reduce((s, g) => s + g.amount, 0));
      const delta = round2(net - allocated);
      if (delta !== 0) {
        revenueCredits[revenueCredits.length - 1].amount = round2(
          revenueCredits[revenueCredits.length - 1].amount + delta,
        );
      }
    }
  }

  const built = buildSalesInvoiceJournalLines({
    netAmount: net,
    taxAmount: tax,
    ar,
    vatOut,
    defaultSales: sales,
    revenueCredits,
    description: `Invoice ${invoice.invoiceNumber || 'DRAFT'}`,
    partnerId: invoice.customerId || null,
    paymentSchedule: invoice.paymentSchedule,
  });

  const accountIds = [...new Set(built.map((l) => String(l.accountId)))];
  const accounts = accountIds.length
    ? await ChartOfAccount.find({ _id: { $in: accountIds }, tenantId }).select('code name nameAr').lean()
    : [];
  const accountById = new Map(accounts.map((a) => [String(a._id), a]));

  const lines = built.map((l) => {
    const acct = accountById.get(String(l.accountId));
    let role = 'other';
    if (String(l.accountCode) === ACCOUNT_CODE_MAP.ar || String(acct?.code) === ACCOUNT_CODE_MAP.ar) role = 'ar';
    else if (String(l.accountCode) === ACCOUNT_CODE_MAP.vatOutput || String(acct?.code) === ACCOUNT_CODE_MAP.vatOutput) role = 'vat_out';
    else if (l.credit > 0) role = 'revenue';
    return {
      accountId: l.accountId,
      accountCode: l.accountCode || acct?.code || '',
      accountName: acct?.name || '',
      accountNameAr: acct?.nameAr || '',
      debit: l.debit,
      credit: l.credit,
      description: l.description || '',
      role,
    };
  });
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, debit, credit, balanced: Math.abs(debit - credit) < 0.02 };
}

/**
 * Preview purchase invoice GL lines (simplified AP / expense|stock / VAT in).
 * When bill lines carry expenseAccountId, expense is split per line.
 */
export async function previewPurchaseInvoiceJournal({ tenantId, invoice = {} }) {
  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const ctx = { byCode, byId, defaultIds };
  const ap = await resolveRoleAccount(tenantId, 'ap', ctx);
  const vatIn = await resolveRoleAccount(tenantId, 'vatInput', ctx);
  const cogs = await resolveRoleAccount(tenantId, 'cogs', ctx);
  const inventory = await resolveRoleAccount(tenantId, 'inventory', ctx);
  if (!ap) {
    return { lines: [], debit: 0, credit: 0, balanced: false, error: 'Missing Accounts Payable in chart of accounts' };
  }

  const tax = round2(Number(invoice.totalTax ?? invoice.taxAmount ?? 0));
  const gross = round2(Number(invoice.grandTotal || 0));
  let net = round2(Number(invoice.taxableAmount ?? (gross - tax)));
  if (round2(net + tax) !== gross) net = round2(gross - tax);
  if (gross <= 0) return { lines: [], debit: 0, credit: 0, balanced: false };

  const expenseAcct = cogs || inventory;
  if (!expenseAcct) {
    return { lines: [], debit: 0, credit: 0, balanced: false, error: 'Missing expense/inventory account' };
  }

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const expenseBuckets = new Map();
  let allocatedNet = 0;

  for (const li of lineItems) {
    const rawNet = li.lineTotal ?? (Number(li.quantity || 0) * Number(li.unitPrice || 0));
    const lineNet = round2(Math.abs(Number(rawNet) || 0));
    if (lineNet <= 0) continue;
    const accountId = String(li.expenseAccountId || expenseAcct._id);
    const acct = byId[accountId] || expenseAcct;
    const splits = await applyAnalyticDistributionToAmount(tenantId, {
      amount: lineNet,
      accountCode: acct?.code || '',
      productCategory: li.productCategory || li.category || '',
      partnerTag: invoice.fiscalPosition || invoice.partnerTag || '',
      existingAnalyticAccountId: li.analyticAccountId || null,
    });
    for (const split of splits) {
      const analyticAccountId = split.analyticAccountId ? String(split.analyticAccountId) : '';
      const key = `${accountId}|${analyticAccountId}`;
      const prev = expenseBuckets.get(key) || {
        accountId,
        analyticAccountId: analyticAccountId || null,
        amount: 0,
      };
      prev.amount = round2(prev.amount + split.amount);
      expenseBuckets.set(key, prev);
      allocatedNet = round2(allocatedNet + split.amount);
    }
  }

  if (expenseBuckets.size && allocatedNet > 0 && allocatedNet !== net) {
    const scale = net / allocatedNet;
    let running = 0;
    const keys = [...expenseBuckets.keys()];
    keys.forEach((key, idx) => {
      const bucket = expenseBuckets.get(key);
      if (idx === keys.length - 1) {
        bucket.amount = round2(net - running);
      } else {
        bucket.amount = round2(bucket.amount * scale);
        running = round2(running + bucket.amount);
      }
    });
  }

  const lines = [];
  if (expenseBuckets.size) {
    for (const bucket of expenseBuckets.values()) {
      const acct = byId[String(bucket.accountId)] || expenseAcct;
      lines.push({
        accountId: acct._id,
        accountCode: acct.code,
        accountName: acct.name,
        accountNameAr: acct.nameAr || '',
        debit: bucket.amount,
        credit: 0,
        description: `Purchase ${invoice.invoiceNumber || 'DRAFT'}`,
        role: invoice.sourcePurchaseOrderId ? 'stock' : 'expense',
        analyticAccountId: bucket.analyticAccountId || undefined,
      });
    }
  } else {
    lines.push({
      accountId: expenseAcct._id,
      accountCode: expenseAcct.code,
      accountName: expenseAcct.name,
      accountNameAr: expenseAcct.nameAr || '',
      debit: net,
      credit: 0,
      description: `Purchase ${invoice.invoiceNumber || 'DRAFT'}`,
      role: invoice.sourcePurchaseOrderId ? 'stock' : 'expense',
    });
  }

  if (tax > 0 && vatIn) {
    lines.push({
      accountId: vatIn._id,
      accountCode: vatIn.code,
      accountName: vatIn.name,
      accountNameAr: vatIn.nameAr || '',
      debit: tax,
      credit: 0,
      description: 'VAT input',
      role: 'vat_in',
    });
  }

  const apGross = tax > 0 && vatIn ? gross : round2(net + (vatIn ? 0 : tax));
  if (tax > 0 && !vatIn) {
    const firstExpense = lines.find((l) => l.role === 'expense' || l.role === 'stock');
    if (firstExpense) firstExpense.debit = round2(firstExpense.debit + tax);
  }

  const { computePaymentSchedule } = await import('../utils/invoicePaymentTerms.js');
  const paymentSchedule = resolveInvoicePaymentScheduleForPosting(invoice, apGross);

  for (const apLine of buildPayableCreditLines({
    ap,
    gross: apGross,
    paymentSchedule,
    description: 'Accounts payable',
    partnerId: invoice.supplierId || null,
  })) {
    lines.push({
      accountId: apLine.accountId,
      accountCode: apLine.accountCode,
      accountName: ap.name,
      accountNameAr: ap.nameAr || '',
      debit: apLine.debit,
      credit: apLine.credit,
      description: apLine.description,
      role: 'ap',
      dueDate: apLine.dueDate,
      trancheSequence: apLine.trancheSequence,
    });
  }

  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return { lines, debit, credit, balanced: Math.abs(debit - credit) < 0.02 };
}

export { normalizeAccountingOverrideLines, ACCOUNT_CODE_MAP };

async function loadActiveCoa(tenantId, id) {
  if (!id) return null;
  return ChartOfAccount.findOne({ _id: id, tenantId, isActive: true });
}

/**
 * Income account for a sold product: product override → category → default sales COA.
 */
export async function resolveSalesIncomeAccount(tenantId, productId, fallbackSales = null) {
  if (!productId) return fallbackSales;
  const Product = (await import('../models/Product.js')).default;
  const product = await Product.findOne({ _id: productId, tenantId })
    .select('incomeAccountId categoryId productType')
    .lean();
  if (!product) return fallbackSales;

  const fromProduct = await loadActiveCoa(tenantId, product.incomeAccountId);
  if (fromProduct) return fromProduct;

  if (product.categoryId) {
    const InvProductCategory = (await import('../models/inventory/InvProductCategory.js')).default;
    const cat = await InvProductCategory.findOne({ _id: product.categoryId, tenantId })
      .select('incomeAccountId')
      .lean();
    const fromCat = await loadActiveCoa(tenantId, cat?.incomeAccountId);
    if (fromCat) return fromCat;
  }

  // Services prefer 4100 when no override
  if (product.productType === 'service') {
    const services = await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.services);
    if (services) return services;
  }

  return fallbackSales;
}

/**
 * Sales invoice issued (AR + VAT output + Revenue).
 * Amounts: net (ex-VAT), tax, gross.
 * Revenue credits resolve per line: product → category → Sales/Service COA.
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

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = invoice.customerId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const ar = await resolveRoleAccount(tenantId, 'ar', {
    ...ctx,
    partnerAccountId: partnerAccounts.receivableAccountId,
  });
  const sales = await resolveRoleAccount(tenantId, 'sales', ctx);
  const vatOut = await resolveRoleAccount(tenantId, 'vatOutput', ctx);
  if (!ar || !sales) return null;

  const tax = round2(Number(invoice.totalTax ?? invoice.taxAmount ?? 0));
  const gross = round2(Number(invoice.grandTotal || 0));
  let net = round2(Number(invoice.taxableAmount ?? (gross - tax)));
  if (round2(net + tax) !== gross) {
    net = round2(gross - tax);
  }
  if (gross <= 0) return null;

  const salesTaxId = tax > 0 ? await resolveDefaultTaxId(tenantId, 'sales') : null;

  const override = normalizeAccountingOverrideLines(invoice.accountingLines);
  let lines = override.balanced ? stampPartnerId(override.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    debit: l.debit,
    credit: l.credit,
    description: l.description || `Invoice ${invoice.invoiceNumber || ''}`,
    partnerId: l.partnerId || partnerId,
  })), partnerId) : null;

  if (!lines) {
  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  let revenueCredits = null;
  if (lineItems.length) {
    const lineNets = lineItems.map((li) => round2(Math.abs(Number(li.lineTotal) || 0)));
    const sumLines = round2(lineNets.reduce((s, n) => s + n, 0));
    revenueCredits = [];
    for (let i = 0; i < lineItems.length; i += 1) {
      let share = lineNets[i];
      if (sumLines > 0 && sumLines !== net) {
        share = round2((lineNets[i] / sumLines) * net);
      }
      if (share <= 0) continue;
      let account = null;
      if (lineItems[i].incomeAccountId) {
        account = byId[String(lineItems[i].incomeAccountId)]
          || await loadActiveCoa(tenantId, lineItems[i].incomeAccountId);
      }
      if (!account) {
        account = await resolveSalesIncomeAccount(
          tenantId,
          lineItems[i].productId,
          lineItems[i].productType === 'service'
            ? (byCode[ACCOUNT_CODE_MAP.services] || sales)
            : sales,
        );
      }
      if (!account) continue;
      const splits = await applyAnalyticDistributionToAmount(tenantId, {
        amount: share,
        accountCode: account.code,
        productCategory: lineItems[i].productCategory || lineItems[i].category || '',
        partnerTag: invoice.fiscalPosition || invoice.partnerTag || '',
        existingAnalyticAccountId: lineItems[i].analyticAccountId || null,
      });
      for (const split of splits) {
        revenueCredits.push({
          account,
          amount: split.amount,
          analyticAccountId: split.analyticAccountId || null,
        });
      }
    }
    if (revenueCredits.length) {
      const allocated = round2(revenueCredits.reduce((s, g) => s + g.amount, 0));
      const delta = round2(net - allocated);
      if (delta !== 0) {
        revenueCredits[revenueCredits.length - 1].amount = round2(
          revenueCredits[revenueCredits.length - 1].amount + delta,
        );
      }
    } else {
      revenueCredits = null;
    }
  }

  lines = buildSalesInvoiceJournalLines({
    netAmount: net,
    taxAmount: tax,
    ar,
    vatOut,
    defaultSales: sales,
    revenueCredits,
    description: `Invoice ${invoice.invoiceNumber || ''}`,
    partnerId,
    taxIds: salesTaxId ? [salesTaxId] : [],
    paymentSchedule: resolveInvoicePaymentScheduleForPosting(invoice, gross),
  });
  }
  if (!lines || lines.length < 2) return null;

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultSalesJournal');

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
    journalId,
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
  bankJournalCode = null,
}) {
  const payAmt = round2(amount);
  if (!invoice?._id || payAmt <= 0) return null;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = invoice.customerId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const { account: cash, role: liqRole } = await resolveLiquidityAccount(tenantId, paymentMethod, ctx);
  const ar = await resolveRoleAccount(tenantId, 'ar', {
    ...ctx,
    partnerAccountId: partnerAccounts.receivableAccountId,
  });
  if (!cash || !ar) return null;

  const method = String(paymentMethod || '').toLowerCase();
  const useOutstanding = !method.includes('cash') && method !== 'card';
  let debitAccount = cash;
  let debitDescription = 'Customer payment';
  let journalId = await resolveJournalBookId(
    tenantId,
    userId,
    liqRole === 'cash' ? 'ensureDefaultCashJournal' : 'ensureDefaultBankJournal',
  );

  if (bankJournalCode) {
    const Journal = (await import('../models/Journal.js')).default;
    const book = await Journal.findOne({
      tenantId,
      code: String(bankJournalCode).trim().toUpperCase(),
      type: 'bank',
      active: { $ne: false },
    }).lean();
    if (book?.defaultDebitAccountId) {
      const bankAcct = byId[String(book.defaultDebitAccountId)]
        || await ChartOfAccount.findOne({ _id: book.defaultDebitAccountId, tenantId, isActive: true }).lean();
      if (bankAcct) {
        debitAccount = bankAcct;
        debitDescription = `Gateway payment (${bankJournalCode})`;
        journalId = book._id;
      }
    }
  }

  if (useOutstanding) {
    const tenant = await Tenant.findById(tenantId).select('settings.accounting.useOutstandingReceipts').lean();
    const outstandingEnabled = tenant?.settings?.accounting?.useOutstandingReceipts !== false;
    if (outstandingEnabled) {
      const outstanding = await resolveRoleAccount(tenantId, 'outstandingReceipts', ctx);
      if (outstanding) {
        debitAccount = outstanding;
        debitDescription = 'Outstanding customer receipt (awaiting bank clearance)';
      }
    }
  }

  const key = `InvoicePayment:${invoice._id}:${payAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'InvoicePayment',
    sourceId: invoice._id,
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  const allocations = allocatePaymentToTranches(invoice, payAmt);
  const arCredits = (allocations.length ? allocations : [{ trancheSequence: null, amount: payAmt, dueDate: null }])
    .map((row) => ({
      accountId: ar._id,
      accountCode: ar.code,
      debit: 0,
      credit: row.amount,
      description: row.trancheSequence
        ? `Settle AR ${invoice.invoiceNumber} — tranche ${row.trancheSequence}`
        : `Settle AR ${invoice.invoiceNumber}`,
      trancheSequence: row.trancheSequence,
      dueDate: row.dueDate,
    }));

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: `Payment for invoice ${invoice.invoiceNumber}`,
    reference: key,
    currency,
    lines: stampPartnerId([
      { accountId: debitAccount._id, accountCode: debitAccount.code, debit: payAmt, credit: 0, description: debitDescription },
      ...arCredits,
    ], partnerId),
    sourceModel: 'InvoicePayment',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber,
    status: 'posted',
    journalId,
  });
}

/** Early-payment discount: Dr discount / Dr difference, Cr AR (clears gross AR when customer pays discounted amount). */
export async function postEarlyPaymentDiscountJournal({
  tenantId,
  userId,
  invoice,
  amount,
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
}) {
  const diffAmt = round2(amount);
  if (!invoice?._id || diffAmt <= 0) return null;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const ctx = { byCode, byId, defaultIds };
  const discountAcct = byCode['4900']
    || await getAccountByCode(tenantId, '4900')
    || await resolveRoleAccount(tenantId, 'opex', ctx);
  if (!discountAcct?._id) return null;

  return postInvoicePaymentDifferenceJournal({
    tenantId,
    userId,
    invoice,
    amount: diffAmt,
    differenceAccountId: discountAcct._id,
    paymentDate,
    reference: reference || `EarlyDiscount:${invoice._id}:${diffAmt}`,
    currency,
  });
}

/** Write off remaining AR balance when registering a partial payment with mark-as-paid difference. */
export async function postInvoicePaymentDifferenceJournal({
  tenantId,
  userId,
  invoice,
  amount,
  differenceAccountId,
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
}) {
  const diffAmt = round2(amount);
  if (!invoice?._id || diffAmt <= 0 || !differenceAccountId) return null;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = invoice.customerId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const ar = await resolveRoleAccount(tenantId, 'ar', {
    ...ctx,
    partnerAccountId: partnerAccounts.receivableAccountId,
  });
  const diffAcct = byId[String(differenceAccountId)]
    || await ChartOfAccount.findOne({ _id: differenceAccountId, tenantId, isActive: true }).lean();
  if (!ar || !diffAcct) return null;

  const key = `InvoicePaymentDiff:${invoice._id}:${diffAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'InvoicePaymentDifference',
    sourceId: invoice._id,
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultMiscJournal');

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'adjustment',
    memo: `Payment difference write-off ${invoice.invoiceNumber}`,
    memoAr: `شطب فرق الدفع ${invoice.invoiceNumber}`,
    reference: key,
    currency,
    lines: stampPartnerId([
      { accountId: diffAcct._id, accountCode: diffAcct.code, debit: diffAmt, credit: 0, description: 'Payment difference' },
      { accountId: ar._id, accountCode: ar.code, debit: 0, credit: diffAmt, description: `Clear AR diff ${invoice.invoiceNumber}` },
    ], partnerId),
    sourceModel: 'InvoicePaymentDifference',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber,
    status: 'posted',
    journalId,
  });
}
export async function postVendorBillPaymentJournal({
  tenantId,
  userId,
  invoice,
  amount,
  paymentMethod = 'bank_transfer',
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
  memo = '',
}) {
  const payAmt = round2(amount);
  if (!invoice?._id || payAmt <= 0 || invoice.flow !== 'purchase') return null;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = invoice.supplierId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const { account: cash, role: liqRole } = await resolveLiquidityAccount(tenantId, paymentMethod, ctx);
  const ap = await resolveRoleAccount(tenantId, 'ap', {
    ...ctx,
    partnerAccountId: partnerAccounts.payableAccountId,
  });
  if (!cash || !ap) return null;

  const method = String(paymentMethod || '').toLowerCase();
  const useOutstanding = !method.includes('cash') && method !== 'card';
  let creditAccount = cash;
  let creditDescription = 'Vendor disbursement';
  if (useOutstanding) {
    const tenant = await Tenant.findById(tenantId).select('settings.accounting.useOutstandingPayments').lean();
    const outstandingEnabled = tenant?.settings?.accounting?.useOutstandingPayments !== false;
    if (outstandingEnabled) {
      const outstanding = await resolveRoleAccount(tenantId, 'outstandingPayments', ctx);
      if (outstanding) {
        creditAccount = outstanding;
        creditDescription = 'Outstanding vendor payment (awaiting bank clearance)';
      }
    }
  }

  const key = `VendorBillPayment:${invoice._id}:${payAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'VendorBillPayment',
    sourceId: invoice._id,
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  const journalId = await resolveJournalBookId(
    tenantId,
    userId,
    liqRole === 'cash' ? 'ensureDefaultCashJournal' : 'ensureDefaultBankJournal',
  );

  const allocations = allocatePaymentToTranches(invoice, payAmt);
  const apDebits = (allocations.length ? allocations : [{ trancheSequence: null, amount: payAmt, dueDate: null }])
    .map((row) => ({
      accountId: ap._id,
      accountCode: ap.code,
      debit: row.amount,
      credit: 0,
      description: row.trancheSequence
        ? `Settle AP ${invoice.invoiceNumber} — tranche ${row.trancheSequence}`
        : `Settle AP ${invoice.invoiceNumber}`,
      trancheSequence: row.trancheSequence,
      dueDate: row.dueDate,
    }));

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: memo || `Payment for vendor bill ${invoice.invoiceNumber}`,
    memoAr: `سداد فاتورة مورد ${invoice.invoiceNumber}`,
    reference: key,
    currency,
    lines: stampPartnerId([
      ...apDebits,
      { accountId: creditAccount._id, accountCode: creditAccount.code, debit: 0, credit: payAmt, description: creditDescription },
    ], partnerId),
    sourceModel: 'VendorBillPayment',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber,
    status: 'posted',
    journalId,
  });
}

/**
 * Clear Outstanding Payments against the real bank account when the statement arrives.
 * Outstanding Payments Dr, Bank Cr.
 */
export async function postOutstandingPaymentClearance({
  tenantId,
  userId,
  bankAccountId,
  amount,
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
  memo = '',
  partnerId = null,
}) {
  const payAmt = round2(amount);
  if (!bankAccountId || payAmt <= 0) return null;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const ctx = { byCode, byId, defaultIds };
  const outstanding = await resolveRoleAccount(tenantId, 'outstandingPayments', ctx);
  const bank = byId[String(bankAccountId)] || await ChartOfAccount.findOne({ _id: bankAccountId, tenantId }).lean();
  if (!outstanding || !bank) return null;

  const key = `OutstandingClearance:${bankAccountId}:${payAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'OutstandingPaymentClearance',
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultBankJournal');

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: memo || 'Clear outstanding vendor payment to bank',
    memoAr: 'مقاصة مدفوعات معلقة إلى البنك',
    reference: key,
    currency,
    lines: stampPartnerId([
      {
        accountId: outstanding._id,
        accountCode: outstanding.code,
        debit: payAmt,
        credit: 0,
        description: 'Clear outstanding payment',
      },
      {
        accountId: bank._id,
        accountCode: bank.code,
        debit: 0,
        credit: payAmt,
        description: 'Bank statement clearance',
      },
    ], partnerId),
    sourceModel: 'OutstandingPaymentClearance',
    sourceId: bankAccountId,
    sourceNumber: reference || '',
    status: 'posted',
    journalId,
  });
}

/**
 * Clear Outstanding Receipts against the real bank account when the statement arrives.
 * Bank Dr, Outstanding Receipts Cr.
 */
export async function postOutstandingReceiptClearance({
  tenantId,
  userId,
  bankAccountId,
  amount,
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
  memo = '',
  partnerId = null,
}) {
  const payAmt = round2(amount);
  if (!bankAccountId || payAmt <= 0) return null;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const ctx = { byCode, byId, defaultIds };
  const outstanding = await resolveRoleAccount(tenantId, 'outstandingReceipts', ctx);
  const bank = byId[String(bankAccountId)] || await ChartOfAccount.findOne({ _id: bankAccountId, tenantId }).lean();
  if (!outstanding || !bank) return null;

  const key = `OutstandingReceiptClearance:${bankAccountId}:${payAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'OutstandingReceiptClearance',
    reference: key,
    status: { $ne: 'void' },
  });
  if (dup) return dup;

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultBankJournal');

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: memo || 'Clear outstanding customer receipt to bank',
    memoAr: 'مقاصة مقبوضات معلقة إلى البنك',
    reference: key,
    currency,
    lines: stampPartnerId([
      {
        accountId: bank._id,
        accountCode: bank.code,
        debit: payAmt,
        credit: 0,
        description: 'Bank statement clearance',
      },
      {
        accountId: outstanding._id,
        accountCode: outstanding.code,
        debit: 0,
        credit: payAmt,
        description: 'Clear outstanding receipt',
      },
    ], partnerId),
    sourceModel: 'OutstandingReceiptClearance',
    sourceId: bankAccountId,
    sourceNumber: reference || '',
    status: 'posted',
    journalId,
  });
}

/** Vendor refund (purchase credit note) — AP Dr, expense & VAT in Cr */
export async function postVendorRefundJournal({
  tenantId,
  userId,
  creditNote,
  currency = 'SAR',
}) {
  if (!creditNote?._id || creditNote.flow !== 'purchase') return null;
  if (String(creditNote.invoiceType) !== '381') return null;

  const existing = await findExistingSourceEntry(tenantId, 'VendorRefund', creditNote._id);
  if (existing) return existing;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = creditNote.supplierId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const ap = await resolveRoleAccount(tenantId, 'ap', {
    ...ctx,
    partnerAccountId: partnerAccounts.payableAccountId,
  });
  const expense = await resolveRoleAccount(tenantId, 'opex', ctx);
  const vatIn = await resolveRoleAccount(tenantId, 'vatInput', ctx);
  if (!ap || !expense) return null;

  const { net, tax, gross } = absInvoiceAmounts(creditNote);
  if (gross <= 0) return null;

  const purchaseTaxId = tax > 0 ? await resolveDefaultTaxId(tenantId, 'purchase') : null;
  const lines = stampPartnerId([
    {
      accountId: ap._id,
      accountCode: ap.code,
      debit: gross,
      credit: 0,
      description: `Vendor refund ${creditNote.invoiceNumber}`,
      role: 'ap',
    },
    {
      accountId: expense._id,
      accountCode: expense.code,
      debit: 0,
      credit: net,
      description: `VR expense ${creditNote.invoiceNumber}`,
      role: 'expense',
    },
    ...(tax > 0 && vatIn
      ? [{
        accountId: vatIn._id,
        accountCode: vatIn.code,
        debit: 0,
        credit: tax,
        description: `VR VAT ${creditNote.invoiceNumber}`,
        role: 'vat_input',
        taxIds: purchaseTaxId ? [purchaseTaxId] : [],
      }]
      : []),
  ], partnerId);

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultPurchaseJournal');

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: creditNote.accountingDate || creditNote.issueDate || new Date(),
    type: 'adjustment',
    memo: `Vendor refund ${creditNote.invoiceNumber}`,
    memoAr: `مرتجع مورد ${creditNote.invoiceNumber}`,
    reference: creditNote.invoiceNumber,
    currency,
    lines,
    sourceModel: 'VendorRefund',
    sourceId: creditNote._id,
    sourceNumber: creditNote.invoiceNumber,
    status: 'posted',
    journalId,
  });
}

/**
 * Match vendor refund AP debit against original bill liability.
 * Updates paid amounts so both documents reflect settlement.
 */
export async function reconcileVendorRefundWithBill({
  tenantId,
  userId,
  refund,
  originalBill,
}) {
  if (!refund?._id || !originalBill?._id) return null;
  if (originalBill.flow !== 'purchase' || String(originalBill.invoiceType) !== '388') return null;

  const refundAmt = Math.abs(round2(Number(refund.grandTotal || 0)));
  if (refundAmt <= 0) return null;

  const remaining = round2(Math.max(0, Number(originalBill.grandTotal || 0) - Number(originalBill.paidAmount || 0)));
  const applied = round2(Math.min(refundAmt, remaining));
  if (applied <= 0) return { applied: 0, skipped: true };

  originalBill.paidAmount = round2(Number(originalBill.paidAmount || 0) + applied);
  applyPaidAmountStatus(originalBill);
  await originalBill.save();

  refund.paymentStatus = applied >= remaining - 0.005 ? 'paid' : 'partial';
  refund.paidAmount = refundAmt;
  await refund.save();

  return {
    applied,
    billId: originalBill._id,
    refundId: refund._id,
    billPaymentStatus: originalBill.paymentStatus,
    refundPaymentStatus: refund.paymentStatus,
  };
}

/**
 * Match sales credit note against original customer invoice.
 * Updates paid amounts so both documents reflect settlement.
 */
export async function reconcileCreditNoteWithInvoice({
  tenantId,
  userId,
  creditNote,
  originalInvoice,
}) {
  if (!creditNote?._id || !originalInvoice?._id) return null;
  if (originalInvoice.flow !== 'sell' || String(originalInvoice.invoiceType) !== '388') return null;
  if (creditNote.flow !== 'sell' || String(creditNote.invoiceType) !== '381') return null;

  const cnAmt = Math.abs(round2(Number(creditNote.grandTotal || 0)));
  if (cnAmt <= 0) return null;

  const remaining = round2(Math.max(0, Number(originalInvoice.grandTotal || 0) - Number(originalInvoice.paidAmount || 0)));
  const applied = round2(Math.min(cnAmt, remaining));
  if (applied <= 0) return { applied: 0, skipped: true };

  originalInvoice.paidAmount = round2(Number(originalInvoice.paidAmount || 0) + applied);
  applyPaidAmountStatus(originalInvoice);
  await originalInvoice.save();

  creditNote.paymentStatus = applied >= remaining - 0.005 ? 'paid' : 'partial';
  creditNote.paidAmount = cnAmt;
  await creditNote.save();

  return {
    applied,
    invoiceId: originalInvoice._id,
    creditNoteId: creditNote._id,
    invoicePaymentStatus: originalInvoice.paymentStatus,
    creditNotePaymentStatus: creditNote.paymentStatus,
  };
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

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = purchaseOrder.supplierId?._id || purchaseOrder.supplierId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const { account: cash, role: liqRole } = await resolveLiquidityAccount(tenantId, paymentMethod, ctx);
  const ap = await resolveRoleAccount(tenantId, 'ap', {
    ...ctx,
    partnerAccountId: partnerAccounts.payableAccountId,
  });
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

  const journalId = await resolveJournalBookId(
    tenantId,
    userId,
    liqRole === 'cash' ? 'ensureDefaultCashJournal' : 'ensureDefaultBankJournal',
  );

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate,
    type: 'payment',
    memo: `Supplier payment for PO ${desc}`,
    memoAr: `سداد دفعة للمورد لأمر الشراء ${desc}`,
    reference: key,
    currency,
    lines: stampPartnerId([
      {
        accountId: ap._id,
        accountCode: ap.code,
        debit: payAmt,
        credit: 0,
        description: `Pay AP ${desc}${notes ? ` — ${notes}` : ''}`,
      },
      {
        accountId: cash._id,
        accountCode: cash.code,
        debit: 0,
        credit: payAmt,
        description: `Cash/Bank out ${desc}`,
      },
    ], partnerId),
    sourceModel: 'PurchaseOrderPayment',
    sourceId: purchaseOrder._id,
    sourceNumber: poNumber,
    status: 'posted',
    journalId,
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

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const ctx = { byCode, byId, defaultIds };
  const category = String(expense.category || '').toLowerCase();
  let expenseCode = ACCOUNT_CODE_MAP.opex;
  if (category.includes('salary') || category.includes('payroll') || category.includes('wage')) {
    expenseCode = ACCOUNT_CODE_MAP.salaries;
  } else if (category.includes('rent')) {
    expenseCode = ACCOUNT_CODE_MAP.rent;
  } else if (category.includes('utilit')) {
    expenseCode = ACCOUNT_CODE_MAP.utilities;
  }

  let expenseAcct = byCode[expenseCode] || await resolveRoleAccount(tenantId, 'opex', ctx);
  // Prefer product / category expense account when an expense product is linked
  if (expense.productId) {
    try {
      const { resolveProductExpenseAccount } = await import('./inventory/stockAccounting.js');
      const fromProduct = await resolveProductExpenseAccount(tenantId, expense.productId, expenseAcct);
      if (fromProduct) expenseAcct = fromProduct;
    } catch {
      // keep category fallback
    }
  }

  const vatIn = await resolveRoleAccount(tenantId, 'vatInput', ctx);
  const { account: cash, role: liqRole } = await resolveLiquidityAccount(tenantId, expense.paymentMethod, ctx);
  if (!expenseAcct || !cash) return null;

  const net = round2(Number(expense.amount || 0));
  const tax = round2(Number(expense.taxAmount || 0));
  const total = round2(Number(expense.totalAmount || net + tax));
  if (total <= 0) return null;

  const purchaseTaxId = tax > 0 ? await resolveDefaultTaxId(tenantId, 'purchase') : null;
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
      taxIds: purchaseTaxId ? [purchaseTaxId] : [],
    });
  }
  lines.push({
    accountId: cash._id,
    accountCode: cash.code,
    debit: 0,
    credit: total,
    description: `Pay ${expense.expenseNumber}`,
  });

  const journalId = await resolveJournalBookId(
    tenantId,
    userId,
    liqRole === 'cash' ? 'ensureDefaultCashJournal' : 'ensureDefaultBankJournal',
  );

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
    journalId,
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

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = voucher.partyId || voucher.customerId || voucher.supplierId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const amount = round2(Number(voucher.amount || voucher.totalAmount || 0));
  if (amount <= 0) return null;

  const { account: cash, role: liqRole } = await resolveLiquidityAccount(tenantId, voucher.paymentMethod, ctx);
  const ar = await resolveRoleAccount(tenantId, 'ar', {
    ...ctx,
    partnerAccountId: partnerAccounts.receivableAccountId,
  });
  const ap = await resolveRoleAccount(tenantId, 'ap', {
    ...ctx,
    partnerAccountId: partnerAccounts.payableAccountId,
  });
  const opex = await resolveRoleAccount(tenantId, 'opex', ctx);
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
  lines = stampPartnerId(lines, partnerId);

  const journalId = await resolveJournalBookId(
    tenantId,
    userId,
    liqRole === 'cash' ? 'ensureDefaultCashJournal' : 'ensureDefaultBankJournal',
  );

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
    journalId,
  });
}

/** Credit note — reverse sales invoice economics (Sales/VAT Dr, AR Cr) with partnerId */
export async function postCreditNoteJournal({
  tenantId,
  userId,
  creditNote,
  currency = 'SAR',
}) {
  if (!creditNote?._id) return null;
  const existing = await findExistingSourceEntry(tenantId, 'CreditNote', creditNote._id);
  if (existing) return existing;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = creditNote.customerId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const ar = await resolveRoleAccount(tenantId, 'ar', {
    ...ctx,
    partnerAccountId: partnerAccounts.receivableAccountId,
  });
  const sales = await resolveRoleAccount(tenantId, 'sales', ctx);
  const vatOut = await resolveRoleAccount(tenantId, 'vatOutput', ctx);
  if (!ar || !sales) return null;

  const { net, tax, gross } = absInvoiceAmounts(creditNote);
  if (gross <= 0) return null;

  const salesTaxId = tax > 0 ? await resolveDefaultTaxId(tenantId, 'sales') : null;
  const lines = stampPartnerId([
    {
      accountId: sales._id,
      accountCode: sales.code,
      debit: net,
      credit: 0,
      description: `CN ${creditNote.invoiceNumber}`,
    },
    ...(tax > 0 && vatOut
      ? [{
        accountId: vatOut._id,
        accountCode: vatOut.code,
        debit: tax,
        credit: 0,
        description: `CN VAT ${creditNote.invoiceNumber}`,
        taxIds: salesTaxId ? [salesTaxId] : [],
      }]
      : []),
    {
      accountId: ar._id,
      accountCode: ar.code,
      debit: 0,
      credit: gross,
      description: `CN settle ${creditNote.invoiceNumber}`,
    },
  ], partnerId);

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultSalesJournal');

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: creditNote.issueDate || new Date(),
    type: 'adjustment',
    memo: `Credit note ${creditNote.invoiceNumber}`,
    memoAr: `إشعار دائن ${creditNote.invoiceNumber}`,
    reference: creditNote.invoiceNumber,
    currency,
    lines,
    sourceModel: 'CreditNote',
    sourceId: creditNote._id,
    sourceNumber: creditNote.invoiceNumber,
    status: 'posted',
    journalId,
  });
}

/**
 * Cash/bank refund against a credit note (or CN with paidAmount).
 * AR Dr, Cash/Bank Cr — money leaving the business to the customer.
 */
export async function postCreditNoteRefundJournal({
  tenantId,
  userId,
  creditNote,
  amount = null,
  paymentMethod = 'cash',
  paymentDate = new Date(),
  reference = '',
  currency = 'SAR',
}) {
  if (!creditNote?._id) return null;
  const { net, tax, gross } = absInvoiceAmounts(creditNote);
  const payAmt = round2(amount != null ? amount : (Number(creditNote.paidAmount) > 0 ? creditNote.paidAmount : gross));
  const refundAmt = Math.abs(payAmt);
  if (refundAmt <= 0) return null;

  const key = `CreditNoteRefund:${creditNote._id}:${refundAmt}:${reference || paymentDate}`;
  const dup = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'CreditNoteRefund',
    sourceId: creditNote._id,
    reference: key,
    status: { $nin: ['void', 'reversed'] },
  });
  if (dup) return dup;

  const { byCode, byId } = await getAccountMap(tenantId);
  const { ids: defaultIds } = await ensureAccountingDefaults(tenantId);
  const partnerId = creditNote.customerId || null;
  const partnerAccounts = await loadPartnerAccountIds(tenantId, partnerId);
  const ctx = { byCode, byId, defaultIds };
  const { account: cash, role: liqRole } = await resolveLiquidityAccount(tenantId, paymentMethod, ctx);
  const ar = await resolveRoleAccount(tenantId, 'ar', {
    ...ctx,
    partnerAccountId: partnerAccounts.receivableAccountId,
  });
  if (!cash || !ar) return null;

  // Ensure the CN AR credit exists first when possible
  await postCreditNoteJournal({ tenantId, userId, creditNote, currency });

  const journalId = await resolveJournalBookId(
    tenantId,
    userId,
    liqRole === 'cash' ? 'ensureDefaultCashJournal' : 'ensureDefaultBankJournal',
  );

  return createJournalEntry({
    tenantId,
    userId,
    entryDate: paymentDate || creditNote.issueDate || new Date(),
    type: 'payment',
    memo: `Refund for credit note ${creditNote.invoiceNumber}`,
    memoAr: `استرداد لإشعار دائن ${creditNote.invoiceNumber}`,
    reference: key,
    currency,
    lines: stampPartnerId([
      {
        accountId: ar._id,
        accountCode: ar.code,
        debit: refundAmt,
        credit: 0,
        description: `Refund AR ${creditNote.invoiceNumber}`,
      },
      {
        accountId: cash._id,
        accountCode: cash.code,
        debit: 0,
        credit: refundAmt,
        description: `Cash/Bank refund ${creditNote.invoiceNumber}`,
      },
    ], partnerId),
    sourceModel: 'CreditNoteRefund',
    sourceId: creditNote._id,
    sourceNumber: creditNote.invoiceNumber,
    status: 'posted',
    journalId,
  });
}

/**
 * Backfill partnerId on JournalEntry lines + JournalItems from source documents.
 */
export async function backfillJournalPartnerIds(tenantId, { limit = 500 } = {}) {
  const SOURCE_MAP = {
    Invoice: async (id) => {
      const inv = await Invoice.findOne({ _id: id, tenantId }).select('customerId supplierId flow').lean();
      if (!inv) return null;
      return inv.flow === 'purchase' ? (inv.supplierId || null) : (inv.customerId || null);
    },
    InvoicePayment: async (id) => {
      const inv = await Invoice.findOne({ _id: id, tenantId }).select('customerId').lean();
      return inv?.customerId || null;
    },
    CreditNote: async (id) => {
      const inv = await Invoice.findOne({ _id: id, tenantId }).select('customerId').lean();
      return inv?.customerId || null;
    },
    CreditNoteRefund: async (id) => {
      const inv = await Invoice.findOne({ _id: id, tenantId }).select('customerId').lean();
      return inv?.customerId || null;
    },
    PurchaseInvoice: async (id) => {
      const inv = await Invoice.findOne({ _id: id, tenantId }).select('supplierId').lean();
      return inv?.supplierId || null;
    },
    PurchaseOrderPayment: async (id) => {
      const po = await PurchaseOrder.findOne({ _id: id, tenantId }).select('supplierId').lean();
      return po?.supplierId || null;
    },
    Voucher: async (id) => {
      const v = await Voucher.findOne({ _id: id, tenantId }).select('partyId').lean();
      return v?.partyId || null;
    },
  };

  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    sourceModel: { $in: Object.keys(SOURCE_MAP) },
    sourceId: { $ne: null },
    'lines.partnerId': { $in: [null, undefined] },
  })
    .sort({ entryDate: -1 })
    .limit(Math.min(2000, Math.max(1, Number(limit) || 500)));

  let updated = 0;
  for (const entry of entries) {
    const resolver = SOURCE_MAP[entry.sourceModel];
    if (!resolver) continue;
    const partnerId = await resolver(entry.sourceId);
    if (!partnerId) continue;
    let changed = false;
    entry.lines = (entry.lines || []).map((line) => {
      if (line.partnerId) return line;
      changed = true;
      const obj = typeof line.toObject === 'function' ? line.toObject() : { ...line };
      return { ...obj, partnerId };
    });
    if (!changed) continue;
    entry.markModified('lines');
    await entry.save();
    await syncJournalItemsFromMove(entry, { state: 'posted' });
    updated += 1;
  }
  return { scanned: entries.length, updated };
}

/**
 * Partner GL ledger from posted JournalItems (AR/AP nature: debit − credit running).
 */
export async function buildPartnerLedger(tenantId, partnerId, { from, to, accountId = null } = {}) {
  if (!partnerId) throw new Error('partnerId is required');
  const Partner = (await import('../models/Partner.js')).default;
  const partner = await Partner.findOne({ _id: partnerId, tenantId }).lean();
  if (!partner) throw new Error('Partner not found');

  const { start, end } = periodRange({ from, to });
  const filter = {
    tenantId,
    partnerId,
    state: 'posted',
    entryDate: { $lte: end },
  };
  if (accountId) filter.accountId = accountId;

  const items = await JournalItem.find(filter)
    .sort({ entryDate: 1, createdAt: 1, lineIndex: 1 })
    .populate('accountId', 'code name nameAr type subtype')
    .lean();

  const moveIds = [...new Set(items.map((i) => String(i.moveId)).filter(Boolean))];
  const moves = moveIds.length
    ? await JournalEntry.find({ tenantId, _id: { $in: moveIds } })
      .select('sourceModel sourceId sourceNumber reference')
      .lean()
    : [];
  const moveById = Object.fromEntries(moves.map((m) => [String(m._id), m]));

  let running = 0;
  let openingBalance = 0;
  const lines = [];
  for (const item of items) {
    const debit = round2(item.debit);
    const credit = round2(item.credit);
    running = round2(running + debit - credit);
    if (new Date(item.entryDate) < start) {
      openingBalance = running;
      continue;
    }
    lines.push({
      date: item.entryDate,
      entryNumber: item.entryNumber,
      moveId: item.moveId,
      accountCode: item.accountCode || item.accountId?.code || '',
      accountName: item.accountName || item.accountId?.name || '',
      accountNameAr: item.accountId?.nameAr || '',
      description: item.description || '',
      debit,
      credit,
      balance: running,
      sourceModel: item.sourceModel || moveById[String(item.moveId)]?.sourceModel || '',
      sourceId: item.sourceId || moveById[String(item.moveId)]?.sourceId || null,
      sourceNumber: moveById[String(item.moveId)]?.sourceNumber || moveById[String(item.moveId)]?.reference || '',
    });
  }

  return {
    partner,
    partnerId,
    from: start,
    to: end,
    openingBalance,
    closingBalance: lines.length ? lines[lines.length - 1].balance : openingBalance,
    lines,
    totalDebit: round2(lines.reduce((s, l) => s + l.debit, 0)),
    totalCredit: round2(lines.reduce((s, l) => s + l.credit, 0)),
  };
}

export async function buildTrialBalance(tenantId, { asOf = null, from = null, to = null } = {}) {
  await ensureDefaultChartOfAccounts(tenantId);
  const accounts = await ChartOfAccount.find({ tenantId, isActive: true }).sort({ code: 1 }).lean();

  // Period trial: opening + period movement + ending
  if (from && to) {
    const start = new Date(from);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    const openingEnd = new Date(start.getTime() - 1);

    const [openingTb, periodEntries] = await Promise.all([
      buildTrialBalance(tenantId, { asOf: openingEnd }),
      JournalEntry.find({
        tenantId,
        status: 'posted',
        entryDate: { $gte: start, $lte: end },
      }).lean(),
    ]);

    const map = {};
    for (const a of accounts) {
      map[String(a._id)] = {
        accountId: a._id,
        code: a.code,
        name: a.name,
        nameAr: a.nameAr,
        type: a.type,
        initialBalance: 0,
        debit: 0,
        credit: 0,
        endingBalance: 0,
      };
    }
    for (const row of openingTb.rows || []) {
      const key = String(row.accountId);
      if (!map[key]) continue;
      map[key].initialBalance = round2(row.balance);
    }
    for (const entry of periodEntries) {
      for (const line of entry.lines || []) {
        const key = String(line.accountId);
        if (!map[key]) continue;
        map[key].debit = round2(map[key].debit + Number(line.debit || 0));
        map[key].credit = round2(map[key].credit + Number(line.credit || 0));
      }
    }
    const rows = Object.values(map).map((row) => {
      const isDebitNature = ['asset', 'expense'].includes(row.type);
      const ending = isDebitNature
        ? round2(row.initialBalance + row.debit - row.credit)
        : round2(row.initialBalance + row.credit - row.debit);
      return { ...row, endingBalance: ending, balance: ending };
    }).filter((r) => r.initialBalance || r.debit || r.credit || r.endingBalance);

    const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
    const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
    return {
      from: start,
      to: end,
      asOf: end,
      rows,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.02,
      mode: 'period',
    };
  }

  if (!asOf) {
    const rows = accounts.map((a) => {
      const bal = round2(a.balance || 0);
      const isDebitNature = ['asset', 'expense'].includes(a.type);
      let debit = 0;
      let credit = 0;
      if (bal >= 0) {
        if (isDebitNature) debit = bal;
        else credit = bal;
      } else if (isDebitNature) credit = Math.abs(bal);
      else debit = Math.abs(bal);
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        nameAr: a.nameAr,
        type: a.type,
        debit: round2(debit),
        credit: round2(credit),
        balance: bal,
        initialBalance: bal,
        endingBalance: bal,
      };
    });

    const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
    const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
    return { asOf: asOf || new Date(), rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.02, mode: 'snapshot' };
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
    return {
      ...row,
      balance: round2(raw),
      initialBalance: 0,
      endingBalance: round2(raw),
    };
  });
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { asOf: new Date(asOf), rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.02, mode: 'asOf' };
}

async function cashAccountIdSet(tenantId) {
  const rows = await ChartOfAccount.find({
    tenantId,
    isActive: true,
    $or: [{ subtype: { $in: ['cash', 'bank'] } }, { code: { $in: ['1000', '1100'] } }],
  }).select('_id').lean();
  return new Set(rows.map((r) => String(r._id)));
}

function entryTouchesCash(entry, cashIds) {
  return (entry.lines || []).some((l) => cashIds.has(String(l.accountId)));
}

export async function buildProfitAndLoss(tenantId, {
  from,
  to,
  analyticAccountId = null,
  basis = 'accrual',
} = {}) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const accounts = await ChartOfAccount.find({
    tenantId,
    isActive: true,
    type: { $in: ['revenue', 'expense'] },
  }).sort({ code: 1 }).lean();

  let entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: start, $lte: end },
  }).lean();

  if (basis === 'cash') {
    const cashIds = await cashAccountIdSet(tenantId);
    entries = entries.filter((e) => (
      ['payment', 'expense', 'voucher'].includes(e.type)
      || /payment|receipt|voucher/i.test(String(e.sourceModel || ''))
      || entryTouchesCash(e, cashIds)
    ));
  }

  const totals = {};
  for (const a of accounts) {
    totals[String(a._id)] = { ...a, amount: 0 };
  }

  for (const entry of entries) {
    for (const line of entry.lines || []) {
      if (analyticAccountId && String(line.analyticAccountId || '') !== String(analyticAccountId)) continue;
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
  const cogs = expenses.filter((a) => a.subtype === 'cogs' || String(a.code).startsWith('50'));
  const opex = expenses.filter((a) => !(a.subtype === 'cogs' || String(a.code).startsWith('50')));
  const totalRevenue = round2(revenue.reduce((s, a) => s + a.amount, 0));
  const totalCogs = round2(cogs.reduce((s, a) => s + a.amount, 0));
  const totalOpex = round2(opex.reduce((s, a) => s + a.amount, 0));
  const totalExpenses = round2(expenses.reduce((s, a) => s + a.amount, 0));
  const grossProfit = round2(totalRevenue - totalCogs);
  const netIncome = round2(totalRevenue - totalExpenses);
  const horizontalGroups = await attachHorizontalGroups(tenantId, [...revenue, ...expenses], 'amount');
  const accountTotals = new Map();
  for (const a of [...revenue, ...expenses]) accountTotals.set(String(a.code), a.amount);
  const customReportLines = await buildEvaluatedReportLines(tenantId, 'pnl', accountTotals);

  return {
    from: start,
    to: end,
    basis: basis === 'cash' ? 'cash' : 'accrual',
    analyticAccountId: analyticAccountId || null,
    revenue,
    expenses,
    cogs,
    opex,
    totalRevenue,
    totalCogs,
    totalOpex,
    totalExpenses,
    grossProfit,
    netIncome,
    horizontalGroups,
    customReportLines,
  };
}

export async function buildBalanceSheet(tenantId, { asOf = null } = {}) {
  const tb = await buildTrialBalance(tenantId, { asOf });
  const assets = [];
  const liabilities = [];
  const equity = [];

  const groupKey = (row) => {
    const code = String(row.code || '');
    if (row.type === 'asset') {
      if (['cash', 'bank'].includes(row.subtype) || /^1[01]/.test(code)) return 'bank_cash';
      if (row.subtype === 'receivable' || code.startsWith('12')) return 'receivable';
      if (row.subtype === 'fixed_asset' || row.subtype === 'accum_depreciation' || code.startsWith('16')) return 'fixed';
      return 'current_assets';
    }
    if (row.type === 'liability') {
      if (row.subtype === 'payable' || code.startsWith('20')) return 'payable';
      return 'current_liabilities';
    }
    if (row.type === 'equity') {
      if (row.subtype === 'retained_earnings' || code.startsWith('31')) return 'retained';
      return 'equity';
    }
    return 'other';
  };

  for (const row of tb.rows) {
    const item = {
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      nameAr: row.nameAr,
      balance: row.balance,
      type: row.type,
      group: groupKey(row),
    };
    if (row.type === 'asset') assets.push(item);
    else if (row.type === 'liability') liabilities.push(item);
    else if (row.type === 'equity') equity.push(item);
  }

  // Current period net income into equity
  const asOfDate = asOf ? new Date(asOf) : new Date();
  const pnl = await buildProfitAndLoss(tenantId, {
    from: new Date(asOfDate.getFullYear(), 0, 1),
    to: asOfDate,
  });
  if (Math.abs(pnl.netIncome) > 0.009) {
    equity.push({
      accountId: null,
      code: 'NI',
      name: 'Net Income (Current Period)',
      nameAr: 'صافي الدخل (الفترة الحالية)',
      balance: pnl.netIncome,
      type: 'equity',
      group: 'retained',
    });
  }

  const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0));
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0));
  const totalEquity = round2(equity.reduce((s, a) => s + a.balance, 0));
  const horizontalGroups = await attachHorizontalGroups(
    tenantId,
    [...assets, ...liabilities, ...equity],
    'balance',
  );
  const accountTotals = new Map();
  for (const a of [...assets, ...liabilities, ...equity]) accountTotals.set(String(a.code), a.balance);
  const customReportLines = await buildEvaluatedReportLines(tenantId, 'bs', accountTotals);

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
    horizontalGroups,
    customReportLines,
  };
}

export async function buildGeneralLedger(tenantId, accountId, { from, to } = {}) {
  const account = await ChartOfAccount.findOne({ _id: accountId, tenantId }).lean();
  if (!account) throw new Error('Account not found');

  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  // Opening balance before period
  const prior = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $lt: start },
    'lines.accountId': account._id,
  }).lean();
  let opening = 0;
  for (const entry of prior) {
    for (const line of entry.lines || []) {
      if (String(line.accountId) !== String(account._id)) continue;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      if (['asset', 'expense'].includes(account.type)) opening = round2(opening + debit - credit);
      else opening = round2(opening + credit - debit);
    }
  }

  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: start, $lte: end },
    'lines.accountId': account._id,
  }).sort({ entryDate: 1, entryNumber: 1 }).lean();

  let running = opening;
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
        memo: entry.memo || line.description,
        reference: entry.reference || entry.sourceNumber,
        partnerId: line.partnerId || null,
        journalId: entry.journalId || null,
        sourceModel: entry.sourceModel || '',
        sourceId: entry.sourceId || null,
        sourceNumber: entry.sourceNumber || '',
        debit,
        credit,
        balance: running,
      });
    }
  }

  return {
    account,
    from: start,
    to: end,
    openingBalance: opening,
    endingBalance: running,
    lines,
  };
}

/** Sequential journal audit report filtered by journal book. */
export async function buildJournalReport(tenantId, {
  from,
  to,
  journalId = null,
} = {}) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const filter = {
    tenantId,
    status: { $in: ['posted', 'draft', 'reversed', 'void'] },
    entryDate: { $gte: start, $lte: end },
  };
  if (journalId) filter.journalId = journalId;

  const entries = await JournalEntry.find(filter)
    .sort({ entryDate: 1, entryNumber: 1 })
    .populate('journalId', 'code name nameAr type')
    .lean();

  const rows = entries.map((e) => ({
    entryId: e._id,
    entryNumber: e.entryNumber,
    entryDate: e.entryDate,
    status: e.status,
    journalCode: e.journalId?.code || '',
    journalName: e.journalId?.name || '',
    memo: e.memo,
    reference: e.reference || e.sourceNumber,
    sourceModel: e.sourceModel,
    sourceId: e.sourceId,
    sourceNumber: e.sourceNumber,
    totalDebit: round2(e.totalDebit || (e.lines || []).reduce((s, l) => s + Number(l.debit || 0), 0)),
    totalCredit: round2(e.totalCredit || (e.lines || []).reduce((s, c) => s + Number(c.credit || 0), 0)),
    lines: (e.lines || []).map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      description: l.description,
      taxIds: l.taxIds || [],
    })),
  }));

  // Sequence gap detection (numeric suffix)
  const gaps = [];
  const byPrefix = new Map();
  for (const row of rows) {
    const m = String(row.entryNumber || '').match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const prefix = m[1];
    const num = Number(m[2]);
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(num);
  }
  for (const [prefix, nums] of byPrefix) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        gaps.push({
          prefix,
          from: sorted[i - 1] + 1,
          to: sorted[i] - 1,
          message: `Gap in ${prefix}: missing ${sorted[i - 1] + 1}–${sorted[i] - 1}`,
        });
      }
    }
  }

  return {
    from: start,
    to: end,
    journalId,
    rows,
    gaps,
    totalDebit: round2(rows.reduce((s, r) => s + r.totalDebit, 0)),
    totalCredit: round2(rows.reduce((s, r) => s + r.totalCredit, 0)),
  };
}

export const DEFAULT_FISCAL_POSITIONS = [
  { code: 'domestic', name: 'Domestic', nameAr: 'محلي', isDefault: true },
  { code: 'export', name: 'Export', nameAr: 'تصدير', isDefault: false },
  { code: 'gcc', name: 'GCC', nameAr: 'مجلس التعاون', isDefault: false },
  { code: 'exempt', name: 'Tax exempt', nameAr: 'معفى', isDefault: false },
];

export async function getFiscalPositions(tenantId) {
  const Tenant = (await import('../models/Tenant.js')).default;
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.fiscalPositions').lean();
  const rows = tenant?.settings?.accounting?.fiscalPositions;
  if (Array.isArray(rows) && rows.length) {
    return { positions: rows.filter((row) => row?.code) };
  }
  return { positions: DEFAULT_FISCAL_POSITIONS };
}

export async function setFiscalPositions(tenantId, positions) {
  if (!Array.isArray(positions)) throw new Error('positions array required');
  const cleaned = positions.slice(0, 50).map((row) => ({
    code: String(row.code || '').trim().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    isDefault: Boolean(row.isDefault),
  })).filter((row) => row.code && row.name);
  if (!cleaned.length) throw new Error('At least one fiscal position is required');
  if (!cleaned.some((row) => row.isDefault)) cleaned[0].isDefault = true;
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.fiscalPositions': cleaned },
  });
  return { positions: cleaned };
}

export async function getPaymentTermsCatalog(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.paymentTermIds settings.accounting.defaultPaymentTermId').lean();
  const enabledIds = Array.isArray(tenant?.settings?.accounting?.paymentTermIds)
    ? tenant.settings.accounting.paymentTermIds.filter(Boolean)
    : [];
  const defaultId = tenant?.settings?.accounting?.defaultPaymentTermId || 'net30';
  const terms = BUILTIN_PAYMENT_TERMS.map((term) => ({
    ...term,
    enabled: enabledIds.length ? enabledIds.includes(term.id) : true,
    isDefault: term.id === defaultId,
    scheduleSummaryEn: describePaymentTerm(term, 'en'),
    scheduleSummaryAr: describePaymentTerm(term, 'ar'),
  }));
  return { terms, defaultPaymentTermId: defaultId, enabledIds };
}

export async function setPaymentTermsCatalog(tenantId, { enabledIds, defaultPaymentTermId } = {}) {
  const validIds = new Set(BUILTIN_PAYMENT_TERMS.map((t) => t.id));
  const cleaned = (Array.isArray(enabledIds) ? enabledIds : [])
    .map((id) => String(id || '').trim())
    .filter((id) => validIds.has(id));
  let defaultId = String(defaultPaymentTermId || 'net30').trim();
  if (!validIds.has(defaultId)) defaultId = 'net30';
  if (cleaned.length && !cleaned.includes(defaultId)) cleaned.push(defaultId);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      'settings.accounting.paymentTermIds': cleaned,
      'settings.accounting.defaultPaymentTermId': defaultId,
    },
  });
  return getPaymentTermsCatalog(tenantId);
}

export const BUILTIN_INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];

export async function getIncotermsCatalog(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.incoterms settings.accounting.defaultIncoterm').lean();
  const enabled = Array.isArray(tenant?.settings?.accounting?.incoterms)
    ? tenant.settings.accounting.incoterms.map(String).filter(Boolean)
    : [];
  const defaultCode = tenant?.settings?.accounting?.defaultIncoterm || 'EXW';
  const terms = BUILTIN_INCOTERMS.map((code) => ({
    code,
    enabled: enabled.length ? enabled.includes(code) : true,
    isDefault: code === defaultCode,
  }));
  return { terms, defaultIncoterm: defaultCode, enabledCodes: enabled };
}

export async function setIncotermsCatalog(tenantId, { enabledCodes, defaultIncoterm } = {}) {
  const valid = new Set(BUILTIN_INCOTERMS);
  const cleaned = (Array.isArray(enabledCodes) ? enabledCodes : [])
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => valid.has(code));
  let defaultCode = String(defaultIncoterm || 'EXW').trim().toUpperCase();
  if (!valid.has(defaultCode)) defaultCode = 'EXW';
  if (cleaned.length && !cleaned.includes(defaultCode)) cleaned.push(defaultCode);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      'settings.accounting.incoterms': cleaned,
      'settings.accounting.defaultIncoterm': defaultCode,
    },
  });
  return getIncotermsCatalog(tenantId);
}

export const DEFAULT_FOLLOW_UP_LEVELS = [
  { level: 1, daysOverdue: 1, name: 'Friendly reminder', nameAr: 'تذكير ودي', channel: 'whatsapp' },
  { level: 2, daysOverdue: 15, name: 'Second notice', nameAr: 'إشعار ثانٍ', channel: 'whatsapp' },
  { level: 3, daysOverdue: 30, name: 'Final notice', nameAr: 'إشعار أخير', channel: 'email' },
  { level: 4, daysOverdue: 60, name: 'Escalation', nameAr: 'تصعيد', channel: 'call' },
];

export async function getFollowUpLevels(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.followUpLevels').lean();
  const rows = tenant?.settings?.accounting?.followUpLevels;
  if (Array.isArray(rows) && rows.length) {
    return { levels: rows.sort((a, b) => (a.level || 0) - (b.level || 0) || (a.daysOverdue || 0) - (b.daysOverdue || 0)) };
  }
  return { levels: DEFAULT_FOLLOW_UP_LEVELS };
}

export async function setFollowUpLevels(tenantId, levels) {
  if (!Array.isArray(levels)) throw new Error('levels array required');
  const cleaned = levels.slice(0, 20).map((row, idx) => ({
    level: Number(row.level) || (idx + 1),
    daysOverdue: Math.max(0, Number(row.daysOverdue) || 0),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    channel: ['whatsapp', 'email', 'sms', 'call'].includes(row.channel) ? row.channel : 'whatsapp',
  })).filter((row) => row.name);
  if (!cleaned.length) throw new Error('At least one follow-up level is required');
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.followUpLevels': cleaned },
  });
  return { levels: cleaned };
}

/** Resolve the highest follow-up level whose daysOverdue threshold is met. */
export function resolveFollowUpLevel(ageDays, levels) {
  const sorted = [...(levels || [])].sort(
    (a, b) => (Number(b.daysOverdue) || 0) - (Number(a.daysOverdue) || 0),
  );
  const age = Number(ageDays) || 0;
  for (const level of sorted) {
    if (age >= Number(level.daysOverdue || 0)) return level;
  }
  return sorted[sorted.length - 1] || null;
}

export const DEFAULT_RECONCILIATION_MODELS = [
  {
    name: 'Exact amount match',
    nameAr: 'مطابقة المبلغ بالضبط',
    active: true,
    priority: 100,
    labelContains: '',
    referenceContains: '',
    feePercent: 0,
    feeAccountPrefix: '',
    autoMatchExactAmount: true,
    autoMatchInvoiceRef: false,
  },
  {
    name: 'Stripe / card fees',
    nameAr: 'رسوم Stripe / البطاقات',
    active: true,
    priority: 80,
    labelContains: 'stripe',
    referenceContains: '',
    feePercent: 2,
    feeAccountPrefix: '62',
    autoMatchExactAmount: false,
    autoMatchInvoiceRef: false,
  },
  {
    name: 'Invoice reference in label',
    nameAr: 'مرجع الفاتورة في الوصف',
    active: true,
    priority: 70,
    labelContains: '',
    referenceContains: 'INV',
    feePercent: 0,
    feeAccountPrefix: '',
    autoMatchExactAmount: false,
    autoMatchInvoiceRef: true,
  },
];

export async function getReconciliationModels(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.reconciliationModels').lean();
  const rows = tenant?.settings?.accounting?.reconciliationModels;
  if (Array.isArray(rows) && rows.length) {
    return { models: rows.sort((a, b) => (b.priority || 0) - (a.priority || 0)) };
  }
  return { models: DEFAULT_RECONCILIATION_MODELS };
}

export async function setReconciliationModels(tenantId, models) {
  if (!Array.isArray(models)) throw new Error('models array required');
  const cleaned = models.slice(0, 40).map((row, idx) => ({
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    active: row.active !== false,
    priority: Number(row.priority) || (100 - idx),
    labelContains: String(row.labelContains || '').trim().slice(0, 80),
    referenceContains: String(row.referenceContains || '').trim().slice(0, 80),
    feePercent: Math.min(100, Math.max(0, Number(row.feePercent) || 0)),
    feeAccountPrefix: String(row.feeAccountPrefix || '').trim().slice(0, 16),
    autoMatchExactAmount: Boolean(row.autoMatchExactAmount),
    autoMatchInvoiceRef: Boolean(row.autoMatchInvoiceRef),
  })).filter((row) => row.name);
  if (!cleaned.length) throw new Error('At least one reconciliation model is required');
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.reconciliationModels': cleaned },
  });
  return { models: cleaned };
}

export const DEFAULT_JOURNAL_GROUPS = [
  { code: 'SALES', name: 'Sales journals', nameAr: 'دفاتر المبيعات', journalCodes: ['SAL', 'INV'], sequence: 1 },
  { code: 'PURCHASE', name: 'Purchase journals', nameAr: 'دفاتر المشتريات', journalCodes: ['PUR', 'BILL'], sequence: 2 },
  { code: 'BANK', name: 'Bank & cash', nameAr: 'البنوك والنقد', journalCodes: ['BNK', 'CSH'], sequence: 3 },
  { code: 'MISC', name: 'Miscellaneous', nameAr: 'متنوع', journalCodes: ['MISC', 'GEN'], sequence: 4 },
];

export async function getJournalGroups(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.journalGroups').lean();
  const rows = tenant?.settings?.accounting?.journalGroups;
  if (Array.isArray(rows) && rows.length) {
    return { groups: rows.sort((a, b) => (a.sequence || 0) - (b.sequence || 0)) };
  }
  return { groups: DEFAULT_JOURNAL_GROUPS };
}

export async function setJournalGroups(tenantId, groups) {
  if (!Array.isArray(groups)) throw new Error('groups array required');
  const cleaned = groups.slice(0, 30).map((row, idx) => ({
    code: String(row.code || '').trim().toUpperCase().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    journalCodes: (Array.isArray(row.journalCodes) ? row.journalCodes : String(row.journalCodes || '').split(/[,،\s]+/))
      .map((c) => String(c || '').trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20),
    sequence: Number(row.sequence) || (idx + 1),
  })).filter((row) => row.code && row.name);
  if (!cleaned.length) throw new Error('At least one journal group is required');
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.journalGroups': cleaned },
  });
  return { groups: cleaned };
}

export async function getAccountingPaymentProviders(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.paymentProviders').lean();
  const rows = tenant?.settings?.accounting?.paymentProviders;
  return { providers: Array.isArray(rows) ? rows.filter((r) => r?.provider || r?.name) : [] };
}

export async function setAccountingPaymentProviders(tenantId, providers) {
  if (!Array.isArray(providers)) throw new Error('providers array required');
  const cleaned = providers.slice(0, 20).map((row) => ({
    provider: String(row.provider || '').trim().toLowerCase().slice(0, 40),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    journalCode: String(row.journalCode || '').trim().toUpperCase().slice(0, 16),
    active: row.active !== false,
    webhookSecret: String(row.webhookSecret || '').trim().slice(0, 200),
  })).filter((row) => row.provider || row.name);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.paymentProviders': cleaned },
  });
  return { providers: cleaned };
}

/**
 * Public webhook: record gateway capture against a sales invoice and post receipt journal.
 */
export async function handleAccountingPaymentProviderWebhook(providerSlug, body = {}, { webhookSecret = '' } = {}) {
  const slug = String(providerSlug || '').trim().toLowerCase();
  if (!slug) throw Object.assign(new Error('Provider slug required'), { statusCode: 400 });

  const tenant = await Tenant.findOne({
    'settings.accounting.paymentProviders': {
      $elemMatch: { provider: slug, active: { $ne: false } },
    },
  }).select('_id settings.accounting.paymentProviders').lean();

  if (!tenant) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });

  const providers = tenant.settings?.accounting?.paymentProviders || [];
  const cfg = providers.find((row) => String(row.provider || '').toLowerCase() === slug && row.active !== false);
  if (!cfg) throw Object.assign(new Error('Provider not found'), { statusCode: 404 });

  if (cfg.webhookSecret && cfg.webhookSecret !== String(webhookSecret || '')) {
    throw Object.assign(new Error('Invalid webhook secret'), { statusCode: 401 });
  }

  const status = String(body.status || body.event || 'captured').toLowerCase();
  if (['failed', 'failure', 'declined', 'cancelled', 'canceled'].includes(status)) {
    return { received: true, skipped: true, reason: status };
  }

  const invoiceId = body.invoiceId || body.invoice_id || body.metadata?.invoiceId;
  if (!invoiceId) throw Object.assign(new Error('invoiceId is required'), { statusCode: 400 });

  const Invoice = (await import('../models/Invoice.js')).default;
  const invoice = await Invoice.findOne({ _id: invoiceId, tenantId: tenant._id, flow: 'sell' });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });

  const payAmt = round2(Number(body.amount ?? body.captured_amount ?? body.paid_amount ?? 0));
  if (payAmt <= 0) throw Object.assign(new Error('Payment amount must be greater than zero'), { statusCode: 400 });

  const externalId = String(body.externalId || body.external_id || body.id || body.payment_id || '').trim();
  const reference = externalId ? `WebhookPayment:${slug}:${externalId}` : `WebhookPayment:${slug}:${invoiceId}:${payAmt}`;

  const dup = await JournalEntry.findOne({
    tenantId: tenant._id,
    sourceModel: 'InvoicePayment',
    sourceId: invoice._id,
    reference,
    status: { $ne: 'void' },
  });
  if (dup) return { received: true, duplicate: true, journalEntryId: dup._id };

  const remaining = round2(Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)));
  const { computePaymentSettlement } = await import('../utils/invoicePaymentTerms.js');
  const settlement = computePaymentSettlement(invoice, {
    amount: payAmt,
    paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
    differenceMode: 'keep_open',
  });
  const cashToApply = settlement.cashAmount;
  if (cashToApply > remaining + 0.005) {
    throw Object.assign(new Error('Amount exceeds remaining balance'), { statusCode: 400 });
  }

  invoice.paidAmount = settlement.targetPaidAmount;
  invoice.payments = [...(invoice.payments || []), {
    method: 'card',
    amount: cashToApply,
    discountAmount: settlement.discountAmount > 0 ? settlement.discountAmount : undefined,
    externalId: externalId || undefined,
    provider: slug,
  }];
  applyPaidAmountStatus(invoice);
  await invoice.save();

  const entry = await postInvoicePaymentJournal({
    tenantId: tenant._id,
    userId: null,
    invoice,
    amount: cashToApply,
    paymentMethod: 'card',
    paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
    reference,
    currency: invoice.currency || 'SAR',
    bankJournalCode: cfg.journalCode || null,
  });

  let discountEntry = null;
  if (settlement.discountAmount > 0.005) {
    discountEntry = await postEarlyPaymentDiscountJournal({
      tenantId: tenant._id,
      userId: null,
      invoice,
      amount: settlement.discountAmount,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      reference: `${reference}:discount`,
      currency: invoice.currency || 'SAR',
    });
  }

  return {
    received: true,
    invoiceId: invoice._id,
    paidAmount: invoice.paidAmount,
    paymentStatus: invoice.paymentStatus,
    journalEntryId: entry?._id || null,
    discountJournalEntryId: discountEntry?._id || null,
    earlyDiscountApplied: settlement.discountAmount,
  };
}

export async function getBankAccountsCatalog(tenantId) {
  await ensureDefaultChartOfAccounts(tenantId);
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.bankAccounts settings.accounting.sepa').lean();
  const meta = Array.isArray(tenant?.settings?.accounting?.bankAccounts)
    ? tenant.settings.accounting.bankAccounts
    : [];
  const accounts = await ChartOfAccount.find({
    tenantId,
    isActive: true,
    $or: [{ subtype: 'bank' }, { subtype: 'cash' }, { type: 'asset', code: /^11/ }],
  }).sort({ code: 1 }).lean();
  const Journal = (await import('../models/Journal.js')).default;
  const journals = await Journal.find({ tenantId, type: 'bank', active: { $ne: false } }).lean();
  const journalById = Object.fromEntries(journals.map((j) => [String(j._id), j]));
  const rows = accounts.map((acc) => {
    const link = meta.find((m) => String(m.accountId) === String(acc._id)) || {};
    const journal = link.journalId ? journalById[String(link.journalId)] : journals.find((j) => String(j.defaultDebitAccountId) === String(acc._id));
    return {
      accountId: acc._id,
      code: acc.code,
      name: acc.name,
      nameAr: acc.nameAr,
      subtype: acc.subtype,
      balance: acc.balance,
      iban: link.iban || '',
      bic: link.bic || '',
      journalId: journal?._id || link.journalId || null,
      journalCode: journal?.code || '',
    };
  });
  return { rows, sepa: tenant?.settings?.accounting?.sepa || {} };
}

/** Create bank CoA account + bank journal + link IBAN metadata. */
export async function createBankAccountSetup(tenantId, userId, {
  name,
  nameAr = '',
  code = null,
  iban = '',
  bic = '',
  currency = 'SAR',
} = {}) {
  if (!name) throw new Error('name is required');
  await ensureDefaultChartOfAccounts(tenantId, userId, currency);
  const Journal = (await import('../models/Journal.js')).default;

  let nextCode = code ? String(code).trim() : null;
  if (!nextCode) {
    const existing = await ChartOfAccount.find({ tenantId, code: /^11/ }).select('code').lean();
    const nums = existing.map((a) => Number(String(a.code).replace(/\D/g, ''))).filter((n) => n >= 1100 && n < 1200);
    const max = nums.length ? Math.max(...nums) : 1100;
    nextCode = String(max + 1);
  }

  const dup = await ChartOfAccount.findOne({ tenantId, code: nextCode });
  if (dup) throw new Error(`Account code ${nextCode} already exists`);

  const account = await ChartOfAccount.create({
    tenantId,
    code: nextCode,
    name,
    nameAr: nameAr || '',
    type: 'asset',
    subtype: 'bank',
    currency,
    isPostable: true,
    createdBy: userId,
  });

  const journalCode = `BNK${String(nextCode).slice(-2)}`.toUpperCase().slice(0, 8);
  let jCode = journalCode;
  let suffix = 1;
  while (await Journal.findOne({ tenantId, code: jCode })) {
    jCode = `${journalCode}${suffix}`;
    suffix += 1;
  }

  const journal = await Journal.create({
    tenantId,
    code: jCode,
    name: `${name} Journal`,
    nameAr: nameAr ? `${nameAr} — دفتر` : '',
    type: 'bank',
    sequencePrefix: jCode,
    defaultDebitAccountId: account._id,
    defaultCreditAccountId: account._id,
    active: true,
    createdBy: userId,
  });

  const tenant = await Tenant.findById(tenantId).select('settings.accounting.bankAccounts settings.accounting.sepa').lean();
  const links = Array.isArray(tenant?.settings?.accounting?.bankAccounts)
    ? [...tenant.settings.accounting.bankAccounts]
    : [];
  links.push({
    accountId: account._id,
    journalId: journal._id,
    iban: String(iban || '').trim(),
    bic: String(bic || '').trim(),
    label: name,
  });

  const patch = { 'settings.accounting.bankAccounts': links.slice(0, 40) };
  if (iban && !tenant?.settings?.accounting?.sepa?.debtorIban) {
    patch['settings.accounting.sepa.debtorIban'] = String(iban).trim();
    patch['settings.accounting.sepa.debtorBic'] = String(bic || '').trim();
    patch['settings.accounting.sepa.debtorName'] = name;
  }
  await Tenant.findByIdAndUpdate(tenantId, { $set: patch });

  return {
    account,
    journal,
    iban: String(iban || '').trim(),
    bic: String(bic || '').trim(),
  };
}

export async function getCurrenciesCatalog(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.currency settings.accounting.currencies').lean();
  const companyCurrency = tenant?.settings?.currency || 'SAR';
  const rows = Array.isArray(tenant?.settings?.accounting?.currencies)
    ? tenant.settings.accounting.currencies.filter((r) => r?.code)
    : [];
  const defaults = [
    { code: 'USD', name: 'US Dollar', nameAr: 'دولار أمريكي', rate: 3.75, active: true },
    { code: 'EUR', name: 'Euro', nameAr: 'يورو', rate: 4.1, active: true },
    { code: 'AED', name: 'UAE Dirham', nameAr: 'درهم إماراتي', rate: 1.02, active: true },
    { code: 'EGP', name: 'Egyptian Pound', nameAr: 'جنيه مصري', rate: 0.077, active: false },
  ].filter((r) => r.code !== companyCurrency);
  return {
    companyCurrency,
    currencies: rows.length ? rows : defaults,
  };
}

export async function setCurrenciesCatalog(tenantId, currencies) {
  if (!Array.isArray(currencies)) throw new Error('currencies array required');
  const cleaned = currencies.slice(0, 40).map((row) => ({
    code: String(row.code || '').trim().toUpperCase().slice(0, 8),
    name: String(row.name || '').trim().slice(0, 80),
    nameAr: String(row.nameAr || '').trim().slice(0, 80),
    rate: Math.max(0.000001, Number(row.rate) || 1),
    active: row.active !== false,
  })).filter((row) => row.code && row.name);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.currencies': cleaned },
  });
  return getCurrenciesCatalog(tenantId);
}

export async function getAssetModels(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.assetModels').lean();
  const rows = tenant?.settings?.accounting?.assetModels;
  if (Array.isArray(rows) && rows.length) return { models: rows };
  return {
    models: [
      { code: 'SL-5Y', name: 'Straight line 5 years', nameAr: 'قسط ثابت 5 سنوات', method: 'straight_line', usefulLifeMonths: 60, salvagePct: 0 },
      { code: 'SL-3Y', name: 'Straight line 3 years', nameAr: 'قسط ثابت 3 سنوات', method: 'straight_line', usefulLifeMonths: 36, salvagePct: 0 },
      { code: 'DB-5Y', name: 'Declining balance 5 years', nameAr: 'قسط متناقص 5 سنوات', method: 'declining_balance', usefulLifeMonths: 60, salvagePct: 0 },
      { code: 'SL-10Y', name: 'Straight line 10 years', nameAr: 'قسط ثابت 10 سنوات', method: 'straight_line', usefulLifeMonths: 120, salvagePct: 5 },
    ],
  };
}

export async function setAssetModels(tenantId, models) {
  if (!Array.isArray(models)) throw new Error('models array required');
  const cleaned = models.slice(0, 30).map((row) => ({
    code: String(row.code || '').trim().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    method: row.method === 'declining_balance' ? 'declining_balance' : 'straight_line',
    usefulLifeMonths: Math.max(1, Number(row.usefulLifeMonths) || 60),
    salvagePct: Math.min(100, Math.max(0, Number(row.salvagePct) || 0)),
  })).filter((row) => row.code && row.name);
  if (!cleaned.length) throw new Error('At least one asset model is required');
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.assetModels': cleaned },
  });
  return { models: cleaned };
}

export async function getDeferredModels(tenantId, kind = 'expense') {
  const k = kind === 'revenue' ? 'revenue' : 'expense';
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.deferredModels').lean();
  const rows = Array.isArray(tenant?.settings?.accounting?.deferredModels)
    ? tenant.settings.accounting.deferredModels.filter((r) => (r.kind || 'expense') === k)
    : [];
  if (rows.length) return { kind: k, models: rows };
  return {
    kind: k,
    models: k === 'revenue'
      ? [
        { code: 'REV-12M', name: 'Recognize over 12 months', nameAr: 'اعتراف على 12 شهراً', kind: 'revenue', months: 12 },
        { code: 'REV-6M', name: 'Recognize over 6 months', nameAr: 'اعتراف على 6 أشهر', kind: 'revenue', months: 6 },
      ]
      : [
        { code: 'EXP-12M', name: 'Amortize prepaid over 12 months', nameAr: 'إطفاء مدفوع مقدماً 12 شهراً', kind: 'expense', months: 12 },
        { code: 'EXP-3M', name: 'Amortize prepaid over 3 months', nameAr: 'إطفاء مدفوع مقدماً 3 أشهر', kind: 'expense', months: 3 },
      ],
  };
}

export async function setDeferredModels(tenantId, kind, models) {
  const k = kind === 'revenue' ? 'revenue' : 'expense';
  if (!Array.isArray(models)) throw new Error('models array required');
  const cleaned = models.slice(0, 30).map((row) => ({
    code: String(row.code || '').trim().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    kind: k,
    months: Math.max(1, Math.min(120, Number(row.months) || 12)),
  })).filter((row) => row.code && row.name);

  const tenant = await Tenant.findById(tenantId).select('settings.accounting.deferredModels').lean();
  const existing = Array.isArray(tenant?.settings?.accounting?.deferredModels)
    ? tenant.settings.accounting.deferredModels.filter((r) => (r.kind || 'expense') !== k)
    : [];
  const next = [...existing, ...cleaned];
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.deferredModels': next },
  });
  return { kind: k, models: cleaned };
}

export async function getAnalyticPlans(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.analyticPlans').lean();
  const rows = tenant?.settings?.accounting?.analyticPlans;
  if (Array.isArray(rows) && rows.length) return { plans: rows };
  return {
    plans: [
      { code: 'DEPT', name: 'Departments', nameAr: 'الأقسام', active: true },
      { code: 'PROJ', name: 'Projects', nameAr: 'المشاريع', active: true },
    ],
  };
}

export async function setAnalyticPlans(tenantId, plans) {
  if (!Array.isArray(plans)) throw new Error('plans array required');
  const cleaned = plans.slice(0, 40).map((row) => ({
    code: String(row.code || '').trim().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    active: row.active !== false,
  })).filter((row) => row.code && row.name);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.analyticPlans': cleaned },
  });
  return { plans: cleaned };
}

export async function getAccountTags(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.accountTags').lean();
  const tags = Array.isArray(tenant?.settings?.accounting?.accountTags)
    ? tenant.settings.accounting.accountTags.filter(Boolean)
    : [];
  return { tags: tags.length ? tags : ['operating', 'investing', 'financing', 'tax', 'intercompany'] };
}

export async function setAccountTags(tenantId, tags) {
  if (!Array.isArray(tags)) throw new Error('tags array required');
  const cleaned = [...new Set(tags.map((t) => String(t || '').trim().slice(0, 40)).filter(Boolean))].slice(0, 50);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.accountTags': cleaned },
  });
  return { tags: cleaned };
}

export const DEFAULT_HORIZONTAL_GROUPS = [
  { code: 'PL', name: 'Profit & loss', nameAr: 'الأرباح والخسائر', accountPrefixes: ['4', '5', '6'], sequence: 1 },
  { code: 'BS', name: 'Balance sheet', nameAr: 'الميزانية', accountPrefixes: ['1', '2', '3'], sequence: 2 },
];

export async function getHorizontalGroups(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.horizontalGroups').lean();
  const rows = tenant?.settings?.accounting?.horizontalGroups;
  if (Array.isArray(rows) && rows.length) {
    return {
      groups: rows
        .filter((row) => row?.code)
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
    };
  }
  return { groups: DEFAULT_HORIZONTAL_GROUPS };
}

export async function setHorizontalGroups(tenantId, groups) {
  if (!Array.isArray(groups)) throw new Error('groups array required');
  const cleaned = groups.slice(0, 30).map((row, idx) => ({
    code: String(row.code || '').trim().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    accountPrefixes: (Array.isArray(row.accountPrefixes) ? row.accountPrefixes : String(row.accountPrefixes || '').split(/[,،\s]+/))
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .slice(0, 20),
    sequence: Number(row.sequence) || (idx + 1),
  })).filter((row) => row.code && row.name);
  if (!cleaned.length) throw new Error('At least one horizontal group is required');
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.horizontalGroups': cleaned },
  });
  return { groups: cleaned };
}

export const DEFAULT_TAX_GROUPS = [
  { code: 'VAT_STD', name: 'Standard VAT', nameAr: 'ضريبة القيمة المضافة', taxCodes: [], sequence: 1 },
];

export async function getTaxGroups(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.taxGroups').lean();
  const rows = tenant?.settings?.accounting?.taxGroups;
  if (Array.isArray(rows) && rows.length) {
    return { groups: rows.sort((a, b) => (a.sequence || 0) - (b.sequence || 0)) };
  }
  return { groups: DEFAULT_TAX_GROUPS };
}

export async function setTaxGroups(tenantId, groups) {
  if (!Array.isArray(groups)) throw new Error('groups array required');
  const cleaned = groups.slice(0, 30).map((row, idx) => ({
    code: String(row.code || '').trim().toUpperCase().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    taxCodes: (Array.isArray(row.taxCodes) ? row.taxCodes : String(row.taxCodes || '').split(/[,،\s]+/))
      .map((code) => String(code || '').trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20),
    sequence: Number(row.sequence) || (idx + 1),
  })).filter((row) => row.code && row.name);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.taxGroups': cleaned },
  });
  return { groups: cleaned };
}

export const DEFAULT_REPORT_DEFINITIONS = [
  { report: 'pnl', code: 'REV_TOTAL', label: 'Total Revenue', labelAr: 'إجمالي الإيرادات', formula: 'sum(prefix:4)', sequence: 1 },
  { report: 'pnl', code: 'EXP_TOTAL', label: 'Total Expenses', labelAr: 'إجمالي المصروفات', formula: 'sum(prefix:5)', sequence: 2 },
  { report: 'pnl', code: 'NET_INCOME', label: 'Net Income', labelAr: 'صافي الدخل', formula: 'line:REV_TOTAL - line:EXP_TOTAL', sequence: 3 },
  { report: 'cashflow', code: 'CF_OPERATING', label: 'Operating cash', labelAr: 'التشغيلي', formula: 'line:OPERATING', sequence: 1 },
  { report: 'cashflow', code: 'CF_INVESTING', label: 'Investing cash', labelAr: 'الاستثماري', formula: 'line:INVESTING', sequence: 2 },
  { report: 'cashflow', code: 'CF_FINANCING', label: 'Financing cash', labelAr: 'التمويلي', formula: 'line:FINANCING', sequence: 3 },
  { report: 'cashflow', code: 'CF_NET', label: 'Net cash change', labelAr: 'صافي التغير', formula: 'line:NET_CHANGE', sequence: 4 },
];

export function evaluateReportFormula(formula, { accountTotals = new Map(), lineTotals = new Map() } = {}) {
  const evaluateToken = (rawToken) => {
    const token = String(rawToken || '').trim();
    if (!token) return 0;
    const prefixMatch = token.match(/^sum\(prefix:([^)]+)\)$/i);
    if (prefixMatch) {
      const prefix = String(prefixMatch[1] || '').replace(/\*+$/, '');
      let sum = 0;
      for (const [code, amount] of accountTotals.entries()) {
        if (String(code).startsWith(prefix)) sum += Number(amount || 0);
      }
      return round2(sum);
    }
    const accountMatch = token.match(/^sum\(account:([^)]+)\)$/i);
    if (accountMatch) {
      return round2(accountTotals.get(String(accountMatch[1] || '').trim()) || 0);
    }
    const lineMatch = token.match(/^line:([A-Z0-9_]+)$/i);
    if (lineMatch) {
      return round2(lineTotals.get(String(lineMatch[1] || '').toUpperCase()) || 0);
    }
    const asNumber = Number(token);
    return Number.isFinite(asNumber) ? round2(asNumber) : 0;
  };

  const parts = String(formula || '').trim().split(/(?=[+-])/);
  if (!parts.length) return 0;
  let total = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('-')) total = round2(total - evaluateToken(trimmed.slice(1)));
    else if (trimmed.startsWith('+')) total = round2(total + evaluateToken(trimmed.slice(1)));
    else total = round2(total + evaluateToken(trimmed));
  }
  return total;
}

export async function getReportDefinitions(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.reportDefinitions').lean();
  const rows = tenant?.settings?.accounting?.reportDefinitions;
  if (Array.isArray(rows) && rows.length) {
    return {
      definitions: rows.sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || String(a.code).localeCompare(String(b.code))),
    };
  }
  return { definitions: DEFAULT_REPORT_DEFINITIONS };
}

export async function setReportDefinitions(tenantId, definitions) {
  if (!Array.isArray(definitions)) throw new Error('definitions array required');
  const cleaned = definitions.slice(0, 80).map((row, idx) => ({
    report: ['pnl', 'bs', 'cashflow'].includes(String(row.report || '').toLowerCase())
      ? String(row.report).toLowerCase()
      : 'pnl',
    code: String(row.code || '').trim().toUpperCase().slice(0, 32),
    label: String(row.label || '').trim().slice(0, 120),
    labelAr: String(row.labelAr || '').trim().slice(0, 120),
    formula: String(row.formula || '').trim().slice(0, 240),
    sequence: Number(row.sequence) || (idx + 1),
  })).filter((row) => row.code && row.label && row.formula);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.reportDefinitions': cleaned },
  });
  return { definitions: cleaned };
}

export async function buildEvaluatedReportLines(tenantId, reportKey, accountTotals = new Map(), initialLineTotals = new Map()) {
  const { definitions } = await getReportDefinitions(tenantId);
  const scoped = definitions.filter((row) => String(row.report || 'pnl') === reportKey);
  const lineTotals = new Map(initialLineTotals);
  const ctx = { accountTotals, lineTotals };
  const out = [];
  for (const row of scoped) {
    const amount = evaluateReportFormula(row.formula, ctx);
    lineTotals.set(String(row.code).toUpperCase(), amount);
    out.push({
      code: row.code,
      label: row.label,
      labelAr: row.labelAr,
      formula: row.formula,
      amount,
      sequence: row.sequence,
    });
  }
  return out;
}

export const BANK_SYNC_PROVIDERS = [
  { id: 'sandbox', name: 'Sandbox Bank (Demo)', nameAr: 'بنك تجريبي', oauth: true, status: 'available' },
  { id: 'saltedge', name: 'Salt Edge', nameAr: 'Salt Edge', oauth: true, status: 'coming_soon' },
  { id: 'plaid', name: 'Plaid', nameAr: 'Plaid', oauth: true, status: 'coming_soon' },
];

export async function getBankSyncStatus(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.bankSyncConnections').lean();
  const connections = Array.isArray(tenant?.settings?.accounting?.bankSyncConnections)
    ? tenant.settings.accounting.bankSyncConnections
    : [];
  return { providers: BANK_SYNC_PROVIDERS, connections };
}

export async function startBankSyncOAuth(tenantId, { provider, bankAccountId = null, journalId = null } = {}) {
  const id = String(provider || '').trim().toLowerCase();
  const meta = BANK_SYNC_PROVIDERS.find((p) => p.id === id);
  if (!meta) throw new Error('Unknown bank sync provider');
  if (meta.status === 'coming_soon') throw new Error(`${meta.name} is not available yet — use CSV import in bank reconciliation`);

  const tenant = await Tenant.findById(tenantId).select('settings.accounting.bankSyncConnections').lean();
  const connections = Array.isArray(tenant?.settings?.accounting?.bankSyncConnections)
    ? [...tenant.settings.accounting.bankSyncConnections]
    : [];
  const existingIdx = connections.findIndex((row) => row.provider === id);
  const next = {
    provider: id,
    status: 'connected',
    bankAccountId: bankAccountId || null,
    journalId: journalId || null,
    connectedAt: new Date(),
    lastSyncAt: null,
    metadata: { mode: 'sandbox_stub' },
  };
  if (existingIdx >= 0) connections[existingIdx] = { ...connections[existingIdx], ...next };
  else connections.push(next);

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.bankSyncConnections': connections },
  });

  return {
    provider: id,
    status: 'connected',
    authorizeUrl: null,
    message: 'Sandbox provider connected — import statements via Bank reconciliation until live feeds ship.',
    connections,
  };
}

export async function disconnectBankSync(tenantId, provider) {
  const id = String(provider || '').trim().toLowerCase();
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.bankSyncConnections').lean();
  const connections = (tenant?.settings?.accounting?.bankSyncConnections || [])
    .filter((row) => row.provider !== id);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.bankSyncConnections': connections },
  });
  return { connections };
}

export async function getProductCategoriesAccountingBridge(tenantId) {
  const categories = await InvProductCategory.find({ tenantId })
    .populate('incomeAccountId', 'code name nameAr')
    .populate('expenseAccountId', 'code name nameAr')
    .populate('stockValuationAccountId', 'code name nameAr')
    .sort({ completePath: 1 })
    .lean();

  const Product = (await import('../models/Product.js')).default;
  const counts = await Product.aggregate([
    { $match: { tenantId, categoryId: { $ne: null } } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [String(row._id), row.count]));

  const rows = categories.map((cat) => {
    const missing = [];
    if (!cat.incomeAccountId) missing.push('income');
    if (!cat.expenseAccountId) missing.push('expense');
    if (cat.valuationMode !== 'manual' && !cat.stockValuationAccountId) missing.push('valuation');
    return {
      id: cat._id,
      name: cat.name,
      nameAr: cat.nameAr,
      completePath: cat.completePath,
      productCount: countMap.get(String(cat._id)) || 0,
      incomeAccount: cat.incomeAccountId || null,
      expenseAccount: cat.expenseAccountId || null,
      stockValuationAccount: cat.stockValuationAccountId || null,
      valuationMode: cat.valuationMode || 'automated',
      missingAccounts: missing,
      complete: missing.length === 0,
    };
  });

  return {
    rows,
    summary: {
      total: rows.length,
      complete: rows.filter((row) => row.complete).length,
      incomplete: rows.filter((row) => !row.complete).length,
    },
  };
}

export const DEFAULT_TAX_UNITS = [
  {
    code: 'HQ',
    name: 'Head office',
    nameAr: 'المقر الرئيسي',
    vatNumber: '',
    country: 'SA',
    taxCodes: [],
    isDefault: true,
  },
];

export async function getTaxUnits(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.taxUnits').lean();
  const rows = tenant?.settings?.accounting?.taxUnits;
  if (Array.isArray(rows) && rows.length) {
    return { units: rows.filter((row) => row?.code) };
  }
  return { units: DEFAULT_TAX_UNITS };
}

export async function setTaxUnits(tenantId, units) {
  if (!Array.isArray(units)) throw new Error('units array required');
  const cleaned = units.slice(0, 30).map((row) => ({
    code: String(row.code || '').trim().slice(0, 32),
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    vatNumber: String(row.vatNumber || '').trim().slice(0, 40),
    country: String(row.country || 'SA').trim().toUpperCase().slice(0, 8),
    taxCodes: (Array.isArray(row.taxCodes) ? row.taxCodes : String(row.taxCodes || '').split(/[,،\s]+/))
      .map((c) => String(c || '').trim())
      .filter(Boolean)
      .slice(0, 30),
    isDefault: Boolean(row.isDefault),
  })).filter((row) => row.code && row.name);
  if (!cleaned.length) throw new Error('At least one tax unit is required');
  if (!cleaned.some((row) => row.isDefault)) cleaned[0].isDefault = true;
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.taxUnits': cleaned },
  });
  return { units: cleaned };
}

export const DEFAULT_ANALYTIC_DISTRIBUTION_MODELS = [
  {
    name: 'Default revenue — general',
    nameAr: 'إيرادات افتراضية — عام',
    active: true,
    priority: 10,
    matchPartnerTag: '',
    matchProductCategory: '',
    matchAccountPrefix: '4',
    lines: [{ planCode: 'DEPT', analyticAccountCode: 'GEN', percent: 100 }],
  },
];

export async function getAnalyticDistributionModels(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.analyticDistributionModels').lean();
  const rows = tenant?.settings?.accounting?.analyticDistributionModels;
  if (Array.isArray(rows) && rows.length) {
    return {
      models: rows
        .filter((row) => row?.name)
        .sort((a, b) => (a.priority || 0) - (b.priority || 0)),
    };
  }
  return { models: DEFAULT_ANALYTIC_DISTRIBUTION_MODELS };
}

export async function setAnalyticDistributionModels(tenantId, models) {
  if (!Array.isArray(models)) throw new Error('models array required');
  const cleaned = models.slice(0, 40).map((row) => {
    const lines = (Array.isArray(row.lines) ? row.lines : [])
      .slice(0, 10)
      .map((line) => ({
        planCode: String(line.planCode || '').trim().slice(0, 32),
        analyticAccountCode: String(line.analyticAccountCode || '').trim().toUpperCase().slice(0, 32),
        percent: Math.min(100, Math.max(0, Number(line.percent) || 0)),
      }))
      .filter((line) => line.analyticAccountCode && line.percent > 0);
    return {
      name: String(row.name || '').trim().slice(0, 120),
      nameAr: String(row.nameAr || '').trim().slice(0, 120),
      active: row.active !== false,
      priority: Number(row.priority) || 10,
      matchPartnerTag: String(row.matchPartnerTag || '').trim().slice(0, 60),
      matchProductCategory: String(row.matchProductCategory || '').trim().slice(0, 60),
      matchAccountPrefix: String(row.matchAccountPrefix || '').trim().slice(0, 20),
      lines: lines.length ? lines : [{ planCode: 'DEPT', analyticAccountCode: 'GEN', percent: 100 }],
    };
  }).filter((row) => row.name);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.analyticDistributionModels': cleaned },
  });
  return { models: cleaned };
}

export async function resolveAnalyticAccountIdByCode(tenantId, code) {
  const cleaned = String(code || '').trim().toUpperCase();
  if (!cleaned) return null;
  const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;
  const row = await AnalyticAccount.findOne({
    tenantId,
    code: cleaned,
    active: { $ne: false },
  }).select('_id').lean();
  return row?._id || null;
}

/** First matching active model (already priority-sorted). Empty match fields = wildcards. */
export function pickAnalyticDistributionModel(models, { accountCode, productCategory, partnerTag } = {}) {
  const active = (Array.isArray(models) ? models : []).filter((m) => m.active !== false);
  for (const m of active) {
    if (m.matchAccountPrefix) {
      if (!accountCode || !String(accountCode).startsWith(String(m.matchAccountPrefix))) continue;
    }
    if (m.matchProductCategory) {
      const cat = String(productCategory || '').toLowerCase();
      const want = String(m.matchProductCategory).toLowerCase();
      if (!cat || (!cat.includes(want) && cat !== want)) continue;
    }
    if (m.matchPartnerTag) {
      const tag = String(partnerTag || '').toLowerCase();
      const want = String(m.matchPartnerTag).toLowerCase();
      if (!tag || (!tag.includes(want) && tag !== want)) continue;
    }
    return m;
  }
  return null;
}

/**
 * Split an amount across analytic accounts using tenant distribution models.
 * If existingAnalyticAccountId is set, no split is applied.
 */
export async function applyAnalyticDistributionToAmount(tenantId, {
  amount,
  accountCode,
  productCategory,
  partnerTag,
  existingAnalyticAccountId = null,
} = {}) {
  const amt = round2(amount);
  if (amt <= 0) return [];
  if (existingAnalyticAccountId) {
    return [{ amount: amt, analyticAccountId: existingAnalyticAccountId }];
  }
  const { models } = await getAnalyticDistributionModels(tenantId);
  const model = pickAnalyticDistributionModel(models, { accountCode, productCategory, partnerTag });
  if (!model?.lines?.length) {
    return [{ amount: amt, analyticAccountId: null }];
  }
  const results = [];
  let allocated = 0;
  for (let i = 0; i < model.lines.length; i += 1) {
    const line = model.lines[i];
    let share;
    if (i === model.lines.length - 1) {
      share = round2(amt - allocated);
    } else {
      share = round2(amt * ((Number(line.percent) || 0) / 100));
      allocated = round2(allocated + share);
    }
    if (share <= 0) continue;
    const analyticAccountId = await resolveAnalyticAccountIdByCode(tenantId, line.analyticAccountCode);
    results.push({ amount: share, analyticAccountId: analyticAccountId || null });
  }
  return results.length ? results : [{ amount: amt, analyticAccountId: null }];
}

async function attachHorizontalGroups(tenantId, accountRows, amountKey = 'amount') {
  const { groups } = await getHorizontalGroups(tenantId);
  const buckets = (groups || []).map((g) => ({
    code: g.code,
    name: g.name,
    nameAr: g.nameAr,
    accountPrefixes: g.accountPrefixes || [],
    sequence: g.sequence || 0,
    amount: 0,
    accounts: [],
  }));
  const unmatched = { code: 'OTHER', name: 'Other', nameAr: 'أخرى', accountPrefixes: [], sequence: 999, amount: 0, accounts: [] };

  for (const row of accountRows || []) {
    const code = String(row.code || '');
    const amt = Number(row[amountKey] ?? row.balance ?? 0) || 0;
    const hit = buckets.find((b) => (b.accountPrefixes || []).some((p) => p && code.startsWith(String(p))));
    const target = hit || unmatched;
    target.amount = round2(target.amount + amt);
    target.accounts.push(row);
  }

  const out = buckets.filter((b) => b.accounts.length || Math.abs(b.amount) > 0.009);
  if (unmatched.accounts.length) out.push(unmatched);
  return out.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
}

/** Fixed-asset CoA balances + optional straight-line schedule preview. */
export async function buildFixedAssetRegister(tenantId, { modelCode } = {}) {
  await ensureDefaultChartOfAccounts(tenantId);
  const accounts = await ChartOfAccount.find({
    tenantId,
    isActive: true,
    $or: [{ subtype: 'fixed_asset' }, { type: 'asset', code: /^16/ }],
  }).sort({ code: 1 }).lean();

  const { models } = await getAssetModels(tenantId);
  const model = models.find((m) => m.code === modelCode) || models[0] || {
    usefulLifeMonths: 60,
    salvagePct: 0,
    method: 'straight_line',
    code: '',
  };

  const accum = await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.accumDepreciation);
  const accumBalance = Math.abs(Number(accum?.balance) || 0);

  const rows = accounts
    .filter((a) => a.subtype !== 'accum_depreciation' && String(a.code) !== ACCOUNT_CODE_MAP.accumDepreciation)
    .filter((a) => !/accum|مجمع/i.test(String(a.name || '') + String(a.nameAr || '')))
    .map((a) => {
      const cost = Math.abs(Number(a.balance) || 0);
      const salvage = round2(cost * ((Number(model.salvagePct) || 0) / 100));
      const depreciable = Math.max(0, cost - salvage);
      const months = Math.max(1, Number(model.usefulLifeMonths) || 60);
      let monthly;
      if (model.method === 'declining_balance') {
        // Double-declining monthly rate on gross cost (register preview for current month)
        monthly = round2(Math.max(0, cost - salvage) * (2 / months));
      } else {
        monthly = round2(depreciable / months);
      }
      const annual = round2(monthly * 12);
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        nameAr: a.nameAr,
        cost,
        salvage,
        depreciable,
        monthlyDepreciation: monthly,
        annualDepreciation: annual,
        usefulLifeMonths: months,
        method: model.method || 'straight_line',
        modelCode: model.code || '',
        accumDepreciationAccountId: accum?._id || null,
        accumDepreciationAccountCode: ACCOUNT_CODE_MAP.accumDepreciation,
      };
    });

  return {
    model,
    rows,
    accumDepreciation: {
      accountId: accum?._id || null,
      code: ACCOUNT_CODE_MAP.accumDepreciation,
      balance: accumBalance,
    },
    totals: {
      cost: round2(rows.reduce((s, r) => s + r.cost, 0)),
      monthlyDepreciation: round2(rows.reduce((s, r) => s + r.monthlyDepreciation, 0)),
      annualDepreciation: round2(rows.reduce((s, r) => s + r.annualDepreciation, 0)),
      netBookValue: round2(rows.reduce((s, r) => s + r.cost, 0) - accumBalance),
    },
  };
}

/**
 * Post one month of depreciation for fixed-asset CoA balances.
 * Credits Accumulated Depreciation (contra), not the cost account.
 * Idempotent per calendar month via sourceNumber DEPR-YYYY-MM.
 */
export async function postMonthlyDepreciation(tenantId, userId, { modelCode, asOf = new Date() } = {}) {
  const when = new Date(asOf);
  const periodKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
  const sourceNumber = `DEPR-${periodKey}`;
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'Depreciation',
    sourceNumber,
    status: { $in: ['draft', 'posted'] },
  }).lean();
  if (existing) {
    return { entry: existing, created: false, message: `Depreciation for ${periodKey} already exists` };
  }

  const register = await buildFixedAssetRegister(tenantId, { modelCode });
  const lines = [];
  const expense = await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.depreciation)
    || await resolveRoleAccount(tenantId, 'opex')
    || await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.opex);
  const accum = await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.accumDepreciation);
  if (!expense) throw new Error('Missing depreciation expense account (5600)');
  if (!accum) throw new Error('Missing accumulated depreciation account (1650)');

  for (const row of register.rows || []) {
    const amt = round2(row.monthlyDepreciation);
    if (amt <= 0) continue;
    lines.push({
      accountId: expense._id,
      debit: amt,
      credit: 0,
      description: `Depreciation ${row.code} ${periodKey}`,
    });
    lines.push({
      accountId: accum._id,
      debit: 0,
      credit: amt,
      description: `Accum. depreciation ${row.code} ${periodKey}`,
    });
  }
  if (lines.length < 2) throw new Error('No depreciable fixed-asset balances to post');

  const entry = await createJournalEntry({
    tenantId,
    userId,
    entryDate: when,
    type: 'manual',
    memo: `Monthly depreciation ${periodKey}`,
    memoAr: `إهلاك شهري ${periodKey}`,
    reference: sourceNumber,
    lines,
    sourceModel: 'Depreciation',
    sourceNumber,
    status: 'posted',
  });
  return { entry, created: true, periodKey, lineCount: lines.length / 2 };
}

/** Depreciation schedule matrix: posted history + projected board per asset. */
export async function buildDepreciationSchedule(tenantId, { modelCode, accountId = null, horizonMonths = 60 } = {}) {
  const register = await buildFixedAssetRegister(tenantId, { modelCode });
  const assets = (register.rows || []).filter((row) => (
    !accountId || String(row.accountId) === String(accountId)
  ));

  const postedEntries = await JournalEntry.find({
    tenantId,
    sourceModel: 'Depreciation',
    status: 'posted',
  }).sort({ entryDate: 1 }).lean();

  const postedByAssetPeriod = new Map();
  const postedPeriodMeta = new Map();
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  for (const entry of postedEntries) {
    const period = String(entry.sourceNumber || '').replace(/^DEPR-/, '') || '';
    if (period) {
      postedPeriodMeta.set(period, {
        entryId: entry._id,
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
      });
    }
    for (const line of entry.lines || []) {
      const desc = String(line.description || '');
      const m = desc.match(/(?:Depreciation|Accum\. depreciation)\s+(\d+)/i);
      if (!m) continue;
      const code = m[1];
      const amt = round2(Number(line.debit || line.credit || 0));
      if (amt <= 0) continue;
      const key = `${code}:${period}`;
      postedByAssetPeriod.set(key, round2((postedByAssetPeriod.get(key) || 0) + amt));
    }
  }

  const rows = assets.map((asset) => {
    const months = Math.min(horizonMonths, Number(asset.usefulLifeMonths) || 60);
    const start = new Date();
    let previouslyDepreciated = 0;
    const schedule = [];

    for (let i = 0; i < months; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const postedAmt = postedByAssetPeriod.get(`${asset.code}:${period}`) || 0;
      const planned = round2(asset.monthlyDepreciation);
      const amount = postedAmt > 0 ? postedAmt : planned;
      const posted = postedAmt > 0;
      if (posted) previouslyDepreciated = round2(previouslyDepreciated + postedAmt);

      let status = 'scheduled';
      if (posted) status = 'posted';
      else if (period === currentPeriod) status = 'current';

      schedule.push({
        period,
        amount,
        posted,
        status,
        entryId: posted ? postedPeriodMeta.get(period)?.entryId || null : null,
        entryNumber: posted ? postedPeriodMeta.get(period)?.entryNumber || null : null,
      });
    }

    const currentRow = schedule.find((s) => s.period === currentPeriod);
    return {
      ...asset,
      methodLabel: asset.method === 'declining_balance' ? 'Declining balance' : 'Straight line',
      previouslyDepreciated,
      currentPeriodDepreciation: currentRow?.posted ? currentRow.amount : (currentRow?.amount || asset.monthlyDepreciation),
      bookValue: round2(Math.max(0, asset.cost - previouslyDepreciated)),
      schedule,
    };
  });

  return {
    model: register.model,
    accumDepreciation: register.accumDepreciation,
    currentPeriod,
    rows,
    totals: {
      cost: round2(rows.reduce((s, r) => s + r.cost, 0)),
      previouslyDepreciated: round2(rows.reduce((s, r) => s + r.previouslyDepreciated, 0)),
      currentPeriodDepreciation: round2(rows.reduce((s, r) => s + r.currentPeriodDepreciation, 0)),
      bookValue: round2(rows.reduce((s, r) => s + r.bookValue, 0)),
    },
  };
}

export async function getAutomaticTransfers(tenantId) {
  const tenant = await Tenant.findById(tenantId).select('settings.accounting.automaticTransfers').lean();
  const rows = tenant?.settings?.accounting?.automaticTransfers;
  return { transfers: Array.isArray(rows) ? rows.filter((r) => r?.name) : [] };
}

export async function setAutomaticTransfers(tenantId, transfers) {
  if (!Array.isArray(transfers)) throw new Error('transfers array required');
  const cleaned = transfers.slice(0, 40).map((row, idx) => ({
    name: String(row.name || '').trim().slice(0, 120),
    nameAr: String(row.nameAr || '').trim().slice(0, 120),
    sourceAccountId: row.sourceAccountId || null,
    destinationAccountId: row.destinationAccountId || null,
    frequency: ['monthly', 'quarterly', 'yearly'].includes(row.frequency) ? row.frequency : 'monthly',
    percent: Math.min(100, Math.max(0, Number(row.percent) || 100)),
    active: row.active !== false,
    sequence: Number(row.sequence) || (idx + 1),
  })).filter((row) => row.name && row.sourceAccountId && row.destinationAccountId);
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { 'settings.accounting.automaticTransfers': cleaned },
  });
  return { transfers: cleaned };
}

/** Run active automatic transfer rules for the current period (percent of source balance). */
export async function runAutomaticTransfers(tenantId, userId, { asOf = new Date() } = {}) {
  const { transfers } = await getAutomaticTransfers(tenantId);
  const active = (transfers || []).filter((t) => t.active !== false);
  if (!active.length) return { created: [], message: 'No active transfer rules' };

  const when = new Date(asOf);
  const periodKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
  const created = [];

  for (const rule of active) {
    const sourceNumber = `XFER-${periodKey}-${String(rule.name).slice(0, 24)}`;
    const existing = await JournalEntry.findOne({
      tenantId,
      sourceModel: 'AutomaticTransfer',
      sourceNumber,
      status: { $in: ['draft', 'posted'] },
    }).lean();
    if (existing) continue;

    const source = await ChartOfAccount.findOne({ _id: rule.sourceAccountId, tenantId, isActive: true });
    const dest = await ChartOfAccount.findOne({ _id: rule.destinationAccountId, tenantId, isActive: true });
    if (!source || !dest) continue;
    const bal = Math.abs(Number(source.balance) || 0);
    const amt = round2(bal * ((Number(rule.percent) || 100) / 100));
    if (amt <= 0) continue;

    const entry = await createJournalEntry({
      tenantId,
      userId,
      entryDate: when,
      type: 'manual',
      memo: `Auto transfer: ${rule.name}`,
      memoAr: rule.nameAr || rule.name,
      reference: sourceNumber,
      lines: [
        { accountId: dest._id, debit: amt, credit: 0, description: rule.name },
        { accountId: source._id, debit: 0, credit: amt, description: rule.name },
      ],
      sourceModel: 'AutomaticTransfer',
      sourceNumber,
      status: 'posted',
    });
    created.push(entry);
  }

  return { created, periodKey, count: created.length };
}

export async function buildDeferredAccountsReport(tenantId, kind = 'expense', { modelCode } = {}) {
  await ensureDefaultChartOfAccounts(tenantId);
  const k = kind === 'revenue' ? 'revenue' : 'expense';
  const nameRx = k === 'revenue' ? /deferred.?rev/i : /prepaid|deferred.?exp/i;
  const accounts = await ChartOfAccount.find({
    tenantId,
    isActive: true,
    $or: [
      { subtype: k === 'revenue' ? 'other_liability' : 'other_asset' },
      { code: k === 'revenue' ? /^2[45]/ : /^15/ },
      { name: nameRx },
      { nameAr: nameRx },
    ],
  }).sort({ code: 1 }).lean();

  const { models } = await getDeferredModels(tenantId, k);
  const model = models.find((m) => m.code === modelCode) || models[0] || { months: 12, code: '' };
  const months = Math.max(1, Number(model.months) || 12);

  const rows = accounts
    .filter((a) => {
      if (k === 'revenue') {
        return /deferred|مؤجل/i.test(`${a.name || ''} ${a.nameAr || ''}`)
          || String(a.code).startsWith('24')
          || String(a.code).startsWith('25');
      }
      return /prepaid|deferred|مقدم|مؤجل/i.test(`${a.name || ''} ${a.nameAr || ''}`)
        || String(a.code).startsWith('15');
    })
    .map((a) => {
      const balance = Math.abs(Number(a.balance) || 0);
      const monthly = round2(balance / months);
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        nameAr: a.nameAr,
        type: a.type,
        subtype: a.subtype,
        balance: Number(a.balance) || 0,
        absoluteBalance: balance,
        monthlyAmortization: monthly,
        months,
        modelCode: model.code || '',
      };
    });

  return {
    kind: k,
    model,
    rows,
    total: round2(rows.reduce((s, r) => s + r.absoluteBalance, 0)),
    monthlyTotal: round2(rows.reduce((s, r) => s + r.monthlyAmortization, 0)),
  };
}

/**
 * Post one month of deferred revenue recognition or prepaid expense amortization.
 * Idempotent via sourceNumber AMORT-{REV|EXP}-YYYY-MM.
 */
export async function postMonthlyAmortization(tenantId, userId, {
  kind = 'expense',
  modelCode,
  asOf = new Date(),
} = {}) {
  const k = kind === 'revenue' ? 'revenue' : 'expense';
  const when = new Date(asOf);
  const periodKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
  const sourceNumber = `AMORT-${k === 'revenue' ? 'REV' : 'EXP'}-${periodKey}`;
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceModel: 'Amortization',
    sourceNumber,
    status: { $in: ['draft', 'posted'] },
  }).lean();
  if (existing) {
    return { entry: existing, created: false, message: `Amortization for ${periodKey} already exists`, kind: k };
  }

  const report = await buildDeferredAccountsReport(tenantId, k, { modelCode });
  const lines = [];

  if (k === 'expense') {
    const expense = await resolveRoleAccount(tenantId, 'opex')
      || await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.opex);
    if (!expense) throw new Error('Missing expense account for amortization');
    for (const row of report.rows || []) {
      const amt = round2(row.monthlyAmortization);
      if (amt <= 0 || !row.accountId) continue;
      lines.push({
        accountId: expense._id,
        debit: amt,
        credit: 0,
        description: `Amortize prepaid ${row.code} ${periodKey}`,
      });
      lines.push({
        accountId: row.accountId,
        debit: 0,
        credit: amt,
        description: `Release prepaid ${row.code} ${periodKey}`,
      });
    }
  } else {
    const income = await resolveRoleAccount(tenantId, 'sales')
      || await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.sales)
      || await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.services);
    if (!income) throw new Error('Missing income account for deferred revenue recognition');
    for (const row of report.rows || []) {
      const amt = round2(row.monthlyAmortization);
      if (amt <= 0 || !row.accountId) continue;
      lines.push({
        accountId: row.accountId,
        debit: amt,
        credit: 0,
        description: `Recognize deferred ${row.code} ${periodKey}`,
      });
      lines.push({
        accountId: income._id,
        debit: 0,
        credit: amt,
        description: `Deferred revenue ${row.code} ${periodKey}`,
      });
    }
  }

  if (lines.length < 2) throw new Error('No deferred balances to amortize');

  const entry = await createJournalEntry({
    tenantId,
    userId,
    entryDate: when,
    type: 'manual',
    memo: k === 'revenue'
      ? `Deferred revenue recognition ${periodKey}`
      : `Prepaid expense amortization ${periodKey}`,
    memoAr: k === 'revenue'
      ? `اعتراف بإيراد مؤجل ${periodKey}`
      : `إطفاء مصروف مقدم ${periodKey}`,
    reference: sourceNumber,
    lines,
    sourceModel: 'Amortization',
    sourceNumber,
    status: 'posted',
  });
  return { entry, created: true, periodKey, kind: k, lineCount: lines.length / 2 };
}

export async function buildInvoiceAnalysis(tenantId, { from, to, flow, groupBy = 'month' } = {}) {
  const { start, end } = periodRange({ from, to });
  const filter = {
    tenantId,
    status: { $nin: ['cancelled'] },
    issueDate: { $gte: start, $lte: end },
  };
  if (flow === 'sell' || flow === 'purchase') filter.flow = flow;
  const pivotMode = String(groupBy || 'month').toLowerCase();

  const invoices = await Invoice.find(filter)
    .select('flow invoiceType invoiceNumber issueDate status paymentStatus grandTotal paidAmount taxableAmount totalTax customerId supplierId buyer.name seller.name salespersonId createdByName createdByNameAr lineItems.productId lineItems.productName lineItems.quantity lineItems.unitPrice')
    .lean();

  const byMonth = new Map();
  const byPayment = { paid: 0, partial: 0, pending: 0, overdue: 0, other: 0 };
  const byStatus = {};
  const partnerMap = new Map();
  const productMap = new Map();
  let sellCount = 0;
  let purchaseCount = 0;
  let sellTotal = 0;
  let purchaseTotal = 0;
  let sellOutstanding = 0;
  let purchaseOutstanding = 0;
  let taxTotal = 0;

  for (const inv of invoices) {
    const total = Number(inv.grandTotal) || 0;
    const paid = Number(inv.paidAmount) || 0;
    const residual = Math.max(0, total - paid);
    const monthKey = inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 7) : 'unknown';
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { month: monthKey, count: 0, total: 0, paid: 0 });
    const monthRow = byMonth.get(monthKey);
    monthRow.count += 1;
    monthRow.total = round2(monthRow.total + total);
    monthRow.paid = round2(monthRow.paid + paid);

    const st = String(inv.status || 'unknown');
    byStatus[st] = (byStatus[st] || 0) + 1;

    const ps = String(inv.paymentStatus || 'pending').toLowerCase();
    if (ps in byPayment) byPayment[ps] += 1;
    else byPayment.other += 1;

    taxTotal = round2(taxTotal + (Number(inv.totalTax) || 0));

    if (inv.flow === 'purchase') {
      purchaseCount += 1;
      purchaseTotal = round2(purchaseTotal + total);
      purchaseOutstanding = round2(purchaseOutstanding + residual);
      const pid = String(inv.supplierId || inv.seller?.name || 'unknown');
      const pname = inv.seller?.name || 'Unknown vendor';
      if (!partnerMap.has(`p:${pid}`)) partnerMap.set(`p:${pid}`, { partnerId: inv.supplierId || null, name: pname, flow: 'purchase', count: 0, total: 0, outstanding: 0 });
      const prow = partnerMap.get(`p:${pid}`);
      prow.count += 1;
      prow.total = round2(prow.total + total);
      prow.outstanding = round2(prow.outstanding + residual);
    } else {
      sellCount += 1;
      sellTotal = round2(sellTotal + total);
      sellOutstanding = round2(sellOutstanding + residual);
      const cid = String(inv.customerId || inv.buyer?.name || 'unknown');
      const cname = inv.buyer?.name || 'Unknown customer';
      if (!partnerMap.has(`c:${cid}`)) partnerMap.set(`c:${cid}`, { partnerId: inv.customerId || null, name: cname, flow: 'sell', count: 0, total: 0, outstanding: 0 });
      const crow = partnerMap.get(`c:${cid}`);
      crow.count += 1;
      crow.total = round2(crow.total + total);
      crow.outstanding = round2(crow.outstanding + residual);
    }

    for (const line of inv.lineItems || []) {
      const key = String(line.productId || line.productName || 'manual');
      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: line.productId || null,
          name: line.productName || 'Manual line',
          qty: 0,
          amount: 0,
        });
      }
      const prod = productMap.get(key);
      prod.qty = round2(prod.qty + (Number(line.quantity) || 0));
      prod.amount = round2(prod.amount + ((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)));
    }
  }

  const months = [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const topPartners = [...partnerMap.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  const topProducts = [...productMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 15);
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0))
    .slice(0, 50)
    .map((inv) => ({
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      flow: inv.flow,
      partnerName: inv.flow === 'purchase' ? (inv.seller?.name || '') : (inv.buyer?.name || ''),
      grandTotal: Number(inv.grandTotal) || 0,
      taxableAmount: Number(inv.taxableAmount) || 0,
      totalTax: Number(inv.totalTax) || 0,
      paymentStatus: inv.paymentStatus,
    }));
  const chartSeries = months.map((m) => ({ label: m.month, value: m.total, count: m.count }));

  const pivotMap = new Map();
  const ensurePivot = (key, label) => {
    if (!pivotMap.has(key)) {
      pivotMap.set(key, {
        key,
        label: label || key,
        count: 0,
        total: 0,
        taxTotal: 0,
        qty: 0,
      });
    }
    return pivotMap.get(key);
  };

  if (pivotMode === 'product') {
    for (const inv of invoices) {
      for (const line of inv.lineItems || []) {
        const key = String(line.productId || line.productName || 'manual');
        const row = ensurePivot(key, line.productName || 'Manual line');
        const qty = Number(line.quantity) || 0;
        const amount = round2(qty * (Number(line.unitPrice) || 0));
        row.count += 1;
        row.qty = round2(row.qty + qty);
        row.total = round2(row.total + amount);
      }
    }
  } else {
    for (const inv of invoices) {
      const total = Number(inv.grandTotal) || 0;
      const tax = Number(inv.totalTax) || 0;
      let key = 'unknown';
      let label = 'Unknown';
      if (pivotMode === 'partner') {
        if (inv.flow === 'purchase') {
          key = String(inv.supplierId || inv.seller?.name || 'unknown');
          label = inv.seller?.name || 'Unknown vendor';
        } else {
          key = String(inv.customerId || inv.buyer?.name || 'unknown');
          label = inv.buyer?.name || 'Unknown customer';
        }
      } else if (pivotMode === 'payment') {
        key = String(inv.paymentStatus || 'pending').toLowerCase();
        label = key;
      } else if (pivotMode === 'salesperson') {
        key = String(inv.salespersonId || inv.createdByName || 'unknown');
        label = inv.createdByName || inv.createdByNameAr || 'Unassigned';
      } else if (pivotMode === 'flow') {
        key = String(inv.flow || 'sell');
        label = key === 'purchase' ? 'Purchases' : 'Sales';
      } else {
        key = inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 7) : 'unknown';
        label = key;
      }
      const row = ensurePivot(key, label);
      row.count += 1;
      row.total = round2(row.total + total);
      row.taxTotal = round2(row.taxTotal + tax);
    }
  }

  const pivotRows = [...pivotMap.values()].sort((a, b) => b.total - a.total || b.count - a.count);

  return {
    from: start,
    to: end,
    flow: flow || 'all',
    groupBy: pivotMode,
    pivotRows,
    summary: {
      invoiceCount: invoices.length,
      sellCount,
      purchaseCount,
      sellTotal,
      purchaseTotal,
      sellOutstanding,
      purchaseOutstanding,
      taxTotal,
      grandTotal: round2(sellTotal + purchaseTotal),
    },
    byPaymentStatus: byPayment,
    byDocumentStatus: byStatus,
    byMonth: months,
    topPartners,
    topProducts,
    recentInvoices,
    chartSeries,
  };
}

export async function getAccountingDashboard(tenantId) {
  await ensureDefaultChartOfAccounts(tenantId);
  const [accountCount, draftCount, postedCount, pnl, tb, agedAr, agedAp] = await Promise.all([
    ChartOfAccount.countDocuments({ tenantId, isActive: true }),
    JournalEntry.countDocuments({ tenantId, status: 'draft' }),
    JournalEntry.countDocuments({ tenantId, status: 'posted' }),
    buildProfitAndLoss(tenantId),
    buildTrialBalance(tenantId),
    buildAgedReceivables(tenantId),
    buildAgedPayables(tenantId),
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
    agedAr: {
      buckets: agedAr.buckets,
      openCount: (agedAr.rows || []).length,
    },
    agedAp: {
      buckets: agedAp.buckets,
      openCount: (agedAp.rows || []).length,
    },
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

// ─── Analytic accounts (Phase 6) ─────────────────────────────────────────────

export async function ensureDefaultAnalyticAccounts(tenantId, userId = null) {
  const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;
  const seeds = [
    { code: 'GEN', name: 'General', nameAr: 'عام', type: 'general' },
    { code: 'OPS', name: 'Operations', nameAr: 'العمليات', type: 'department' },
    { code: 'SALES', name: 'Sales', nameAr: 'المبيعات', type: 'department' },
    { code: 'ADMIN', name: 'Administration', nameAr: 'الإدارة', type: 'department' },
  ];
  const out = [];
  for (const seed of seeds) {
    let row = await AnalyticAccount.findOne({ tenantId, code: seed.code });
    if (!row) {
      row = await AnalyticAccount.create({
        ...seed,
        tenantId,
        active: true,
        isSystem: true,
        createdBy: userId || undefined,
      });
    }
    out.push(row);
  }
  return out;
}

export async function listAnalyticAccounts(tenantId, { type = null, activeOnly = true } = {}) {
  await ensureDefaultAnalyticAccounts(tenantId);
  const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;
  const filter = { tenantId };
  if (type) filter.type = type;
  if (activeOnly) filter.active = { $ne: false };
  return AnalyticAccount.find(filter).sort({ type: 1, code: 1 }).lean();
}

export async function createAnalyticAccount(tenantId, userId, payload = {}) {
  const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;
  const code = String(payload.code || '').trim().toUpperCase();
  const name = String(payload.name || '').trim();
  if (!code || !name) throw new Error('code and name required');
  const existing = await AnalyticAccount.findOne({ tenantId, code });
  if (existing) throw new Error('Analytic account code already exists');
  return AnalyticAccount.create({
    tenantId,
    code,
    name,
    nameAr: payload.nameAr || '',
    type: ['general', 'department', 'project', 'cost_center'].includes(payload.type)
      ? payload.type
      : 'general',
    active: payload.active !== false,
    createdBy: userId || undefined,
  });
}

export async function updateAnalyticAccount(tenantId, userId, id, patch = {}) {
  const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;
  const row = await AnalyticAccount.findOne({ _id: id, tenantId });
  if (!row) throw new Error('Analytic account not found');
  if (patch.name !== undefined) row.name = String(patch.name).trim();
  if (patch.nameAr !== undefined) row.nameAr = String(patch.nameAr || '').trim();
  if (patch.active !== undefined) row.active = Boolean(patch.active);
  if (patch.type !== undefined && !row.isSystem) {
    row.type = ['general', 'department', 'project', 'cost_center'].includes(patch.type)
      ? patch.type
      : row.type;
  }
  row.updatedBy = userId || undefined;
  await row.save();
  return row;
}

/**
 * Analytic ledger / summary from posted JournalItems tagged with analyticAccountId.
 */
export async function buildAnalyticReport(tenantId, {
  analyticAccountId = null,
  from,
  to,
} = {}) {
  const { start, end } = periodRange({ from, to });
  const AnalyticAccount = (await import('../models/AnalyticAccount.js')).default;

  let analytics = [];
  if (analyticAccountId) {
    const one = await AnalyticAccount.findOne({ _id: analyticAccountId, tenantId }).lean();
    if (!one) throw new Error('Analytic account not found');
    analytics = [one];
  } else {
    analytics = await AnalyticAccount.find({ tenantId, active: { $ne: false } }).sort({ code: 1 }).lean();
  }

  const filter = {
    tenantId,
    state: 'posted',
    analyticAccountId: { $ne: null },
    entryDate: { $gte: start, $lte: end },
  };
  if (analyticAccountId) filter.analyticAccountId = analyticAccountId;

  const items = await JournalItem.find(filter)
    .sort({ entryDate: 1, lineIndex: 1 })
    .populate('accountId', 'code name nameAr type')
    .lean();

  const moveIds = [...new Set(items.map((i) => String(i.moveId)).filter(Boolean))];
  const moves = moveIds.length
    ? await JournalEntry.find({ tenantId, _id: { $in: moveIds } })
      .select('sourceModel sourceId sourceNumber reference')
      .lean()
    : [];
  const moveById = Object.fromEntries(moves.map((m) => [String(m._id), m]));

  const byAnalytic = new Map(analytics.map((a) => [String(a._id), {
    analytic: a,
    totalDebit: 0,
    totalCredit: 0,
    lines: [],
  }]));

  for (const item of items) {
    const key = String(item.analyticAccountId);
    if (!byAnalytic.has(key)) continue;
    const bucket = byAnalytic.get(key);
    const debit = round2(item.debit);
    const credit = round2(item.credit);
    bucket.totalDebit = round2(bucket.totalDebit + debit);
    bucket.totalCredit = round2(bucket.totalCredit + credit);
    bucket.lines.push({
      date: item.entryDate,
      entryNumber: item.entryNumber,
      moveId: item.moveId,
      accountCode: item.accountCode || item.accountId?.code || '',
      accountName: item.accountName || item.accountId?.name || '',
      description: item.description || '',
      debit,
      credit,
      net: round2(debit - credit),
      sourceModel: item.sourceModel || moveById[String(item.moveId)]?.sourceModel || '',
      sourceId: item.sourceId || moveById[String(item.moveId)]?.sourceId || null,
      sourceNumber: moveById[String(item.moveId)]?.sourceNumber || moveById[String(item.moveId)]?.reference || '',
    });
  }

  const rows = [...byAnalytic.values()].map((b) => ({
    ...b,
    net: round2(b.totalDebit - b.totalCredit),
  }));

  return {
    from: start,
    to: end,
    analyticAccountId: analyticAccountId || null,
    rows,
    totalDebit: round2(rows.reduce((s, r) => s + r.totalDebit, 0)),
    totalCredit: round2(rows.reduce((s, r) => s + r.totalCredit, 0)),
  };
}

/**
 * Close P&L into Retained Earnings for [from, to], post type=closing, set hardLockDate.
 */
export async function closeAccountingPeriod(tenantId, userId, {
  from,
  to,
  setHardLock = true,
  currency = 'SAR',
} = {}) {
  if (!to) throw new Error('Period end date (to) is required');
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const start = from
    ? new Date(from)
    : new Date(end.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);

  const closeKey = `CLOSE-${end.toISOString().slice(0, 10)}`;
  const existing = await JournalEntry.findOne({
    tenantId,
    type: 'closing',
    reference: closeKey,
    status: { $nin: ['void', 'reversed'] },
  });
  if (existing) {
    throw new Error(`Period already closed (${existing.entryNumber}). Reverse that entry first to re-close.`);
  }

  const pnl = await buildProfitAndLoss(tenantId, { from: start, to: end });
  const retained = await getAccountByCode(tenantId, ACCOUNT_CODE_MAP.retained);
  if (!retained) throw new Error('Retained earnings account (3100) not found');

  const lines = [];
  for (const rev of pnl.revenue || []) {
    const amt = round2(rev.amount);
    if (amt <= 0.009) continue;
    lines.push({
      accountId: rev._id,
      accountCode: rev.code,
      debit: amt,
      credit: 0,
      description: `Close revenue ${rev.code}`,
    });
  }
  for (const exp of pnl.expenses || []) {
    const amt = round2(exp.amount);
    if (amt <= 0.009) continue;
    lines.push({
      accountId: exp._id,
      accountCode: exp.code,
      debit: 0,
      credit: amt,
      description: `Close expense ${exp.code}`,
    });
  }

  const net = round2(pnl.netIncome);
  if (Math.abs(net) > 0.009) {
    if (net > 0) {
      lines.push({
        accountId: retained._id,
        accountCode: retained.code,
        debit: 0,
        credit: net,
        description: 'Close net income to retained earnings',
      });
    } else {
      lines.push({
        accountId: retained._id,
        accountCode: retained.code,
        debit: Math.abs(net),
        credit: 0,
        description: 'Close net loss to retained earnings',
      });
    }
  }

  if (lines.length < 2) {
    throw new Error('Nothing to close — no P&L activity in this period');
  }

  const locks = await getAccountingLockDates(tenantId);
  const hard = locks.hardLockDate ? startOfDay(locks.hardLockDate) : null;
  const day = startOfDay(end);
  if (hard && day && day.getTime() <= hard.getTime()) {
    throw new Error(
      `Accounting period is hard-locked through ${hard.toISOString().slice(0, 10)}. Cannot close again.`,
    );
  }

  const journalId = await resolveJournalBookId(tenantId, userId, 'ensureDefaultMiscJournal');

  const entry = await createJournalEntry({
    tenantId,
    userId,
    entryDate: end,
    type: 'closing',
    memo: `Period close ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
    memoAr: `إقفال الفترة ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
    reference: closeKey,
    currency,
    lines,
    sourceModel: 'PeriodClose',
    sourceNumber: closeKey,
    status: 'posted',
    journalId,
    bypassLockCheck: true,
  });

  let locksAfter = locks;
  if (setHardLock !== false) {
    locksAfter = await setAccountingLockDates(tenantId, { hardLockDate: end });
  }

  return {
    entry,
    pnl: {
      from: start,
      to: end,
      totalRevenue: pnl.totalRevenue,
      totalExpenses: pnl.totalExpenses,
      netIncome: pnl.netIncome,
    },
    locks: locksAfter,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function cashFlowSection() {
  return { rows: [], net: 0 };
}

function classifyCashFlowBucket(account) {
  if (!account) return 'operating';
  const tags = (Array.isArray(account.tags) ? account.tags : [])
    .map((tag) => String(tag || '').trim().toLowerCase())
    .filter(Boolean);
  if (tags.includes('investing')) return 'investing';
  if (tags.includes('financing')) return 'financing';
  if (tags.includes('operating')) return 'operating';
  if (tags.includes('tax')) return 'operating';
  const subtype = account.subtype || '';
  const type = account.type || '';
  if (subtype === 'fixed_asset' || subtype === 'inventory') {
    return subtype === 'fixed_asset' ? 'investing' : 'operating';
  }
  if (type === 'equity' || subtype === 'other_liability' || /loan/i.test(account.name || '') || ['2300', '3000', '3200'].includes(account.code)) {
    return 'financing';
  }
  return 'operating';
}

/**
 * Direct-method cash flow from posted cash/bank JournalEntry lines.
 * Counterpart lines (non-cash) classify into operating / investing / financing.
 */
export async function buildCashFlowStatement(tenantId, { from, to } = {}) {
  const { start, end } = periodRange({ from, to });
  await ensureDefaultChartOfAccounts(tenantId);

  const accounts = await ChartOfAccount.find({ tenantId, isActive: true }).lean();
  const byId = Object.fromEntries(accounts.map((a) => [String(a._id), a]));
  const cashIds = new Set(
    accounts.filter((a) => a.subtype === 'cash' || a.subtype === 'bank').map((a) => String(a._id)),
  );

  const balanceAt = async (asOfEnd) => {
    const entries = await JournalEntry.find({
      tenantId,
      status: 'posted',
      entryDate: { $lte: asOfEnd },
    }).select('lines').lean();
    let total = 0;
    for (const entry of entries) {
      for (const line of entry.lines || []) {
        if (!cashIds.has(String(line.accountId))) continue;
        total = round2(total + Number(line.debit || 0) - Number(line.credit || 0));
      }
    }
    return total;
  };

  const dayBefore = new Date(start);
  dayBefore.setMilliseconds(dayBefore.getMilliseconds() - 1);
  const [openingCash, closingCash] = await Promise.all([balanceAt(dayBefore), balanceAt(end)]);

  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: start, $lte: end },
  }).sort({ entryDate: 1, entryNumber: 1 }).lean();

  const operating = cashFlowSection();
  const investing = cashFlowSection();
  const financing = cashFlowSection();
  const sections = { operating, investing, financing };

  const bump = (sectionKey, label, amount) => {
    if (Math.abs(amount) < 0.005) return;
    const sec = sections[sectionKey];
    const existing = sec.rows.find((r) => r.label === label);
    if (existing) existing.amount = round2(existing.amount + amount);
    else sec.rows.push({ label, amount: round2(amount) });
    sec.net = round2(sec.net + amount);
  };

  for (const entry of entries) {
    const lines = entry.lines || [];
    const cashLines = lines.filter((l) => cashIds.has(String(l.accountId)));
    if (!cashLines.length) continue;
    const otherLines = lines.filter((l) => !cashIds.has(String(l.accountId)));
    const cashNet = round2(cashLines.reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0));
    if (Math.abs(cashNet) < 0.005) continue;

    if (!otherLines.length) {
      bump('operating', entry.memo || entry.entryNumber || 'Cash transfer', cashNet);
      continue;
    }

    const otherAbs = otherLines.reduce(
      (s, l) => s + Math.abs(Number(l.debit || 0) - Number(l.credit || 0)),
      0,
    ) || 1;

    for (const line of otherLines) {
      const account = byId[String(line.accountId)];
      const lineNet = Number(line.debit || 0) - Number(line.credit || 0);
      const weight = Math.abs(lineNet) / otherAbs;
      // Cash increase when other side is credit-heavy (typical); allocate cashNet by weight
      const allocated = round2(cashNet * weight);
      const label = account
        ? `${account.code} — ${account.name}`
        : (line.accountCode || line.description || 'Other');
      bump(classifyCashFlowBucket(account), label, allocated);
    }
  }

  for (const key of Object.keys(sections)) {
    sections[key].rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    sections[key].net = round2(sections[key].net);
  }

  const netChange = round2(operating.net + investing.net + financing.net);
  const expectedChange = round2(closingCash - openingCash);
  const reconciled = Math.abs(netChange - expectedChange) < 0.05;

  let pnl;
  try {
    pnl = await buildProfitAndLoss(tenantId, { from: start, to: end });
  } catch {
    pnl = { netIncome: 0 };
  }

  const plug = round2(expectedChange - (pnl.netIncome || 0));
  const indirect = {
    netIncome: round2(pnl.netIncome || 0),
    nonCashAndWorkingCapital: plug,
    netCashFromOperationsApprox: round2((pnl.netIncome || 0) + plug),
    noteEn: 'Indirect bridge: net income plus a single working-capital / non-cash plug so the result equals the period cash change. Prefer the direct sections above for detail.',
    noteAr: 'جسر غير مباشر: صافي الدخل مع تسوية واحدة لرأس المال العامل/البنود غير النقدية لتطابق التغير النقدي. التفصيل في الأقسام المباشرة أعلاه.',
  };

  const cashflowLineTotals = new Map([
    ['OPERATING', operating.net],
    ['INVESTING', investing.net],
    ['FINANCING', financing.net],
    ['NET_CHANGE', netChange],
    ['OPENING_CASH', round2(openingCash)],
    ['CLOSING_CASH', round2(closingCash)],
  ]);
  const customReportLines = await buildEvaluatedReportLines(tenantId, 'cashflow', new Map(), cashflowLineTotals);

  const notes = [
    {
      en: 'Direct method: cash and bank journal lines classified by counterpart account (operating / investing / financing).',
      ar: 'الطريقة المباشرة: تصنيف حركات النقد والبنك حسب الحساب المقابل (تشغيلي / استثماري / تمويلي).',
    },
    {
      en: reconciled
        ? 'Sections reconcile to opening → closing cash & bank.'
        : `Sections total ${netChange} vs cash change ${expectedChange}; review multi-line journals or transfers between cash accounts.`,
      ar: reconciled
        ? 'الأقسام تطابق التغير من الرصيد الافتتاحي إلى الختامي للنقد والبنك.'
        : `مجموع الأقسام ${netChange} مقابل تغير النقد ${expectedChange}؛ راجع القيود متعددة البنود أو التحويلات بين حسابات النقد.`,
    },
  ];

  return {
    from: start,
    to: end,
    method: 'direct',
    operating,
    investing,
    financing,
    netChange,
    openingCash: round2(openingCash),
    closingCash: round2(closingCash),
    expectedChange,
    reconciled,
    indirect,
    notes,
    customReportLines,
  };
}

function agingBucket(ageDays) {
  if (ageDays <= 30) return 'd0_30';
  if (ageDays <= 60) return 'd31_60';
  if (ageDays <= 90) return 'd61_90';
  return 'd90_plus';
}

const EMPTY_AGING_BUCKETS = () => ({
  d0_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90_plus: 0,
  total: 0,
});

async function buildAgedInvoices(tenantId, { flow, asOf = null } = {}) {
  const asOfDate = asOf ? new Date(asOf) : new Date();
  asOfDate.setHours(23, 59, 59, 999);

  const invoices = await Invoice.find({
    tenantId,
    flow,
    status: { $nin: ['draft', 'cancelled'] },
    paymentStatus: { $nin: ['paid', 'cancelled'] },
    issueDate: { $lte: asOfDate },
  })
    .select('invoiceNumber invoiceType issueDate dueDate grandTotal paidAmount customerId supplierId paymentStatus paymentSchedule')
    .lean();

  const partnerIds = [
    ...new Set(
      invoices
        .map((inv) => String(flow === 'sell' ? inv.customerId : inv.supplierId || inv.customerId || ''))
        .filter((id) => id && id !== 'undefined' && id !== 'null'),
    ),
  ];
  const partners = partnerIds.length
    ? await Customer.find({ _id: { $in: partnerIds }, tenantId }).select('name nameAr displayName phone mobile').lean()
    : [];
  const partnerById = Object.fromEntries(partners.map((p) => [String(p._id), p]));

  const followUpLevels = flow === 'sell' ? (await getFollowUpLevels(tenantId)).levels : [];

  const buckets = EMPTY_AGING_BUCKETS();
  const rows = [];

  const pushAgingRow = ({
    inv,
    partner,
    partnerId,
    residual,
    dueDate,
    trancheSequence = null,
  }) => {
    if (residual < 0.01) return;
    const baseDate = new Date(dueDate || inv.dueDate || inv.issueDate || asOfDate);
    const ageDays = Math.max(0, Math.floor((asOfDate - baseDate) / MS_PER_DAY));
    const bucket = agingBucket(ageDays);
    buckets[bucket] = round2(buckets[bucket] + residual);
    buckets.total = round2(buckets.total + residual);
    rows.push({
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      partnerId: partnerId || null,
      partnerName: partner?.displayName || partner?.name || partner?.nameAr || '—',
      partnerPhone: partner?.mobile || partner?.phone || '',
      issueDate: inv.issueDate,
      dueDate: dueDate || inv.dueDate || null,
      grandTotal: round2(inv.grandTotal),
      paidAmount: round2(inv.paidAmount),
      residual,
      ageDays,
      bucket,
      paymentStatus: inv.paymentStatus,
      trancheSequence,
      followUpLevel: flow === 'sell' ? resolveFollowUpLevel(ageDays, followUpLevels) : null,
    });
  };

  for (const inv of invoices) {
    const grossResidual = round2(Math.max(0, Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0)));
    if (grossResidual < 0.01) continue;

    const partnerId = flow === 'sell' ? inv.customerId : (inv.supplierId || inv.customerId);
    const partner = partnerId ? partnerById[String(partnerId)] : null;
    const schedule = Array.isArray(inv.paymentSchedule)
      ? inv.paymentSchedule.filter((row) => round2(Number(row.amount || 0)) > 0)
      : [];

    if (schedule.length > 1) {
      let remainingPaid = round2(Number(inv.paidAmount || 0));
      for (const tranche of schedule) {
        const trancheAmount = round2(Number(tranche.amount || 0));
        const paidOnTranche = Math.min(remainingPaid, trancheAmount);
        const trancheResidual = round2(trancheAmount - paidOnTranche);
        remainingPaid = round2(remainingPaid - paidOnTranche);
        pushAgingRow({
          inv,
          partner,
          partnerId,
          residual: trancheResidual,
          dueDate: tranche.dueDate,
          trancheSequence: tranche.sequence,
        });
      }
      continue;
    }

    pushAgingRow({
      inv,
      partner,
      partnerId,
      residual: grossResidual,
      dueDate: inv.dueDate,
    });
  }

  rows.sort((a, b) => b.ageDays - a.ageDays || b.residual - a.residual);

  return {
    asOf: asOfDate,
    flow,
    buckets,
    rows,
  };
}

export async function buildAgedReceivables(tenantId, opts = {}) {
  return buildAgedInvoices(tenantId, { ...opts, flow: 'sell' });
}

export async function buildAgedPayables(tenantId, opts = {}) {
  return buildAgedInvoices(tenantId, { ...opts, flow: 'purchase' });
}

/**
 * Accounting tax summary from posted JournalItems tagged with taxIds (Phase 4 stamp).
 * Complements the statutory VAT return under /reports/vat-return.
 */
export async function buildTaxReport(tenantId, { from, to, taxUnitCode = null } = {}) {
  const { start, end } = periodRange({ from, to });
  const Tax = (await import('../models/Tax.js')).default;
  const taxes = await Tax.find({ tenantId }).lean();
  const taxById = Object.fromEntries(taxes.map((t) => [String(t._id), t]));

  let allowedCodes = null;
  let taxUnit = null;
  if (taxUnitCode) {
    const { units } = await getTaxUnits(tenantId);
    taxUnit = (units || []).find((u) => String(u.code).toLowerCase() === String(taxUnitCode).toLowerCase()) || null;
    if (taxUnit?.taxCodes?.length) {
      allowedCodes = new Set(taxUnit.taxCodes.map((c) => String(c).toUpperCase()));
    }
  }

  const items = await JournalItem.find({
    tenantId,
    state: 'posted',
    entryDate: { $gte: start, $lte: end },
    taxIds: { $exists: true, $ne: [] },
  }).lean();

  const moveIds = [...new Set(items.map((i) => String(i.moveId)).filter(Boolean))];
  const moves = moveIds.length
    ? await JournalEntry.find({ tenantId, _id: { $in: moveIds } })
      .select('sourceModel sourceId sourceNumber reference')
      .lean()
    : [];
  const moveById = Object.fromEntries(moves.map((m) => [String(m._id), m]));

  const byTax = {};
  const linesByTax = {};
  let totalDebit = 0;
  let totalCredit = 0;

  for (const item of items) {
    const ids = item.taxIds || [];
    if (!ids.length) continue;
    const debit = Number(item.debit || 0);
    const credit = Number(item.credit || 0);
    totalDebit = round2(totalDebit + debit);
    totalCredit = round2(totalCredit + credit);
    const move = moveById[String(item.moveId)] || {};
    for (const tid of ids) {
      const key = String(tid);
      const tax = taxById[key];
      if (allowedCodes && (!tax?.code || !allowedCodes.has(String(tax.code).toUpperCase()))) continue;
      if (!byTax[key]) {
        byTax[key] = {
          taxId: tid,
          code: tax?.code || 'TAX',
          name: tax?.name || 'Tax',
          nameAr: tax?.nameAr || '',
          rate: tax?.rate ?? null,
          type: tax?.type || '',
          debit: 0,
          credit: 0,
          lineCount: 0,
        };
      }
      byTax[key].debit = round2(byTax[key].debit + debit / ids.length);
      byTax[key].credit = round2(byTax[key].credit + credit / ids.length);
      byTax[key].lineCount += 1;
      if (!linesByTax[key]) linesByTax[key] = [];
      linesByTax[key].push({
        date: item.entryDate,
        entryNumber: item.entryNumber,
        moveId: item.moveId,
        accountCode: item.accountCode || '',
        description: item.description || '',
        debit: round2(debit / ids.length),
        credit: round2(credit / ids.length),
        sourceModel: item.sourceModel || move.sourceModel || '',
        sourceId: item.sourceId || move.sourceId || null,
        sourceNumber: move.sourceNumber || move.reference || '',
      });
    }
  }

  const rows = Object.values(byTax).map((r) => ({
    ...r,
    net: round2(r.credit - r.debit),
    lines: linesByTax[String(r.taxId)] || [],
  })).sort((a, b) => String(a.code).localeCompare(String(b.code)));

  const filteredDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const filteredCredit = round2(rows.reduce((s, r) => s + r.credit, 0));

  const outputGrid = [];
  const inputGrid = [];
  for (const row of rows) {
    const taxAmount = round2(Math.abs(row.net));
    const rate = Number(row.rate) || 0;
    const baseAmount = rate > 0 ? round2(taxAmount / (rate / 100)) : round2(Math.max(row.debit, row.credit));
    const gridRow = {
      taxId: row.taxId,
      code: row.code,
      name: row.name,
      nameAr: row.nameAr,
      rate: row.rate,
      baseAmount,
      taxAmount,
      lineCount: row.lineCount,
    };
    const t = String(row.type || '').toLowerCase();
    if (t.includes('purchase') || t.includes('input') || row.net < 0) inputGrid.push(gridRow);
    else outputGrid.push(gridRow);
  }
  const outputTax = round2(outputGrid.reduce((s, r) => s + r.taxAmount, 0));
  const inputTax = round2(inputGrid.reduce((s, r) => s + r.taxAmount, 0));

  const { groups: taxGroupsConfig } = await getTaxGroups(tenantId);
  const taxGroupsRollup = (taxGroupsConfig || []).map((group) => {
    const codes = new Set((group.taxCodes || []).map((c) => String(c).toUpperCase()));
    const matched = codes.size
      ? rows.filter((row) => codes.has(String(row.code || '').toUpperCase()))
      : [];
    const debit = round2(matched.reduce((s, r) => s + r.debit, 0));
    const credit = round2(matched.reduce((s, r) => s + r.credit, 0));
    return {
      code: group.code,
      name: group.name,
      nameAr: group.nameAr,
      debit,
      credit,
      net: round2(credit - debit),
      taxCount: matched.length,
      taxes: matched.map((r) => ({ code: r.code, name: r.name, net: r.net })),
    };
  }).filter((g) => g.taxCount > 0 || (taxGroupsConfig || []).length <= 3);

  return {
    from: start,
    to: end,
    rows,
    outputGrid,
    inputGrid,
    outputTax,
    inputTax,
    netVatDue: round2(outputTax - inputTax),
    taxGroupsRollup,
    totalDebit: allowedCodes ? filteredDebit : totalDebit,
    totalCredit: allowedCodes ? filteredCredit : totalCredit,
    net: round2((allowedCodes ? filteredCredit : totalCredit) - (allowedCodes ? filteredDebit : totalDebit)),
    taxUnit: taxUnit ? { code: taxUnit.code, name: taxUnit.name, nameAr: taxUnit.nameAr } : null,
  };
}

/** Kanban board: draft / posted / reversed / void columns. */
export async function getJournalBoard(tenantId, { journalId = null, limit = 40 } = {}) {
  const filter = { tenantId };
  if (journalId) filter.journalId = journalId;
  const cap = Math.min(80, Math.max(5, Number(limit) || 40));
  const statuses = ['draft', 'posted', 'reversed', 'void'];

  const columns = {};
  await Promise.all(statuses.map(async (status) => {
    columns[status] = await JournalEntry.find({ ...filter, status })
      .sort({ entryDate: -1, createdAt: -1 })
      .limit(cap)
      .select('entryNumber entryDate memo type status totalDebit totalCredit journalId sourceNumber createdAt')
      .lean();
  }));

  const counts = {};
  await Promise.all(statuses.map(async (status) => {
    counts[status] = await JournalEntry.countDocuments({ ...filter, status });
  }));

  return { journalId: journalId || null, columns, counts, limit: cap };
}

export default {
  ensureDefaultChartOfAccounts,
  ensureDefaultTaxes,
  listTaxes,
  createTax,
  updateTax,
  resolveDefaultTaxId,
  ensureDefaultAnalyticAccounts,
  listAnalyticAccounts,
  createAnalyticAccount,
  updateAnalyticAccount,
  buildAnalyticReport,
  closeAccountingPeriod,
  buildCashFlowStatement,
  buildAgedReceivables,
  buildAgedPayables,
  buildTaxReport,
  getJournalBoard,
  ensureAccountingDefaults,
  getAccountingDefaults,
  setAccountingDefaults,
  resolveRoleAccount,
  DEFAULT_ACCOUNT_KEYS,
  createJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  reverseJournalEntry,
  getAccountingLockDates,
  setAccountingLockDates,
  assertAccountingPeriodOpen,
  listJournalItems,
  backfillJournalItems,
  postSalesInvoiceJournal,
  postInvoicePaymentJournal,
  postEarlyPaymentDiscountJournal,
  postInvoicePaymentDifferenceJournal,
  postVendorBillPaymentJournal,
  postOutstandingPaymentClearance,
  postOutstandingReceiptClearance,
  postVendorRefundJournal,
  reconcileVendorRefundWithBill,
  reconcileCreditNoteWithInvoice,
  postSupplierPaymentJournal,
  postExpensePaidJournal,
  postVoucherJournal,
  postCreditNoteJournal,
  postCreditNoteRefundJournal,
  backfillJournalPartnerIds,
  buildPartnerLedger,
  buildTrialBalance,
  buildProfitAndLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  buildJournalReport,
  getAccountingDashboard,
  getFiscalPositions,
  setFiscalPositions,
  getPaymentTermsCatalog,
  setPaymentTermsCatalog,
  getIncotermsCatalog,
  setIncotermsCatalog,
  buildInvoiceAnalysis,
  getFollowUpLevels,
  setFollowUpLevels,
  resolveFollowUpLevel,
  getReconciliationModels,
  setReconciliationModels,
  getJournalGroups,
  setJournalGroups,
  getAccountingPaymentProviders,
  setAccountingPaymentProviders,
  getBankAccountsCatalog,
  createBankAccountSetup,
  getCurrenciesCatalog,
  setCurrenciesCatalog,
  getAssetModels,
  setAssetModels,
  getAnalyticPlans,
  setAnalyticPlans,
  getAccountTags,
  setAccountTags,
  getHorizontalGroups,
  setHorizontalGroups,
  getTaxGroups,
  setTaxGroups,
  getReportDefinitions,
  setReportDefinitions,
  buildEvaluatedReportLines,
  evaluateReportFormula,
  getBankSyncStatus,
  startBankSyncOAuth,
  disconnectBankSync,
  getProductCategoriesAccountingBridge,
  buildReceivableDebitLines,
  buildPayableCreditLines,
  allocatePaymentToTranches,
  handleAccountingPaymentProviderWebhook,
  getTaxUnits,
  setTaxUnits,
  getAnalyticDistributionModels,
  setAnalyticDistributionModels,
  applyAnalyticDistributionToAmount,
  pickAnalyticDistributionModel,
  buildFixedAssetRegister,
  buildDepreciationSchedule,
  postMonthlyDepreciation,
  getAutomaticTransfers,
  setAutomaticTransfers,
  runAutomaticTransfers,
  getDeferredModels,
  setDeferredModels,
  buildDeferredAccountsReport,
  postMonthlyAmortization,
  buildCustomerAccountReport,
  buildCustomerSummaryReport,
  buildSupplierSummaryReport,
  buildSupplierAccountReport,
};
