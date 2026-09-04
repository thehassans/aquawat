import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

/**
 * Hard validation: sold products need income; tracked goods need COGS (expense);
 * purchased/expensed need expense. Category inheritance counts.
 */
export async function assertProductAccountingAccounts(tenantId, productLike = {}) {
  const tid = toObjectId(tenantId);
  const canBeSold = productLike.canBeSold !== false;
  const canBePurchased = !!productLike.canBePurchased;
  const canBeExpensed = !!productLike.canBeExpensed;
  const productType = String(productLike.productType || 'goods').toLowerCase();
  const isGoods = productType !== 'service';
  const trackInventory = productLike.trackInventory !== false && isGoods;

  let category = null;
  if (productLike.categoryId) {
    const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
    category = await InvProductCategory.findOne({ _id: productLike.categoryId, tenantId: tid })
      .select('incomeAccountId expenseAccountId stockValuationAccountId')
      .lean();
  }

  const hasIncome = !!(productLike.incomeAccountId || category?.incomeAccountId);
  const hasExpense = !!(productLike.expenseAccountId || category?.expenseAccountId);

  const missing = [];
  if (canBeSold && !hasIncome) missing.push('incomeAccountId');
  // Goods that are sold and inventory-tracked need a COGS/expense account
  if (canBeSold && trackInventory && !hasExpense) missing.push('expenseAccountId');
  if ((canBePurchased || canBeExpensed) && !hasExpense && !missing.includes('expenseAccountId')) {
    missing.push('expenseAccountId');
  }

  if (!missing.length) return;

  throw new InventoryValidationError(
    missing.includes('incomeAccountId') && missing.includes('expenseAccountId')
      ? 'Set income and COGS/expense accounts on the product or its category'
      : (missing.includes('incomeAccountId')
        ? 'Sold products require an income account on the product or category'
        : 'Goods require a COGS/expense account on the product or category'),
    'PRODUCT_ACCOUNTS_REQUIRED',
    { details: { missing } },
  );
}

async function loadActiveAccount(tenantId, id) {
  if (!id) return null;
  const ChartOfAccount = (await import('../../models/ChartOfAccount.js')).default;
  return ChartOfAccount.findOne({ _id: id, tenantId, isActive: true }).lean();
}

/**
 * Resolve income / COGS / inventory accounts: product → category → company defaults → CoA codes.
 */
export async function resolveProductGlAccounts(tenantId, productLike = {}) {
  const tid = toObjectId(tenantId);
  const {
    ensureAccountingDefaults,
    getAccountByCode,
    ACCOUNT_CODE_MAP,
  } = await import('../accountingService.js');

  let product = productLike;
  if (productLike?._id && !productLike.incomeAccountId && !productLike.expenseAccountId) {
    product = await Product.findOne({ _id: productLike._id, tenantId: tid })
      .select('incomeAccountId expenseAccountId stockValuationAccountId categoryId productType')
      .lean() || productLike;
  }

  let category = null;
  if (product?.categoryId) {
    const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
    category = await InvProductCategory.findOne({ _id: product.categoryId, tenantId: tid })
      .select('incomeAccountId expenseAccountId stockValuationAccountId')
      .lean();
  }

  const { ids: defaultIds } = await ensureAccountingDefaults(tid);

  const income = await loadActiveAccount(tid, product?.incomeAccountId)
    || await loadActiveAccount(tid, category?.incomeAccountId)
    || await loadActiveAccount(tid, defaultIds?.incomeAccountId)
    || await getAccountByCode(tid, product?.productType === 'service'
      ? ACCOUNT_CODE_MAP.services
      : ACCOUNT_CODE_MAP.sales);

  const cogs = await loadActiveAccount(tid, product?.expenseAccountId)
    || await loadActiveAccount(tid, category?.expenseAccountId)
    || await loadActiveAccount(tid, defaultIds?.cogsAccountId)
    || await getAccountByCode(tid, ACCOUNT_CODE_MAP.cogs);

  const inventory = await loadActiveAccount(tid, product?.stockValuationAccountId || product?.inventoryAccountId)
    || await loadActiveAccount(tid, category?.stockValuationAccountId)
    || await loadActiveAccount(tid, defaultIds?.inventoryAccountId)
    || await getAccountByCode(tid, ACCOUNT_CODE_MAP.inventory);

  return { income, cogs, inventory, category, defaults: defaultIds };
}

/**
 * Batch resolve income accounts for many invoice lines (pre-post / posting hot path).
 * Loads products + categories once and reuses company defaults.
 */
