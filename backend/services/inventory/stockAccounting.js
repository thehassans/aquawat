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

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

export async function resolveStockAccounts(tenantId) {
  const tid = toObjectId(tenantId);
  await ensureStockAccountingAccounts(tid);
  const settings = await InvSettings.findOne({ tenantId: tid }).lean();

  const byId = async (id, fallbackCode) => {
    if (id) {
      const a = await ChartOfAccount.findOne({ _id: id, tenantId: tid, isActive: true });
      if (a) return a;
    }
    return getAccountByCode(tid, fallbackCode);
  };

  const inventory = await byId(settings?.propertyStockValuationAccountId, '1300');
  const stockInput = await byId(settings?.propertyStockInputAccountId, '1310');
  const stockOutput = await byId(settings?.propertyStockOutputAccountId, '1320');
  const landedCredit = await byId(settings?.propertyLandedCostAccountId, '2200');
  const cogs = await getAccountByCode(tid, '5000');

  return { inventory, stockInput, stockOutput, landedCredit, cogs, settings };
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

export function buildPurchaseBillClearingLines({
  netAmount,
  taxAmount = 0,
  stockInput,
  inventory,
  ap,
  vatInput,
  useInterim = true,
  description = '',
}) {
  const net = round2(Math.abs(Number(netAmount) || 0));
  const tax = round2(Math.max(0, Number(taxAmount) || 0));
  const gross = round2(net + tax);
  if (gross <= 0 || !ap) return [];

  const goodsAcct = useInterim && stockInput ? stockInput : inventory;
  if (!goodsAcct) return [];

  const lines = [
    {
      accountId: goodsAcct._id,
      accountCode: goodsAcct.code,
      debit: net,
      credit: 0,
      description: description || 'Clear stock interim / inventory',
    },
  ];
  if (tax > 0 && vatInput) {
    lines.push({
      accountId: vatInput._id,
      accountCode: vatInput.code,
      debit: tax,
      credit: 0,
      description: description || 'VAT input',
    });
  } else if (tax > 0) {
    lines[0].debit = gross;
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
 */
export async function postValuationLayerJournal({
  tenantId,
  userId,
  layerId,
  direction,
  valuationMode = 'automated',
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

  const accounts = await resolveStockAccounts(tid);
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

  const total = (lc.valuationAdjustmentLines || []).reduce(
    (s, a) => s + Math.abs(Number(a.additionalCost) || 0),
    0,
  );
  if (round2(total) <= 0) return null;

  const accounts = await resolveStockAccounts(tid);
  const lines = buildLandedCostJournalLines({
    amount: total,
    inventory: accounts.inventory,
    landedCredit: accounts.landedCredit || accounts.stockInput,
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

  const accounts = await resolveStockAccounts(tid);
  const vatInput = await getAccountByCode(tid, '1400');
  const ap = await getAccountByCode(tid, '2000');

  const lines = buildPurchaseBillClearingLines({
    netAmount: net,
    taxAmount: tax,
    stockInput: accounts.stockInput,
    inventory: accounts.inventory,
    ap,
    vatInput,
    useInterim: Boolean(invoice.sourcePurchaseOrderId || invoice.sourceGrnId),
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
