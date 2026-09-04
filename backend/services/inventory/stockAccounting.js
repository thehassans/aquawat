import ChartOfAccount from '../../models/ChartOfAccount.js';
import JournalEntry from '../../models/JournalEntry.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import InvLandedCost from '../../models/inventory/InvLandedCost.js';
import {
  createJournalEntry,
  ensureDefaultChartOfAccounts,
  getAccountByCode,
  normalizeAccountingOverrideLines,
  buildPayableCreditLines,
} from '../accountingService.js';
import { D, decIsZero } from '../../utils/decimal.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Five accounts required on each Automated-valuation product category. */
export const AUTOMATED_CATEGORY_ACCOUNT_KEYS = [
  'stockValuationAccountId',
  'stockInputAccountId',
  'stockOutputAccountId',
  'stockJournalId',
  'expenseAccountId',
];

export const STOCK_ACCOUNT_DEFS = [
  {
    code: '1310',
    name: 'Stock Interim (Received)',
    nameAr: 'مخزون وسيط — استلام',
    // Balance-sheet clearing in the 1xxx asset range (Odoo Anglo-Saxon style).
    // Credit balance = GRNI; never classify as liability while coded 1xxx.
    type: 'asset',
    subtype: 'other_asset',
  },
  {
    code: '1320',
    name: 'Stock Interim (Delivered)',
    nameAr: 'مخزون وسيط — تسليم',
    // Clearing asset: delivery Dr 1320 / Cr 1300; invoice Dr 5000 / Cr 1320.
    type: 'asset',
    subtype: 'other_asset',
  },
];

export async function ensureStockAccountingAccounts(tenantId, userId = null) {
  await ensureDefaultChartOfAccounts(tenantId, userId);
  for (const def of STOCK_ACCOUNT_DEFS) {
    const existing = await ChartOfAccount.findOne({ tenantId, code: def.code });
    if (!existing) {
      await ChartOfAccount.create({
        ...def,
        tenantId,
        isSystem: true,
        isActive: true,
        isPostable: true,
        balance: 0,
        createdBy: userId || undefined,
      });
      continue;
    }
    // Heal misclassified system interims without changing code / _id (JE lines stay valid).
    const patch = {};
    if (String(existing.type) !== def.type) patch.type = def.type;
    if (String(existing.subtype || '') !== def.subtype) patch.subtype = def.subtype;
    if (String(existing.name || '') !== def.name) patch.name = def.name;
    if (String(existing.nameAr || '') !== def.nameAr) patch.nameAr = def.nameAr;
    if (!existing.isSystem) patch.isSystem = true;
    if (Object.keys(patch).length) {
      await ChartOfAccount.updateOne({ _id: existing._id, tenantId }, { $set: patch });
    }
  }
  await ensureDefaultStockJournal(tenantId, userId);
}

/**
 * Ensure a system Stock journal book exists (not a JournalEntry).
 */
export async function ensureDefaultStockJournal(tenantId, userId = null) {
  const tid = toObjectId(tenantId);
  const Journal = (await import('../../models/Journal.js')).default;
  let book = await Journal.findOne({ tenantId: tid, code: 'STJ' });
  if (!book) {
    book = await Journal.findOne({ tenantId: tid, type: 'stock', isSystem: true });
  }
  if (!book) {
    book = await Journal.create({
      tenantId: tid,
      code: 'STJ',
      name: 'Stock Journal',
      nameAr: 'دفتر المخزون',
      type: 'stock',
      sequencePrefix: 'STJ',
      active: true,
      isSystem: true,
      createdBy: userId || undefined,
    });
  }
  return book;
}

/** System Sales journal book (SAL) for invoice revenue entries. */
export async function ensureDefaultSalesJournal(tenantId, userId = null) {
  return ensureJournalBook(tenantId, {
    code: 'SAL',
    name: 'Sales Journal',
    nameAr: 'دفتر المبيعات',
    type: 'sales',
    sequencePrefix: 'SAL',
    userId,
    defaultDebitRole: 'ar',
    defaultCreditRole: 'sales',
  });
}

export async function ensureDefaultPurchaseJournal(tenantId, userId = null) {
  return ensureJournalBook(tenantId, {
    code: 'PUR',
    name: 'Purchase Journal',
    nameAr: 'دفتر المشتريات',
    type: 'purchase',
    sequencePrefix: 'PUR',
    userId,
    defaultDebitRole: 'inventory',
    defaultCreditRole: 'ap',
  });
}

export async function ensureDefaultCashJournal(tenantId, userId = null) {
  return ensureJournalBook(tenantId, {
    code: 'CSH',
    name: 'Cash Journal',
    nameAr: 'دفتر النقدية',
    type: 'cash',
    sequencePrefix: 'CSH',
    userId,
    defaultDebitRole: 'cash',
    defaultCreditRole: 'ar',
  });
}

