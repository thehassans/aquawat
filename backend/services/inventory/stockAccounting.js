import ChartOfAccount from '../../models/ChartOfAccount.js';
import JournalEntry from '../../models/JournalEntry.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import InvLandedCost from '../../models/inventory/InvLandedCost.js';
import {
  createJournalEntry,
  ensureDefaultChartOfAccounts,
  getAccountByCode,
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
    type: 'liability',
    subtype: 'other_liability',
  },
  {
    code: '1320',
    name: 'Stock Interim (Delivered)',
    nameAr: 'مخزون وسيط — تسليم',
    type: 'expense',
    subtype: 'cogs',
  },
];

export async function ensureStockAccountingAccounts(tenantId, userId = null) {
  await ensureDefaultChartOfAccounts(tenantId, userId);
  for (const def of STOCK_ACCOUNT_DEFS) {
    const exists = await ChartOfAccount.findOne({ tenantId, code: def.code });
    if (!exists) {
      await ChartOfAccount.create({
        ...def,
        tenantId,
        isSystem: true,
        isActive: true,
        isPostable: true,
        balance: 0,
        createdBy: userId || undefined,
      });
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

export async function listJournalBooks(tenantId, { type = null, activeOnly = true } = {}) {
  const tid = toObjectId(tenantId);
  await ensureDefaultStockJournal(tid);
  const Journal = (await import('../../models/Journal.js')).default;
  const filter = { tenantId: tid };
  if (type) filter.type = type;
  if (activeOnly) filter.active = { $ne: false };
  return Journal.find(filter).sort({ type: 1, code: 1 }).lean();
}

/**
 * Throws when automated category is missing required accounts.
 */
export function assertAutomatedCategoryAccounts(bodyOrDoc) {
  const mode = bodyOrDoc?.valuationMode || 'automated';
  if (mode !== 'automated') return;
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
      stockJournalId: category?.stockJournalId || null,
    },
  };
}

/**
 * Validate automated categories have all five accounts set.
 * Does **not** create or invent accounts — only reports gaps.
 */
export async function validateAutomatedCategoryAccounts(tenantId) {
  const tid = toObjectId(tenantId);
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

export async function isStockAccountingEnabled(tenantId) {
  const settings = await InvSettings.findOne({ tenantId: toObjectId(tenantId) }).lean();
  if (!settings?.engineEnabled) return false;
  return settings.stockAccountingEnabled !== false;
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
  /** Optional per-account goods debits (already rounded, should sum to net). */
  goodsDebits = null,
}) {
  const net = round2(Math.abs(Number(netAmount) || 0));
  const tax = round2(Math.max(0, Number(taxAmount) || 0));
  const gross = round2(net + tax);
  if (gross <= 0 || !ap) return [];

  const lines = [];

  if (Array.isArray(goodsDebits) && goodsDebits.length) {
    const byAcct = new Map();
    for (const g of goodsDebits) {
      const amt = round2(Math.abs(Number(g.amount) || 0));
      if (amt <= 0 || !g.account?._id) continue;
      const key = String(g.account._id);
      const prev = byAcct.get(key);
      if (prev) prev.debit = round2(prev.debit + amt);
      else {
        byAcct.set(key, {
          accountId: g.account._id,
          accountCode: g.account.code,
          debit: amt,
          credit: 0,
          description: description || 'Clear stock interim / inventory',
        });
      }
    }
    lines.push(...byAcct.values());
  } else {
    const goodsAcct = useInterim && stockInput ? stockInput : inventory;
    if (!goodsAcct) return [];
    lines.push({
      accountId: goodsAcct._id,
      accountCode: goodsAcct.code,
      debit: net,
      credit: 0,
      description: description || 'Clear stock interim / inventory',
    });
  }

  if (!lines.length) return [];

  if (tax > 0 && vatInput) {
    lines.push({
      accountId: vatInput._id,
      accountCode: vatInput.code,
      debit: tax,
      credit: 0,
      description: description || 'VAT input',
    });
  } else if (tax > 0) {
    lines[0].debit = round2(lines[0].debit + tax);
  }
  lines.push({
    accountId: ap._id,
    accountCode: ap.code,
    debit: 0,
    credit: gross,
    description: description || 'Accounts payable',
  });
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
    journalId: accounts.sources?.stockJournalId || null,
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
 * Post vendor bill journal: clear Stock Interim Received into Accounts Payable.
 * Idempotent on Invoice sourceId.
 * Goods debits resolve per line product (product → category → settings).
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

  const useInterim = Boolean(invoice.sourcePurchaseOrderId || invoice.sourceGrnId);
  const defaults = await resolveStockAccounts(tid);
  const vatInput = await getAccountByCode(tid, '1400');
  const ap = await getAccountByCode(tid, '2000');

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const goodsLines = lineItems.filter(
    (li) => li?.productId && (li.productType == null || li.productType === 'goods'),
  );

  let goodsDebits = null;
  if (goodsLines.length) {
    const lineNets = goodsLines.map((li) => round2(Math.abs(Number(li.lineTotal) || 0)));
    const sumLines = round2(lineNets.reduce((s, n) => s + n, 0));
    goodsDebits = [];
    for (let i = 0; i < goodsLines.length; i += 1) {
      let share = lineNets[i];
      // Scale line totals to invoice taxable net when they differ (discounts / rounding)
      if (sumLines > 0 && sumLines !== net) {
        share = round2((lineNets[i] / sumLines) * net);
      }
      if (share <= 0) continue;
      const accounts = await resolveValuationAccounts(tid, {
        productId: goodsLines[i].productId,
        direction: 'in',
      });
      const account = useInterim
        ? (accounts.stockInput || accounts.inventory)
        : (accounts.inventory || accounts.stockInput);
      if (!account) continue;
      goodsDebits.push({ account, amount: share });
    }
    // Fix rounding residue on last debit so sum equals net
    if (goodsDebits.length) {
      const allocated = round2(goodsDebits.reduce((s, g) => s + g.amount, 0));
      const delta = round2(net - allocated);
      if (delta !== 0) {
        goodsDebits[goodsDebits.length - 1].amount = round2(
          goodsDebits[goodsDebits.length - 1].amount + delta,
        );
      }
    }
    if (!goodsDebits.length) goodsDebits = null;
  }

  const lines = buildPurchaseBillClearingLines({
    netAmount: net,
    taxAmount: tax,
    stockInput: defaults.stockInput,
    inventory: defaults.inventory,
    ap,
    vatInput,
    useInterim,
    goodsDebits,
    description: `Vendor bill ${invoice.invoiceNumber || ''}`,
  });
  if (lines.length < 2) return null;

  return createJournalEntry({
    tenantId: tid,
    userId,
    entryDate: invoice.issueDate || new Date(),
    type: 'stock',
    memo: `Purchase invoice ${invoice.invoiceNumber || ''}`,
    memoAr: `فاتورة مشتريات ${invoice.invoiceNumber || ''}`,
    reference: invoice.invoiceNumber || '',
    currency,
    lines,
    sourceModel: 'PurchaseInvoice',
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber || '',
    status: 'posted',
  });
}