export async function resolveIncomeAccountsForLines(tenantId, lines = []) {
  const tid = toObjectId(tenantId);
  const list = Array.isArray(lines) ? lines : [];
  const {
    ensureAccountingDefaults,
    getAccountByCode,
    ACCOUNT_CODE_MAP,
  } = await import('../accountingService.js');

  const productIds = [...new Set(
    list.map((li) => li?.productId).filter(Boolean).map((id) => String(id)),
  )];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, tenantId: tid })
      .select('incomeAccountId expenseAccountId stockValuationAccountId categoryId productType')
      .lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const categoryIds = [...new Set(
    products.map((p) => p.categoryId).filter(Boolean).map((id) => String(id)),
  )];
  let categoryById = new Map();
  if (categoryIds.length) {
    const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
    const cats = await InvProductCategory.find({ _id: { $in: categoryIds }, tenantId: tid })
      .select('incomeAccountId expenseAccountId stockValuationAccountId')
      .lean();
    categoryById = new Map(cats.map((c) => [String(c._id), c]));
  }

  const { ids: defaultIds } = await ensureAccountingDefaults(tid);
  const accountCache = new Map();
  const loadCached = async (id) => {
    if (!id) return null;
    const key = String(id);
    if (accountCache.has(key)) return accountCache.get(key);
    const acc = await loadActiveAccount(tid, id);
    accountCache.set(key, acc);
    return acc;
  };

  const codeCache = new Map();
  const loadByCode = async (code) => {
    if (!code) return null;
    if (codeCache.has(code)) return codeCache.get(code);
    const acc = await getAccountByCode(tid, code);
    codeCache.set(code, acc);
    return acc;
  };

  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    const li = list[i] || {};
    const product = (li.productId && productById.get(String(li.productId))) || {
      incomeAccountId: li.incomeAccountId,
      categoryId: li.categoryId,
      productType: li.productType || 'goods',
    };
    const category = product?.categoryId ? categoryById.get(String(product.categoryId)) : null;
    const income = await loadCached(li.incomeAccountId)
      || await loadCached(product?.incomeAccountId)
      || await loadCached(category?.incomeAccountId)
      || await loadCached(defaultIds?.incomeAccountId)
      || await loadByCode(product?.productType === 'service'
        ? ACCOUNT_CODE_MAP.services
        : ACCOUNT_CODE_MAP.sales);
    results.push({ index: i, income, product });
  }
  return results;
}

/**
 * Fill missing product account ObjectIds from category / company defaults (mutates plain object or doc).
 */
export async function assignDefaultProductAccounts(tenantId, productLike = {}) {
  const resolved = await resolveProductGlAccounts(tenantId, productLike);
  if (!productLike.incomeAccountId && resolved.income?._id) {
    productLike.incomeAccountId = resolved.income._id;
  }
  if (!productLike.expenseAccountId && resolved.cogs?._id) {
    productLike.expenseAccountId = resolved.cogs._id;
  }
  if (!productLike.stockValuationAccountId && resolved.inventory?._id) {
    productLike.stockValuationAccountId = resolved.inventory._id;
  }
  return productLike;
}

const TIMESTAMP_SKU_RE = /^SKU-\d{10,}(-\d+)?(-\d+)?$/i;

export function isAutoGeneratedTimestampSku(sku) {
  return TIMESTAMP_SKU_RE.test(String(sku || '').trim());
}

function categorySkuPrefix(category) {
  const raw = String(category?.name || category?.completePath || 'GEN')
    .split('/')
    .pop()
    .replace(/[^A-Za-z0-9\u0600-\u06FF]+/g, ' ')
    .trim();
  const ascii = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (ascii.length >= 2) return ascii.slice(0, 3);
  // Arabic / empty → hash-ish stable prefix from path
  const hash = String(category?._id || raw || 'GEN')
    .replace(/[^a-f0-9]/gi, '')
    .slice(-3)
    .toUpperCase() || 'GEN';
  return hash.padStart(3, 'G').slice(0, 3);
}

/**
 * Readable SKU: {CATEGORY-PREFIX}-{5 digit sequence}, e.g. FRT-00042
 */