export async function ensureDefaultBankJournal(tenantId, userId = null) {
  return ensureJournalBook(tenantId, {
    code: 'BNK',
    name: 'Bank Journal',
    nameAr: 'دفتر البنك',
    type: 'bank',
    sequencePrefix: 'BNK',
    userId,
    defaultDebitRole: 'bank',
    defaultCreditRole: 'ar',
  });
}

export async function ensureDefaultMiscJournal(tenantId, userId = null) {
  return ensureJournalBook(tenantId, {
    code: 'MISC',
    name: 'Miscellaneous Journal',
    nameAr: 'دفتر متنوع',
    type: 'miscellaneous',
    sequencePrefix: 'MISC',
    userId,
    defaultDebitRole: 'suspense',
    defaultCreditRole: 'suspense',
  });
}

async function ensureJournalBook(tenantId, {
  code,
  name,
  nameAr,
  type,
  sequencePrefix,
  userId = null,
  defaultDebitRole = null,
  defaultCreditRole = null,
} = {}) {
  const tid = toObjectId(tenantId);
  const Journal = (await import('../../models/Journal.js')).default;
  let book = await Journal.findOne({ tenantId: tid, code });
  if (!book) {
    book = await Journal.findOne({ tenantId: tid, type, isSystem: true });
  }

  let debitId = null;
  let creditId = null;
  try {
    const { resolveRoleAccount, ensureAccountingDefaults } = await import('../accountingService.js');
    await ensureAccountingDefaults(tid, userId);
    if (defaultDebitRole) {
      const acct = await resolveRoleAccount(tid, defaultDebitRole);
      debitId = acct?._id || null;
    }
    if (defaultCreditRole) {
      const acct = await resolveRoleAccount(tid, defaultCreditRole);
      creditId = acct?._id || null;
    }
  } catch {
    // optional
  }

  if (!book) {
    book = await Journal.create({
      tenantId: tid,
      code,
      name,
      nameAr,
      type,
      sequencePrefix: sequencePrefix || code,
      active: true,
      isSystem: true,
      defaultDebitAccountId: debitId,
      defaultCreditAccountId: creditId,
      createdBy: userId || undefined,
    });
    return book;
  }

  const patch = {};
  if (!book.defaultDebitAccountId && debitId) patch.defaultDebitAccountId = debitId;
  if (!book.defaultCreditAccountId && creditId) patch.defaultCreditAccountId = creditId;
  if (Object.keys(patch).length) {
    Object.assign(book, patch);
    if (userId) book.updatedBy = userId;
    await book.save();
  }
  return book;
}

export async function listJournalBooks(tenantId, { type = null, activeOnly = true } = {}) {
  const tid = toObjectId(tenantId);
  await ensureDefaultStockJournal(tid);
  await ensureDefaultSalesJournal(tid);
  await ensureDefaultPurchaseJournal(tid);
  await ensureDefaultCashJournal(tid);
  await ensureDefaultBankJournal(tid);
  await ensureDefaultMiscJournal(tid);
  const Journal = (await import('../../models/Journal.js')).default;
  const filter = { tenantId: tid };
  if (type) filter.type = type;
  if (activeOnly) filter.active = { $ne: false };
  return Journal.find(filter)
    .populate('defaultDebitAccountId', 'code name nameAr')
    .populate('defaultCreditAccountId', 'code name nameAr')
    .sort({ type: 1, code: 1 })
    .lean();
}

/**
 * Throws when automated category is missing required accounts.
 */
export function assertAutomatedCategoryAccounts(bodyOrDoc, { requireStockAccounts = true } = {}) {
  const mode = bodyOrDoc?.valuationMode || 'automated';
  if (mode !== 'automated') return;
  if (!requireStockAccounts) return;
  const missing = AUTOMATED_CATEGORY_ACCOUNT_KEYS.filter((k) => !bodyOrDoc?.[k]);
  if (!missing.length) return;
  throw new InventoryValidationError(
    `Automated valuation requires: ${missing.join(', ')}`,
    'CAT_ACCOUNTS_REQUIRED',
    { details: { missing } },
  );
}

async function loadActiveAccount(tenantId, id) {
  if (!id) return null;
  return ChartOfAccount.findOne({ _id: id, tenantId, isActive: true });
}

/**
 * First non-null active account id wins, then COA code fallback(s).
 * Pure preference order helper used by tenant defaults and contextual valuation.
 */
export async function resolveAccountChain(tenantId, preferredIds = [], fallbackCodes = []) {
  const tid = toObjectId(tenantId);
  for (const id of preferredIds) {
    const acct = await loadActiveAccount(tid, id);
    if (acct) return acct;
  }
  for (const code of fallbackCodes) {
    if (!code) continue;
    const acct = await getAccountByCode(tid, code);
    if (acct) return acct;
  }
  return null;
}

