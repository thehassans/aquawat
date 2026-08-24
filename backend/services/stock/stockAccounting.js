import ChartOfAccount from '../../models/ChartOfAccount.js';
import JournalEntry from '../../models/JournalEntry.js';
import StockSettings from '../../models/stock/StockSettings.js';
import StockValuationLayer from '../../models/stock/StockValuationLayer.js';
import StockLandedCost from '../../models/stock/StockLandedCost.js';
import {
  createJournalEntry,
  ensureDefaultChartOfAccounts,
  getAccountByCode,
} from '../accountingService.js';
import { D, decIsZero } from '../../utils/decimal.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Extra COA rows for real-time stock valuation (idempotent ensure). */
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
}

/**
 * Resolve inventory / interim / COGS accounts for a tenant.
 * Settings ObjectId overrides win; otherwise standard codes.
 */
export async function resolveStockAccounts(tenantId) {
  await ensureStockAccountingAccounts(tenantId);
  const settings = await StockSettings.findOne({ tenantId }).lean();

  const byId = async (id, fallbackCode) => {
    if (id) {
      const a = await ChartOfAccount.findOne({ _id: id, tenantId, isActive: true });
      if (a) return a;
    }
    return getAccountByCode(tenantId, fallbackCode);
  };

  const inventory = await byId(settings?.propertyStockValuationAccountId, '1300');
  const stockInput = await byId(settings?.propertyStockInputAccountId, '1310');
  const stockOutput = await byId(settings?.propertyStockOutputAccountId, '1320');
  const landedCredit = await byId(settings?.propertyLandedCostAccountId, '2200');
  const cogs = await getAccountByCode(tenantId, '5000');

  return { inventory, stockInput, stockOutput, landedCredit, cogs, settings };
}

export async function isStockAccountingEnabled(tenantId) {
  const settings = await StockSettings.findOne({ tenantId }).lean();
  if (!settings) return false;
  if (settings.engineEnabled !== true) return false;
  return settings.stockAccountingEnabled !== false;
}

/**
 * Pure line builder for valuation journals (testable).
 * @param {'in'|'out'} direction
 */
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

  // out: Dr Stock Output (or COGS), Cr Inventory
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
 * Post journal for a valuation layer (idempotent).
 */
export async function postValuationLayerJournal({
  tenantId,
  userId,
  layerId,
  direction,
}) {
  if (!(await isStockAccountingEnabled(tenantId))) return null;

  const layer = await StockValuationLayer.findOne({ _id: layerId, tenantId });
  if (!layer) return null;
  if (layer.journalEntryId) {
    return JournalEntry.findById(layer.journalEntryId);
  }

  const existing = await findExistingSourceEntry(tenantId, 'StockValuationLayer', layer._id);
  if (existing) {
    layer.journalEntryId = existing._id;
    await layer.save();
    return existing;
  }

  const amount = Math.abs(Number(layer.value) || 0);
  if (decIsZero(D(amount))) return null;

  const accounts = await resolveStockAccounts(tenantId);
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
    tenantId,
    userId,
    entryDate: layer.createdAt || new Date(),
    type: 'stock',
    memo: layer.description || `Stock valuation ${direction}`,
    memoAr: direction === 'in' ? 'تقييم استلام مخزون' : 'تقييم صرف مخزون',
    reference: String(layer.stockMoveId || layer._id),
    lines,
    sourceModel: 'StockValuationLayer',
    sourceId: layer._id,
    sourceNumber: layer.description || '',
    status: 'posted',
  });

  layer.journalEntryId = entry._id;
  await layer.save();
  return entry;
}

/**
 * Post one journal for a validated landed cost (sum of adjustments).
 */
export async function postLandedCostJournal({ tenantId, userId, landedCostId }) {
  if (!(await isStockAccountingEnabled(tenantId))) return null;

  const lc = await StockLandedCost.findOne({ _id: landedCostId, tenantId });
  if (!lc || lc.state !== 'done') return null;
  if (lc.journalEntryId) {
    return JournalEntry.findById(lc.journalEntryId);
  }

  const existing = await findExistingSourceEntry(tenantId, 'StockLandedCost', lc._id);
  if (existing) {
    lc.journalEntryId = existing._id;
    await lc.save();
    return existing;
  }

  const total = (lc.valuationAdjustmentLines || []).reduce(
    (s, a) => s + Math.abs(Number(a.additionalCost) || 0),
    0,
  );
  if (round2(total) <= 0) return null;

  const accounts = await resolveStockAccounts(tenantId);
  const lines = buildLandedCostJournalLines({
    amount: total,
    inventory: accounts.inventory,
    landedCredit: accounts.landedCredit || accounts.stockInput,
    description: `Landed cost ${lc.name}`,
  });
  if (lines.length < 2) return null;

  const entry = await createJournalEntry({
    tenantId,
    userId,
    entryDate: lc.date || new Date(),
    type: 'stock',
    memo: `Landed cost ${lc.name}`,
    memoAr: `تكلفة مرسية ${lc.name}`,
    reference: lc.name,
    lines,
    sourceModel: 'StockLandedCost',
    sourceId: lc._id,
    sourceNumber: lc.name,
    status: 'posted',
  });

  lc.journalEntryId = entry._id;
  await lc.save();
  return entry;
}