export async function nextReadableSku(tenantId, { categoryId = null, prefix: forcedPrefix = null } = {}) {
  const tid = toObjectId(tenantId);
  let prefix = String(forcedPrefix || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (!prefix && categoryId) {
    const InvProductCategory = (await import('../../models/inventory/InvProductCategory.js')).default;
    const cat = await InvProductCategory.findOne({ _id: categoryId, tenantId: tid })
      .select('name completePath')
      .lean();
    prefix = categorySkuPrefix(cat);
  }
  if (!prefix) prefix = 'GEN';

  const escape = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escape}-(\\d+)$`, 'i');
  const existing = await Product.find({
    tenantId: tid,
    sku: { $regex: `^${escape}-\\d+$`, $options: 'i' },
  }).select('sku').lean();

  let max = 0;
  for (const row of existing) {
    const m = String(row.sku || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  const next = max + 1;
  return `${prefix}-${String(next).padStart(5, '0')}`;
}

/**
 * Backfill missing income/COGS/inventory accounts (+ optional SKU rewrite).
 * dryRun=true → report only.
 */
export async function backfillProductAccounts(tenantId, {
  dryRun = true,
  rewriteTimestampSkus = false,
  productIds = null,
} = {}) {
  const tid = toObjectId(tenantId);
  const filter = { tenantId: tid, status: { $ne: 'discontinued' } };
  if (Array.isArray(productIds) && productIds.length) {
    filter._id = { $in: productIds.map((id) => toObjectId(id)).filter(Boolean) };
  }

  const products = await Product.find(filter)
    .select('sku nameEn nameAr productType categoryId incomeAccountId expenseAccountId stockValuationAccountId canBeSold trackInventory costPrice sellingPrice')
    .lean();

  const report = {
    dryRun: !!dryRun,
    scanned: products.length,
    wouldUpdate: 0,
    updated: 0,
    missingIncome: 0,
    missingCogs: 0,
    timestampSkus: 0,
    rows: [],
  };

  for (const p of products) {
    const before = {
      incomeAccountId: p.incomeAccountId || null,
      expenseAccountId: p.expenseAccountId || null,
      stockValuationAccountId: p.stockValuationAccountId || null,
      sku: p.sku,
    };
    const patch = { ...p };
    await assignDefaultProductAccounts(tid, patch);

    let newSku = null;
    if (rewriteTimestampSkus && isAutoGeneratedTimestampSku(p.sku)) {
      report.timestampSkus += 1;
      newSku = await nextReadableSku(tid, { categoryId: p.categoryId });
      patch.sku = newSku;
    }

    const changes = {};
    if (String(before.incomeAccountId || '') !== String(patch.incomeAccountId || '')) {
      changes.incomeAccountId = patch.incomeAccountId;
      if (!before.incomeAccountId) report.missingIncome += 1;
    }
    if (String(before.expenseAccountId || '') !== String(patch.expenseAccountId || '')) {
      changes.expenseAccountId = patch.expenseAccountId;
      if (!before.expenseAccountId) report.missingCogs += 1;
    }
    if (String(before.stockValuationAccountId || '') !== String(patch.stockValuationAccountId || '')) {
      changes.stockValuationAccountId = patch.stockValuationAccountId;
    }
    if (newSku) changes.sku = newSku;

    if (!Object.keys(changes).length) continue;
    report.wouldUpdate += 1;
    report.rows.push({
      productId: String(p._id),
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      sku: p.sku,
      changes,
    });

    if (!dryRun) {
      await Product.updateOne({ _id: p._id, tenantId: tid }, { $set: changes });
      report.updated += 1;
    }
  }

  return report;
}

/**
 * Correction report: posted sales invoices whose revenue lines used company default
 * instead of a product income account (informational — does not rewrite GL).
 */
export async function reportInvoiceRevenueAccountGaps(tenantId, { limit = 50 } = {}) {
  const tid = toObjectId(tenantId);
  const Invoice = (await import('../../models/Invoice.js')).default;
  const invoices = await Invoice.find({
    tenantId: tid,
    flow: { $ne: 'purchase' },
    status: { $nin: ['draft', 'cancelled'] },
    'lineItems.0': { $exists: true },
  })
    .sort({ issueDate: -1 })
    .limit(Math.min(200, Math.max(1, Number(limit) || 50)))
    .select('invoiceNumber issueDate lineItems grandTotal')
    .lean();

  const gaps = [];
  for (const inv of invoices) {
    for (const line of inv.lineItems || []) {
      if (!line.productId) continue;
      const product = await Product.findOne({ _id: line.productId, tenantId: tid })
        .select('sku nameEn incomeAccountId expenseAccountId costPrice productType')
        .lean();
      if (!product) continue;
      const resolved = await resolveProductGlAccounts(tid, product);
      gaps.push({
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        productSku: product.sku,
        productName: product.nameEn,
        hadProductIncomeOverride: !!product.incomeAccountId,
        resolvedIncomeCode: resolved.income?.code || null,
        hadProductCogsOverride: !!product.expenseAccountId,
        resolvedCogsCode: resolved.cogs?.code || null,
        costPrice: product.costPrice,
        lineTotal: line.lineTotal,
      });
    }
  }
  return {
    scannedInvoices: invoices.length,
    lineCount: gaps.length,
    linesMissingProductIncomeOverride: gaps.filter((g) => !g.hadProductIncomeOverride).length,
    linesMissingProductCogsOverride: gaps.filter((g) => !g.hadProductCogsOverride).length,
    sample: gaps.slice(0, 40),
  };
}