export async function resolveStockAccounts(tenantId) {
  const tid = toObjectId(tenantId);
  await ensureStockAccountingAccounts(tid);
  const settings = await InvSettings.findOne({ tenantId: tid }).lean();

  const inventory = await resolveAccountChain(
    tid,
    [settings?.propertyStockValuationAccountId],
    ['1300'],
  );
  const stockInput = await resolveAccountChain(
    tid,
    [settings?.propertyStockInputAccountId],
    ['1310'],
  );
  const stockOutput = await resolveAccountChain(
    tid,
    [settings?.propertyStockOutputAccountId],
    ['1320', '5000'],
  );
  const landedCredit = await resolveAccountChain(
    tid,
    [settings?.propertyLandedCostAccountId],
    ['2200'],
  );
  const cogs = await getAccountByCode(tid, '5000');

  return { inventory, stockInput, stockOutput, landedCredit, cogs, settings };
}

/**
 * Prefill empty tenant propertyStock* / stockJournalId from COA codes + STJ.
 * Does not overwrite accounts the user already chose.
 */
export async function linkDefaultPropertyStockAccounts(tenantId, userId = null) {
  const tid = toObjectId(tenantId);
  await ensureStockAccountingAccounts(tid, userId);
  const settings = await InvSettings.findOne({ tenantId: tid });
  if (!settings) return null;

  const resolved = await resolveStockAccounts(tid);
  let dirty = false;
  if (!settings.propertyStockValuationAccountId && resolved.inventory?._id) {
    settings.propertyStockValuationAccountId = resolved.inventory._id;
    dirty = true;
  }
  if (!settings.propertyStockInputAccountId && resolved.stockInput?._id) {
    settings.propertyStockInputAccountId = resolved.stockInput._id;
    dirty = true;
  }
  if (!settings.propertyStockOutputAccountId && resolved.stockOutput?._id) {
    settings.propertyStockOutputAccountId = resolved.stockOutput._id;
    dirty = true;
  }
  if (!settings.propertyLandedCostAccountId && resolved.landedCredit?._id) {
    settings.propertyLandedCostAccountId = resolved.landedCredit._id;
    dirty = true;
  }
  if (!settings.stockJournalId) {
    const book = await ensureDefaultStockJournal(tid, userId);
    if (book?._id) {
      settings.stockJournalId = book._id;
      dirty = true;
    }
  }
  if (dirty) {
    if (userId) settings.updatedBy = userId;
    await settings.save();
  }
  return settings;
}

/**
 * Ordered preferred account ids for a stock role.
 * Preference: product override → category → location → inventory settings.
 * Pure helper (no DB) so unit tests can assert the resolution order.
 *
 * @param {'inventory'|'stockInput'|'stockOutput'} role
 * @param {{ product?: object|null, category?: object|null, location?: object|null, settings?: object|null }} ctx
 */
export function preferredStockAccountIds(role, {
  product = null,
  category = null,
  location = null,
  settings = null,
} = {}) {
  if (role === 'inventory') {
    return [
      product?.stockValuationAccountId,
      category?.stockValuationAccountId,
      location?.stockValuationAccountId,
      settings?.propertyStockValuationAccountId,
    ];
  }
  if (role === 'stockInput') {
    return [
      product?.stockInputAccountId,
      category?.stockInputAccountId,
      location?.stockInputAccountId,
      settings?.propertyStockInputAccountId,
    ];
  }
  // Outgoing / scrap: output accounts, then expense accounts, then settings
  return [
    product?.stockOutputAccountId,
    product?.expenseAccountId,
    category?.stockOutputAccountId,
    category?.expenseAccountId,
    location?.stockOutputAccountId,
    settings?.propertyStockOutputAccountId,
  ];
}

/**
 * Contextual valuation accounts.
 * Preference: product override → category → location → inventory settings → COA fallback.
 *
 * @param {object} opts
 * @param {string|import('mongoose').Types.ObjectId} [opts.productId]
 * @param {string|import('mongoose').Types.ObjectId} [opts.locationId] — dest for in, source for out
 * @param {'in'|'out'} [opts.direction]
 */
export async function resolveValuationAccounts(tenantId, {
  productId = null,
  locationId = null,
  direction = 'in',
} = {}) {
  const tid = toObjectId(tenantId);
  await ensureStockAccountingAccounts(tid);

  const settings = await InvSettings.findOne({ tenantId: tid }).lean();
  let product = null;
  let category = null;
  let location = null;

  if (productId) {
    const Product = (await import('../../models/Product.js')).default;
    product = await Product.findOne({ _id: productId, tenantId: tid })
      .select('categoryId expenseAccountId incomeAccountId stockValuationAccountId stockInputAccountId stockOutputAccountId')
      .lean();
    if (product?.categoryId) {
      const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
      category = await InvProductCategory.findOne({ _id: product.categoryId, tenantId: tid })
        .select('stockValuationAccountId stockInputAccountId stockOutputAccountId expenseAccountId incomeAccountId valuationMode stockJournalId')
        .lean();
    }
  }

  if (locationId) {
    const InvLocation = (await import('../../models/inventory/InvLocation.js')).default;
    location = await InvLocation.findOne({ _id: locationId, tenantId: tid })
      .select('stockValuationAccountId stockInputAccountId stockOutputAccountId usage isScrapLocation')
      .lean();
  }

  const ctx = { product, category, location, settings };

  const inventory = await resolveAccountChain(tid, preferredStockAccountIds('inventory', ctx), ['1300']);
  const stockInput = await resolveAccountChain(tid, preferredStockAccountIds('stockInput', ctx), ['1310']);
  const stockOutput = await resolveAccountChain(tid, preferredStockAccountIds('stockOutput', ctx), ['1320', '5000']);

  const landedCredit = await resolveAccountChain(
    tid,
    [settings?.propertyLandedCostAccountId],
    ['2200'],
  );
  const cogs = await getAccountByCode(tid, '5000');

  return {
    inventory,
    stockInput,
    stockOutput,
    landedCredit,
    cogs,
    settings,
    sources: {
      productId: product?._id || null,
      categoryId: category?._id || null,
      locationId: location?._id || null,
      direction,
      valuationMode: category?.valuationMode || 'automated',
      stockJournalId: category?.stockJournalId || settings?.stockJournalId || null,
    },
  };
}

export async function isStockAccountingEnabled(tenantId) {
  const settings = await InvSettings.findOne({ tenantId: toObjectId(tenantId) }).lean();
  const { isStockGlOn } = await import('./accountingMode.js');
  return isStockGlOn(settings || {});
}

/**
 * Validate automated categories have all five accounts set.
 * Skipped when tenant is not on full inventory accounting (Anglo-Saxon GL).
 * Does **not** create or invent accounts — only reports gaps.
 */
export async function validateAutomatedCategoryAccounts(tenantId) {
  const tid = toObjectId(tenantId);
  const settings = await InvSettings.findOne({ tenantId: tid }).lean();
  const { isStockGlOn } = await import('./accountingMode.js');
  if (!isStockGlOn(settings || {})) {
    return {
      ok: true,
      skipped: true,
      reason: 'full_accounting_disabled',
      automatedCount: 0,
      gapCount: 0,
      gaps: [],
      requiredKeys: AUTOMATED_CATEGORY_ACCOUNT_KEYS,
    };
  }
  const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
  const cats = await InvProductCategory.find({
    tenantId: tid,
    valuationMode: 'automated',
  }).select('name completePath valuationMode stockValuationAccountId stockInputAccountId stockOutputAccountId stockJournalId expenseAccountId incomeAccountId').lean();

  const gaps = [];
  for (const cat of cats) {
    const missing = AUTOMATED_CATEGORY_ACCOUNT_KEYS.filter((k) => !cat[k]);
    if (missing.length) {
      gaps.push({
        categoryId: cat._id,
        name: cat.name,
        completePath: cat.completePath,
        missing,
      });
    }
  }

  return {
    ok: gaps.length === 0,
    automatedCount: cats.length,
    gapCount: gaps.length,
    gaps,
    requiredKeys: AUTOMATED_CATEGORY_ACCOUNT_KEYS,
  };
}

export function buildValuationJournalLines({
  direction,
  amount,
  inventory,
  stockInput,
  stockOutput,
  description = '',
}) {
  const amt = round2(Math.abs(Number(amount) || 0));
  if (amt <= 0 || !inventory) return [];

  if (direction === 'in') {
    const creditAcct = stockInput || inventory;
    return [
      {
        accountId: inventory._id,
        accountCode: inventory.code,
        debit: amt,
        credit: 0,
        description: description || 'Stock receipt valuation',
      },
      {
        accountId: creditAcct._id,
        accountCode: creditAcct.code,
        debit: 0,
        credit: amt,
        description: description || 'Stock interim received',
      },
    ];
  }

  const debitAcct = stockOutput;
  if (!debitAcct) return [];
  return [
    {
      accountId: debitAcct._id,
      accountCode: debitAcct.code,
      debit: amt,
      credit: 0,
      description: description || 'Stock delivery COGS',
    },
    {
      accountId: inventory._id,
      accountCode: inventory.code,
      debit: 0,
      credit: amt,
      description: description || 'Stock delivery valuation',
    },
  ];
}

export function buildLandedCostJournalLines({
  amount,
  inventory,
  landedCredit,
  description = '',
}) {
  const amt = round2(Math.abs(Number(amount) || 0));
  if (amt <= 0 || !inventory || !landedCredit) return [];
  return [
    {
      accountId: inventory._id,
      accountCode: inventory.code,
      debit: amt,
      credit: 0,
      description: description || 'Landed cost to inventory',
    },
    {
      accountId: landedCredit._id,
      accountCode: landedCredit.code,
      debit: 0,
      credit: amt,
      description: description || 'Landed cost accrued',
    },
  ];
}

/**
 * Multi-product landed cost: debit each inventory account (merged by id), credit landed once.
 * @param {{ amount: number, inventory: { _id: any, code?: string } }[]} segments
 */
export function buildMultiLandedCostJournalLines({
  segments = [],
  landedCredit,
  description = '',
}) {
  if (!landedCredit || !segments.length) return [];

  const byAcct = new Map();
  for (const seg of segments) {
    const amt = round2(Math.abs(Number(seg.amount) || 0));
    if (amt <= 0 || !seg.inventory?._id) continue;
    const key = String(seg.inventory._id);
    const prev = byAcct.get(key);
    if (prev) prev.debit = round2(prev.debit + amt);
    else {
      byAcct.set(key, {
        accountId: seg.inventory._id,
        accountCode: seg.inventory.code,
        debit: amt,
        credit: 0,
        description: description || 'Landed cost to inventory',
      });
    }
  }

  const debitLines = [...byAcct.values()];
  const total = round2(debitLines.reduce((s, l) => s + l.debit, 0));
  if (total <= 0) return [];

  return [
    ...debitLines,
    {
      accountId: landedCredit._id,
      accountCode: landedCredit.code,
      debit: 0,
      credit: total,
      description: description || 'Landed cost accrued',
    },
  ];
}

export function buildPurchaseBillClearingLines({
  netAmount,
  taxAmount = 0,
  stockInput,
  inventory,
  ap,
  vatInput,
  useInterim = true,
  description = '',
  /** Optional per-account goods/expense debits (should sum with priceDiff to net). */
  goodsDebits = null,
  /**
   * Price difference lines: positive amount = debit (bill > expected),
   * negative amount = credit (bill < expected).
   */
  priceDiffLines = null,
  paymentSchedule = null,
  partnerId = null,
}) {
  const net = round2(Math.abs(Number(netAmount) || 0));
  const tax = round2(Math.max(0, Number(taxAmount) || 0));
  const gross = round2(net + tax);
  if (gross <= 0 || !ap) return [];

  const lines = [];

  const pushDebit = (account, amount, desc) => {
    const amt = round2(Math.abs(Number(amount) || 0));
    if (amt <= 0 || !account?._id) return;
    const key = `d:${String(account._id)}:${desc || ''}`;
    const prev = lines.find((l) => l._mergeKey === key);
    if (prev) prev.debit = round2(prev.debit + amt);
    else {
      lines.push({
        _mergeKey: key,
        accountId: account._id,
        accountCode: account.code,
        debit: amt,
        credit: 0,
        description: desc || description || 'Clear stock interim / inventory',
      });
    }
  };

  const pushCredit = (account, amount, desc) => {
    const amt = round2(Math.abs(Number(amount) || 0));
    if (amt <= 0 || !account?._id) return;
    const key = `c:${String(account._id)}:${desc || ''}`;
    const prev = lines.find((l) => l._mergeKey === key);
    if (prev) prev.credit = round2(prev.credit + amt);
    else {
      lines.push({
        _mergeKey: key,
        accountId: account._id,
        accountCode: account.code,
        debit: 0,
        credit: amt,
        description: desc || description || 'Price difference',
      });
    }
  };

  if (Array.isArray(goodsDebits) && goodsDebits.length) {
    for (const g of goodsDebits) {
      pushDebit(g.account, g.amount, g.description || description || 'Clear stock interim / inventory');
    }
  } else {
    const goodsAcct = useInterim && stockInput ? stockInput : inventory;
    if (!goodsAcct) return [];
    pushDebit(goodsAcct, net, description || 'Clear stock interim / inventory');
  }

  if (Array.isArray(priceDiffLines)) {
    for (const p of priceDiffLines) {
      const amt = round2(Number(p.amount) || 0);
      if (!p.account?._id || amt === 0) continue;
      if (amt > 0) {
        pushDebit(p.account, amt, p.description || description || 'Purchase price difference');
      } else {
        pushCredit(p.account, amt, p.description || description || 'Purchase price difference');
      }
    }
  }

  if (!lines.length) return [];

  // Strip merge keys before return
  for (const l of lines) delete l._mergeKey;

  if (tax > 0 && vatInput) {
    lines.push({
      accountId: vatInput._id,
      accountCode: vatInput.code,
      debit: tax,
      credit: 0,
      description: description || 'VAT input',
    });
  } else if (tax > 0) {
    const firstDebit = lines.find((l) => l.debit > 0);
    if (firstDebit) firstDebit.debit = round2(firstDebit.debit + tax);
  }

  const apCredits = buildPayableCreditLines({
    ap,
    gross,
    paymentSchedule,
    description: description || 'Accounts payable',
    partnerId,
  });
  for (const apLine of apCredits) {
    lines.push({
      accountId: apLine.accountId,
      accountCode: apLine.accountCode,
      debit: apLine.debit,
      credit: apLine.credit,
      description: apLine.description,
      partnerId: apLine.partnerId,
      dueDate: apLine.dueDate,
      trancheSequence: apLine.trancheSequence,
    });
  }
  return lines;
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

/**
 * Post journal for a valuation layer (idempotent). Skip when category valuation is manual.
 * Accounts resolve: product → category → location (from move) → settings → COA codes.
 *
 * @param {object} opts
 * @param {string} [opts.locationId] optional override; otherwise taken from the move
 */
export async function postValuationLayerJournal({
  tenantId,
  userId,
  layerId,
  direction,
  valuationMode = 'automated',
  locationId = null,
  productId = null,
}) {
  if (valuationMode === 'manual') return null;
  if (!(await isStockAccountingEnabled(tenantId))) return null;

  const tid = toObjectId(tenantId);
  const layer = await InvValuationLayer.findOne({ _id: layerId, tenantId: tid });
  if (!layer) return null;
  if (layer.journalEntryId) {
    return JournalEntry.findById(layer.journalEntryId);
  }

  const existing = await findExistingSourceEntry(tid, 'InvValuationLayer', layer._id);
  if (existing) {
    layer.journalEntryId = existing._id;
    await layer.save();
    return existing;
  }

  const amount = Math.abs(Number(layer.value) || 0);
  if (decIsZero(D(amount))) return null;

  let resolvedLocationId = locationId || null;
  if (!resolvedLocationId && layer.moveId) {
    const InvMove = (await import('../../models/inventory/InvMove.js')).default;
    const move = await InvMove.findOne({ _id: layer.moveId, tenantId: tid })
      .select('sourceLocationId destLocationId')
      .lean();
    if (move) {
      // Receipts value into dest; deliveries / scrap value out of source
      resolvedLocationId = direction === 'in' ? move.destLocationId : move.sourceLocationId;
    }
  }

  const accounts = await resolveValuationAccounts(tid, {
    productId: productId || layer.productId,
    locationId: resolvedLocationId,
    direction,
  });

  if (accounts.sources?.valuationMode === 'manual') return null;

  const lines = buildValuationJournalLines({
    direction,
    amount,
    inventory: accounts.inventory,
    stockInput: accounts.stockInput,
    stockOutput: accounts.stockOutput || accounts.cogs,
    description: layer.description || '',
  });
  if (lines.length < 2) return null;

  let journalId = accounts.sources?.stockJournalId || null;
  if (!journalId) {
    const book = await ensureDefaultStockJournal(tid, userId);
    journalId = book?._id || null;
  }

  const entry = await createJournalEntry({
    tenantId: tid,
    userId,
    entryDate: layer.createdAt || new Date(),
    type: 'stock',
    memo: layer.description || `Stock valuation ${direction}`,
    memoAr: direction === 'in' ? 'تقييم استلام مخزون' : 'تقييم صرف مخزون',
    reference: String(layer.moveId || layer._id),
    lines,
    sourceModel: 'InvValuationLayer',
    sourceId: layer._id,
    sourceNumber: layer.description || '',
    status: 'posted',
    journalId,
  });

  layer.journalEntryId = entry._id;
  await layer.save();
  return entry;
}

export async function postLandedCostJournal({ tenantId, userId, landedCostId }) {
  if (!(await isStockAccountingEnabled(tenantId))) return null;

  const tid = toObjectId(tenantId);
  const lc = await InvLandedCost.findOne({ _id: landedCostId, tenantId: tid });
  if (!lc || lc.state !== 'done') return null;
  if (lc.journalEntryId) {
    return JournalEntry.findById(lc.journalEntryId);
  }

  const existing = await findExistingSourceEntry(tid, 'InvLandedCost', lc._id);
  if (existing) {
    lc.journalEntryId = existing._id;
    await lc.save();
    return existing;
  }

  const adjustments = lc.valuationAdjustmentLines || [];
  const segments = [];
  for (const adj of adjustments) {
    const amt = round2(Math.abs(Number(adj.additionalCost) || 0));
    if (amt <= 0) continue;
    const accounts = await resolveValuationAccounts(tid, {
      productId: adj.productId,
      direction: 'in',
    });
    if (!accounts.inventory) continue;
    segments.push({ amount: amt, inventory: accounts.inventory });
  }
  if (!segments.length) return null;

  const defaults = await resolveStockAccounts(tid);
  const landedCredit = defaults.landedCredit || defaults.stockInput;
  const lines = buildMultiLandedCostJournalLines({
    segments,
    landedCredit,
    description: `Landed cost ${lc.name}`,
  });
  if (lines.length < 2) return null;

  const entry = await createJournalEntry({
    tenantId: tid,
    userId,
    entryDate: lc.date || new Date(),
    type: 'stock',
    memo: `Landed cost ${lc.name}`,
    memoAr: `تكلفة مرسية ${lc.name}`,
    reference: lc.name,
    lines,
    sourceModel: 'InvLandedCost',
    sourceId: lc._id,
    sourceNumber: lc.name,
    status: 'posted',
  });

  lc.journalEntryId = entry._id;
  await lc.save();
  return entry;
}

/**
 * Post vendor bill journal: clear Stock Interim / expense / price difference into AP.
 * Idempotent on Invoice sourceId.
 *
 * Goods lines: clear interim at expected PO cost when linked; bill − expected → price difference.
 * Expensable / service lines: debit product/category expense account.
 */
export async function postPurchaseInvoiceJournal({
  tenantId,
  userId,
  invoice,
  currency = 'SAR',
}) {
  if (!invoice?._id || invoice.flow !== 'purchase') return null;
  if (!(await isStockAccountingEnabled(tenantId))) return null;

  const tid = toObjectId(tenantId);
  const existing = await findExistingSourceEntry(tid, 'PurchaseInvoice', invoice._id);
  if (existing) return existing;
  const existingInv = await findExistingSourceEntry(tid, 'Invoice', invoice._id);
  if (existingInv && existingInv.type === 'stock') return existingInv;

  const tax = round2(Number(invoice.totalTax ?? invoice.taxAmount ?? 0));
  const gross = round2(Number(invoice.grandTotal || 0));
  let net = round2(Number(invoice.taxableAmount ?? (gross - tax)));
  if (round2(net + tax) !== gross) {
    net = round2(gross - tax);
  }
  if (gross <= 0) return null;

  const override = normalizeAccountingOverrideLines(invoice.accountingLines);
  if (override.balanced) {
    let journalId = null;
    try {
      const book = await ensureDefaultPurchaseJournal(tenantId, userId);
      journalId = book?._id || null;
    } catch { /* optional */ }

    const partnerId = invoice.supplierId || null;
    const entry = await createJournalEntry({
      tenantId: tid,
      userId,
      entryDate: invoice.accountingDate || invoice.issueDate || new Date(),
      type: 'stock',
      memo: `Purchase invoice ${invoice.invoiceNumber}`,
      memoAr: `فاتورة مشتريات ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      currency,
      lines: override.lines.map((l) => ({
        accountId: l.accountId,
        accountCode: l.accountCode,
        debit: l.debit,
        credit: l.credit,
        description: l.description || `Bill ${invoice.invoiceNumber || ''}`,
        partnerId,
      })),
      sourceModel: 'PurchaseInvoice',
      sourceId: invoice._id,
      sourceNumber: invoice.invoiceNumber,
      status: 'posted',
      journalId,
    });
    if (entry?._id) {
      invoice.inventory = {
        ...(invoice.inventory?.toObject?.() || invoice.inventory || {}),
        journalEntryId: entry._id,
      };
      await invoice.save();
    }
    return entry;
  }

  const useInterim = Boolean(invoice.sourcePurchaseOrderId || invoice.sourceGrnId || (invoice.sourceGrnIds || []).length);
  const defaults = await resolveStockAccounts(tid);
  const vatInput = await getAccountByCode(tid, '1400');
  const ap = await getAccountByCode(tid, '2000');

  // PO expected unit costs by product / line
  let poByProduct = new Map();
  let poByItemId = new Map();
  if (invoice.sourcePurchaseOrderId) {
    try {
      const PurchaseOrder = (await import('../../models/PurchaseOrder.js')).default;
      const po = await PurchaseOrder.findOne({ _id: invoice.sourcePurchaseOrderId, tenantId: tid })
        .select('lineItems')
        .lean();
      for (const pli of po?.lineItems || []) {
        if (pli._id) poByItemId.set(String(pli._id), pli);
        if (pli.productId) poByProduct.set(String(pli.productId), pli);
      }
    } catch {
      // ignore
    }
  }

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const Product = (await import('../../models/Product.js')).default;
  const productIds = [...new Set(lineItems.map((li) => li.productId).filter(Boolean))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, tenantId: tid })
      .select('canBeExpensed trackInventory productType expenseAccountId categoryId costPrice')
      .lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const lineNets = lineItems.map((li) => round2(Math.abs(Number(li.lineTotal) || 0)));
  const sumLines = round2(lineNets.reduce((s, n) => s + n, 0));

  const goodsDebits = [];
  const priceDiffLines = [];

  for (let i = 0; i < lineItems.length; i += 1) {
    const li = lineItems[i];
    let share = lineNets[i];
    if (sumLines > 0 && sumLines !== net) {
      share = round2((lineNets[i] / sumLines) * net);
    }
    if (share <= 0) continue;

    const product = li.productId ? productById.get(String(li.productId)) : null;
    const isService = li.productType === 'service' || product?.productType === 'service';
    const useExpensePath = isService
      || product?.trackInventory === false
      || (product?.canBeExpensed === true && product?.trackInventory !== true);

    if (useExpensePath && li.productId) {
      const expenseAcct = await resolveProductExpenseAccount(tid, li.productId, defaults.cogs);
      if (expenseAcct) {
        goodsDebits.push({
          account: expenseAcct,
          amount: share,
          description: `Expense ${li.productName || li.productId}`,
        });
        continue;
      }
    }

    // Stockable goods
    const accounts = await resolveValuationAccounts(tid, {
      productId: li.productId,
      direction: 'in',
    });
    const stockAcct = useInterim
      ? (accounts.stockInput || accounts.inventory)
      : (accounts.inventory || accounts.stockInput);
    if (!stockAcct) continue;

    const qty = Math.abs(Number(li.quantity) || 0);
    const poLine = (li.sourcePoItemId && poByItemId.get(String(li.sourcePoItemId)))
      || (li.productId && poByProduct.get(String(li.productId)))
      || null;
    const expectedUnit = poLine?.unitCost != null
      ? Number(poLine.unitCost)
      : (product?.costPrice != null ? Number(product.costPrice) : null);
    const expected = (useInterim && expectedUnit != null && qty > 0)
      ? round2(expectedUnit * qty)
      : share;
    const diff = round2(share - expected);

    goodsDebits.push({
      account: stockAcct,
      amount: expected,
      description: `Stock interim ${li.productName || ''}`.trim(),
    });

    if (diff !== 0) {
      const priceDiffAcct = await resolvePriceDifferenceAccount(tid, li.productId);
      if (priceDiffAcct) {
        priceDiffLines.push({
          account: priceDiffAcct,
          amount: diff,
          description: `Price difference ${li.productName || ''}`.trim(),
        });
      } else {
        // No price-diff account — fold delta into stock clearing
        goodsDebits[goodsDebits.length - 1].amount = round2(
          goodsDebits[goodsDebits.length - 1].amount + diff,
        );
      }
    }
  }

  // Fix rounding so goods + priceDiff debits − credits = net
  if (goodsDebits.length || priceDiffLines.length) {
    const goodsSum = round2(goodsDebits.reduce((s, g) => s + g.amount, 0));
    const diffSum = round2(priceDiffLines.reduce((s, p) => s + Number(p.amount || 0), 0));
    const allocated = round2(goodsSum + diffSum);
    const residue = round2(net - allocated);
    if (residue !== 0 && goodsDebits.length) {
      goodsDebits[goodsDebits.length - 1].amount = round2(
        goodsDebits[goodsDebits.length - 1].amount + residue,
      );
    }
  }

  const lines = buildPurchaseBillClearingLines({
    netAmount: net,
    taxAmount: tax,
    stockInput: defaults.stockInput,
    inventory: defaults.inventory,
    ap,
    vatInput,
    useInterim,
    goodsDebits: goodsDebits.length ? goodsDebits : null,
    priceDiffLines: priceDiffLines.length ? priceDiffLines : null,
    description: `Vendor bill ${invoice.invoiceNumber || ''}`,
    partnerId: invoice.supplierId || null,
    paymentSchedule: invoice.earlyPaymentDiscount?.deadline ? null : (
      invoice.paymentSchedule?.length
        ? invoice.paymentSchedule
        : (await import('../../utils/invoicePaymentTerms.js')).computePaymentSchedule(
          invoice.issueDate,
          invoice.paymentTerms,
          gross,
        ).tranches
    ),
  });
  if (lines.length < 2) return null;

  // Prefer purchase journal book when present
  let journalId = null;
  try {
    const book = await ensureDefaultPurchaseJournal(tid, userId);
    journalId = book?._id || null;
  } catch {
    // optional
  }

  return createJournalEntry({
    tenantId: tid,
    userId,
    entryDate: invoice.accountingDate || invoice.issueDate || new Date(),
    type: 'stock',
    memo: `Purchase invoice ${invoice.invoiceNumber || ''}`,
    memoAr: `فاتورة مشتريات ${invoice.invoiceNumber || ''}`,
    reference: invoice.invoiceNumber || '',
    currency,
    lines: (lines || []).map((l) => ({
      ...l,
      partnerId: l.partnerId || invoice.supplierId || null,
    })),
    sourceModel: 'PurchaseInvoice',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber || '',
    status: 'posted',
    journalId,
  });
}

/**
 * Expense account: product → category → fallback COA.
 */
export async function resolveProductExpenseAccount(tenantId, productId, fallback = null) {
  if (!productId) return fallback;
  const tid = toObjectId(tenantId);
  const Product = (await import('../../models/Product.js')).default;
  const product = await Product.findOne({ _id: productId, tenantId: tid })
    .select('expenseAccountId categoryId')
    .lean();
  if (!product) return fallback;
  const fromProduct = await loadActiveAccount(tid, product.expenseAccountId);
  if (fromProduct) return fromProduct;
  if (product.categoryId) {
    const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
    const cat = await InvProductCategory.findOne({ _id: product.categoryId, tenantId: tid })
      .select('expenseAccountId')
      .lean();
    const fromCat = await loadActiveAccount(tid, cat?.expenseAccountId);
    if (fromCat) return fromCat;
  }
  return fallback;
}

export async function resolvePriceDifferenceAccount(tenantId, productId) {
  if (!productId) return null;
  const tid = toObjectId(tenantId);
  const Product = (await import('../../models/Product.js')).default;
  const product = await Product.findOne({ _id: productId, tenantId: tid })
    .select('categoryId')
    .lean();
  if (!product?.categoryId) return null;
  const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
  const cat = await InvProductCategory.findOne({ _id: product.categoryId, tenantId: tid })
    .select('priceDifferenceAccountId')
    .lean();
  return loadActiveAccount(tid, cat?.priceDifferenceAccountId);
}
