import express from 'express';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import JournalEntry from '../models/JournalEntry.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import {
  ensureDefaultChartOfAccounts,
  createJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  reverseJournalEntry,
  getAccountingLockDates,
  setAccountingLockDates,
  listJournalItems,
  backfillJournalItems,
  getAccountingDefaults,
  setAccountingDefaults,
  ensureAccountingDefaults,
  DEFAULT_ACCOUNT_KEYS,
  listTaxes,
  createTax,
  updateTax,
  ensureDefaultTaxes,
  listAnalyticAccounts,
  createAnalyticAccount,
  updateAnalyticAccount,
  ensureDefaultAnalyticAccounts,
  buildAnalyticReport,
  closeAccountingPeriod,
  buildCashFlowStatement,
  buildAgedReceivables,
  buildAgedPayables,
  buildTaxReport,
  getJournalBoard,
  buildPartnerLedger,
  backfillJournalPartnerIds,
  buildTrialBalance,
  buildProfitAndLoss,
  buildBalanceSheet,
  buildGeneralLedger,
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
  getTaxUnits,
  setTaxUnits,
  getAnalyticDistributionModels,
  setAnalyticDistributionModels,
  buildFixedAssetRegister,
  postMonthlyDepreciation,
  getAutomaticTransfers,
  setAutomaticTransfers,
  runAutomaticTransfers,
  buildDeferredAccountsReport,
  buildCustomerAccountReport,
  buildCustomerSummaryReport,
  buildSupplierSummaryReport,
  buildSupplierAccountReport,
  normaliseLines,
  assertBalanced,
} from '../services/accountingService.js';
import {
  enableAccountingFirmMode,
  listFirmClients,
  linkFirmClient,
  unlinkFirmClient,
  switchFirmClient,
  searchTenantsForFirm,
} from '../services/accountingFirmService.js';
import JournalItem from '../models/JournalItem.js';

const router = express.Router();
router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const tenantIdOf = (req) => req.user.tenantId || req.tenantFilter?.tenantId;

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await getAccountingDashboard(tenantIdOf(req));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Chart of Accounts ───────────────────────────────────────────────────────
router.get('/accounts', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    await ensureDefaultChartOfAccounts(tenantId, req.user._id, req.tenant?.settings?.currency || 'SAR');
    const filter = { tenantId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.subtype) filter.subtype = req.query.subtype;
    if (req.query.active !== 'false') filter.isActive = true;
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [
        { code: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { nameAr: new RegExp(q, 'i') },
      ];
    }
    const accounts = await ChartOfAccount.find(filter).sort({ code: 1 });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounts/seed', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const accounts = await ensureDefaultChartOfAccounts(
      tenantIdOf(req),
      req.user._id,
      req.tenant?.settings?.currency || 'SAR',
    );
    res.json({ seeded: true, count: accounts.length, accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounts', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const code = String(req.body.code || '').trim();
    if (!code || !req.body.name || !req.body.type) {
      return res.status(400).json({ error: 'code, name, and type are required' });
    }
    const account = await ChartOfAccount.create({
      tenantId,
      code,
      name: req.body.name,
      nameAr: req.body.nameAr || '',
      type: req.body.type,
      subtype: req.body.subtype || 'other_asset',
      parentCode: req.body.parentCode || '',
      description: req.body.description || '',
      currency: req.body.currency || req.tenant?.settings?.currency || 'SAR',
      isSystem: false,
      isPostable: req.body.isPostable !== false,
      createdBy: req.user._id,
    });
    res.status(201).json(account);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Account code already exists' });
    res.status(500).json({ error: error.message });
  }
});

router.put('/accounts/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const account = await ChartOfAccount.findOne({ _id: req.params.id, tenantId: tenantIdOf(req) });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const allowed = ['name', 'nameAr', 'subtype', 'parentCode', 'description', 'isActive', 'isPostable'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) account[key] = req.body[key];
    }
    if (!account.isSystem && req.body.type) account.type = req.body.type;
    if (!account.isSystem && req.body.code) account.code = String(req.body.code).trim();

    await account.save();
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Journal books (series) — not posted entries ─────────────────────────────
router.get('/journal-books', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listJournalBooks } = await import('../services/inventory/stockAccounting.js');
    const rows = await listJournalBooks(tenantIdOf(req), {
      type: req.query.type || null,
      activeOnly: req.query.active !== 'false',
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/journal-books', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const Journal = (await import('../models/Journal.js')).default;
    const tenantId = tenantIdOf(req);
    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    if (!code || !name) return res.status(400).json({ error: 'code and name required' });
    const existing = await Journal.findOne({ tenantId, code });
    if (existing) return res.status(409).json({ error: 'Journal code already exists' });
    const book = await Journal.create({
      tenantId,
      code,
      name,
      nameAr: req.body.nameAr || '',
      type: req.body.type || 'miscellaneous',
      sequencePrefix: String(req.body.sequencePrefix || code).trim().toUpperCase(),
      active: req.body.active !== false,
      defaultDebitAccountId: req.body.defaultDebitAccountId || null,
      defaultCreditAccountId: req.body.defaultCreditAccountId || null,
      createdBy: req.user._id,
    });
    res.status(201).json(book);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/journal-books/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const Journal = (await import('../models/Journal.js')).default;
    const book = await Journal.findOne({ _id: req.params.id, tenantId: tenantIdOf(req) });
    if (!book) return res.status(404).json({ error: 'Journal book not found' });

    if (req.body.name !== undefined) book.name = String(req.body.name).trim();
    if (req.body.nameAr !== undefined) book.nameAr = String(req.body.nameAr || '').trim();
    if (req.body.type !== undefined && !book.isSystem) book.type = req.body.type;
    if (req.body.sequencePrefix !== undefined) {
      book.sequencePrefix = String(req.body.sequencePrefix || book.code).trim().toUpperCase();
    }
    if (req.body.active !== undefined) book.active = Boolean(req.body.active);
    if (req.body.defaultDebitAccountId !== undefined) {
      book.defaultDebitAccountId = req.body.defaultDebitAccountId || null;
    }
    if (req.body.defaultCreditAccountId !== undefined) {
      book.defaultCreditAccountId = req.body.defaultCreditAccountId || null;
    }
    book.updatedBy = req.user._id;
    await book.save();
    res.json(book);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Tenant default GL accounts ──────────────────────────────────────────────
router.get('/defaults', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await getAccountingDefaults(tenantIdOf(req));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/defaults', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const patch = {};
    for (const key of DEFAULT_ACCOUNT_KEYS) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    const data = await setAccountingDefaults(tenantIdOf(req), patch);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/defaults/ensure', checkPermission('finance', 'update'), async (req, res) => {
  try {
    await ensureAccountingDefaults(tenantIdOf(req), req.user._id);
    res.json(await getAccountingDefaults(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── AP payment settings (SEPA debtor + check sequence) ───────────────────────
router.get('/ap-payment-settings', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getApPaymentSettings } = await import('../services/vendorApService.js');
    res.json(await getApPaymentSettings(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/ap-payment-settings', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const { setApPaymentSettings } = await import('../services/vendorApService.js');
    res.json(await setApPaymentSettings(tenantIdOf(req), req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/ar-payment-settings', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getArPaymentSettings } = await import('../services/vendorApService.js');
    res.json(await getArPaymentSettings(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/ar-payment-settings', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const { setArPaymentSettings } = await import('../services/vendorApService.js');
    res.json(await setArPaymentSettings(tenantIdOf(req), req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/fiscal-positions', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getFiscalPositions(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/fiscal-positions', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setFiscalPositions(tenantIdOf(req), req.body?.positions || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/payment-terms', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getPaymentTermsCatalog(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/payment-terms', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setPaymentTermsCatalog(tenantIdOf(req), req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/incoterms', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getIncotermsCatalog(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/incoterms', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setIncotermsCatalog(tenantIdOf(req), req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/invoice-analysis', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildInvoiceAnalysis(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
      flow: req.query.flow,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/follow-up-levels', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getFollowUpLevels(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/follow-up-levels', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setFollowUpLevels(tenantIdOf(req), req.body?.levels || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/currencies', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getCurrenciesCatalog(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/currencies', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setCurrenciesCatalog(tenantIdOf(req), req.body?.currencies || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/asset-models', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAssetModels(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/asset-models', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAssetModels(tenantIdOf(req), req.body?.models || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/analytic-plans', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAnalyticPlans(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/analytic-plans', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAnalyticPlans(tenantIdOf(req), req.body?.plans || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/account-tags', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAccountTags(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/account-tags', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAccountTags(tenantIdOf(req), req.body?.tags || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/horizontal-groups', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getHorizontalGroups(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/horizontal-groups', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setHorizontalGroups(tenantIdOf(req), req.body?.groups || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/tax-units', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getTaxUnits(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tax-units', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setTaxUnits(tenantIdOf(req), req.body?.units || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/analytic-distribution-models', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAnalyticDistributionModels(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/analytic-distribution-models', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAnalyticDistributionModels(tenantIdOf(req), req.body?.models || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/fixed-assets', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildFixedAssetRegister(tenantIdOf(req), { modelCode: req.query.modelCode }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/deferred-accounts', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const kind = req.query.kind === 'revenue' ? 'revenue' : 'expense';
    res.json(await buildDeferredAccountsReport(tenantIdOf(req), kind));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/post-depreciation', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await postMonthlyDepreciation(tenantIdOf(req), req.user._id, {
      modelCode: req.body?.modelCode,
      asOf: req.body?.asOf || new Date(),
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/automatic-transfers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAutomaticTransfers(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/automatic-transfers', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAutomaticTransfers(tenantIdOf(req), req.body?.transfers || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/automatic-transfers/run', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await runAutomaticTransfers(tenantIdOf(req), req.user._id, {
      asOf: req.body?.asOf || new Date(),
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Journal Entries ─────────────────────────────────────────────────────────
router.get('/journals', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const filter = { tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.journalId) filter.journalId = req.query.journalId;
    if (req.query.from || req.query.to) {
      filter.entryDate = {};
      if (req.query.from) filter.entryDate.$gte = new Date(req.query.from);
      if (req.query.to) {
        const end = new Date(req.query.to);
        end.setHours(23, 59, 59, 999);
        filter.entryDate.$lte = end;
      }
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [
        { entryNumber: new RegExp(q, 'i') },
        { memo: new RegExp(q, 'i') },
        { reference: new RegExp(q, 'i') },
        { sourceNumber: new RegExp(q, 'i') },
      ];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      JournalEntry.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      JournalEntry.countDocuments(filter),
    ]);

    res.json({ rows, total, page, limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/journals/board', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getJournalBoard(tenantIdOf(req), {
      journalId: req.query.journalId || null,
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/journals/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({ _id: req.params.id, tenantId: tenantIdOf(req) });
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/journals', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const entry = await createJournalEntry({
      tenantId: tenantIdOf(req),
      userId: req.user._id,
      entryDate: req.body.entryDate || new Date(),
      type: req.body.type || 'manual',
      memo: req.body.memo || '',
      memoAr: req.body.memoAr || '',
      reference: req.body.reference || '',
      currency: req.body.currency || req.tenant?.settings?.currency || 'SAR',
      lines: req.body.lines || [],
      status: req.body.status === 'posted' ? 'posted' : 'draft',
      journalId: req.body.journalId || null,
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/journals/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({ _id: req.params.id, tenantId: tenantIdOf(req) });
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    if (entry.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft journals can be edited' });
    }

    if (req.body.entryDate) entry.entryDate = new Date(req.body.entryDate);
    if (req.body.memo !== undefined) entry.memo = req.body.memo;
    if (req.body.memoAr !== undefined) entry.memoAr = req.body.memoAr;
    if (req.body.reference !== undefined) entry.reference = req.body.reference;
    if (req.body.lines) {
      const lines = normaliseLines(req.body.lines);
      assertBalanced(lines);
      // Enrich
      const enriched = [];
      for (const line of lines) {
        const account = await ChartOfAccount.findOne({ _id: line.accountId, tenantId: tenantIdOf(req) });
        if (!account) return res.status(400).json({ error: `Account not found for line` });
        enriched.push({ ...line, accountCode: account.code, accountName: account.name });
      }
      entry.lines = enriched;
    }
    await entry.save();
    await JournalItem.deleteMany({ tenantId: tenantIdOf(req), moveId: entry._id });
    const docs = (entry.lines || []).map((line, lineIndex) => ({
      tenantId: entry.tenantId,
      moveId: entry._id,
      journalId: entry.journalId || null,
      entryNumber: entry.entryNumber || '',
      entryDate: entry.entryDate,
      accountId: line.accountId,
      accountCode: line.accountCode || '',
      accountName: line.accountName || '',
      partnerId: line.partnerId || null,
      description: line.description || '',
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
      currency: entry.currency || 'SAR',
      state: 'draft',
      lineIndex,
    }));
    if (docs.length) await JournalItem.insertMany(docs);
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/journals/:id/post', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const entry = await postJournalEntry(tenantIdOf(req), req.params.id, req.user._id);
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Fallback: allow create+post users without approve to post their drafts
router.post('/journals/:id/post-simple', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const entry = await postJournalEntry(tenantIdOf(req), req.params.id, req.user._id);
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/journals/:id/void', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const entry = await voidJournalEntry(tenantIdOf(req), req.params.id, req.user._id, req.body.reason || '');
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** Formal reversal of a posted journal entry (preferred over void for posted moves). */
router.post('/journals/:id/reverse', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const entry = await reverseJournalEntry(
      tenantIdOf(req),
      req.params.id,
      req.user._id,
      req.body.reason || '',
    );
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Journal items (account.move.line) ───────────────────────────────────────
router.get('/journal-items', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await listJournalItems(tenantIdOf(req), {
      accountId: req.query.accountId,
      partnerId: req.query.partnerId,
      moveId: req.query.moveId,
      analyticAccountId: req.query.analyticAccountId,
      journalId: req.query.journalId,
      accountType: req.query.accountType,
      q: req.query.q,
      from: req.query.from,
      to: req.query.to,
      state: req.query.state || 'posted',
      limit: req.query.limit,
      skip: req.query.skip,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/journal-items/backfill', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const data = await backfillJournalItems(tenantIdOf(req), { limit: req.body.limit });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Accounting lock dates ───────────────────────────────────────────────────
router.get('/lock-dates', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await getAccountingLockDates(tenantIdOf(req));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/lock-dates', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const data = await setAccountingLockDates(tenantIdOf(req), {
      lockDate: req.body.lockDate,
      taxLockDate: req.body.taxLockDate,
      hardLockDate: req.body.hardLockDate,
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Reports ─────────────────────────────────────────────────────────────────
router.get('/reports/trial-balance', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildTrialBalance(tenantIdOf(req), { asOf: req.query.asOf || null });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/profit-and-loss', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildProfitAndLoss(tenantIdOf(req), { from: req.query.from, to: req.query.to });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/balance-sheet', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildBalanceSheet(tenantIdOf(req), { asOf: req.query.asOf || null });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/general-ledger/:accountId', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildGeneralLedger(tenantIdOf(req), req.params.accountId, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/parties/customers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: tenantIdOf(req), isCustomer: true };
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [{ name: new RegExp(q, 'i') }, { nameAr: new RegExp(q, 'i') }, { nameEn: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { mobile: new RegExp(q, 'i') }];
    }
    const rows = await Customer.find(filter)
      .select('name nameAr phone mobile')
      .sort({ name: 1 })
      .limit(500)
      .lean();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parties/suppliers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: tenantIdOf(req), isVendor: true };
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [
        { nameEn: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { nameAr: new RegExp(q, 'i') },
        { supplierCode: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
      ];
    }
    const rows = await Supplier.find(filter)
      .select('name nameEn nameAr supplierCode phone')
      .sort({ nameEn: 1 })
      .limit(500)
      .lean();
    res.json(rows.map((r) => ({
      ...r,
      nameEn: r.nameEn || r.name,
      code: r.supplierCode || r.code,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/customer-account', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildCustomerAccountReport(tenantIdOf(req), req.query.customerId, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/customer-summary', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildCustomerSummaryReport(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/supplier-summary', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildSupplierSummaryReport(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/supplier-account', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await buildSupplierAccountReport(tenantIdOf(req), req.query.supplierId, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** GL partner ledger from JournalItems (posted move lines tagged with partnerId). */
router.get('/reports/partner-ledger', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const partnerId = req.query.partnerId || req.query.customerId || req.query.supplierId;
    const data = await buildPartnerLedger(tenantIdOf(req), partnerId, {
      from: req.query.from,
      to: req.query.to,
      accountId: req.query.accountId || null,
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/journal-items/backfill-partners', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const data = await backfillJournalPartnerIds(tenantIdOf(req), { limit: req.body.limit });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Tax master ──────────────────────────────────────────────────────────────
router.get('/taxes', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const rows = await listTaxes(tenantIdOf(req), {
      type: req.query.type || null,
      activeOnly: req.query.active !== 'false',
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/taxes', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const tax = await createTax(tenantIdOf(req), req.user._id, req.body);
    res.status(201).json(tax);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/taxes/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const tax = await updateTax(tenantIdOf(req), req.user._id, req.params.id, req.body);
    res.json(tax);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/taxes/ensure', checkPermission('finance', 'update'), async (req, res) => {
  try {
    await ensureDefaultTaxes(tenantIdOf(req), req.user._id);
    res.json(await listTaxes(tenantIdOf(req), { activeOnly: false }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Bank reconciliation ─────────────────────────────────────────────────────
router.get('/bank-statements', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listBankStatements } = await import('../services/bankReconciliationService.js');
    res.json(await listBankStatements(tenantIdOf(req), {
      accountId: req.query.accountId || null,
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bank-statements/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getBankStatement } = await import('../services/bankReconciliationService.js');
    res.json(await getBankStatement(tenantIdOf(req), req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-statements', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const { createBankStatement } = await import('../services/bankReconciliationService.js');
    const data = await createBankStatement(tenantIdOf(req), req.user._id, req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-statements/:id/lines', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { addBankStatementLines } = await import('../services/bankReconciliationService.js');
    const data = await addBankStatementLines(tenantIdOf(req), req.params.id, req.body.lines || []);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-recon/unmatched-items', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listUnmatchedJournalItems } = await import('../services/bankReconciliationService.js');
    if (!req.query.accountId) return res.status(400).json({ error: 'accountId required' });
    res.json(await listUnmatchedJournalItems(tenantIdOf(req), req.query.accountId, {
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-recon/unmatched-outstanding', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listUnmatchedOutstandingPayments } = await import('../services/bankReconciliationService.js');
    res.json(await listUnmatchedOutstandingPayments(tenantIdOf(req), {
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-recon/unmatched-outstanding-receipts', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listUnmatchedOutstandingReceipts } = await import('../services/bankReconciliationService.js');
    res.json(await listUnmatchedOutstandingReceipts(tenantIdOf(req), {
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-recon/unmatched-lines', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listUnmatchedStatementLines } = await import('../services/bankReconciliationService.js');
    res.json(await listUnmatchedStatementLines(tenantIdOf(req), {
      statementId: req.query.statementId || null,
      accountId: req.query.accountId || null,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-recon/summary', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getReconciliationSummary } = await import('../services/bankReconciliationService.js');
    if (!req.query.accountId) return res.status(400).json({ error: 'accountId required' });
    res.json(await getReconciliationSummary(tenantIdOf(req), req.query.accountId));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-recon/match', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { matchBankReconciliation } = await import('../services/bankReconciliationService.js');
    res.json(await matchBankReconciliation(tenantIdOf(req), req.user._id, {
      statementLineId: req.body.statementLineId,
      journalItemIds: req.body.journalItemIds || [],
      outstandingJournalItemIds: req.body.outstandingJournalItemIds || [],
      outstandingReceiptJournalItemIds: req.body.outstandingReceiptJournalItemIds || [],
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-recon/unmatch', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { unmatchBankReconciliation } = await import('../services/bankReconciliationService.js');
    res.json(await unmatchBankReconciliation(tenantIdOf(req), {
      reconcileId: req.body.reconcileId || null,
      statementLineId: req.body.statementLineId || null,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Analytic accounts ───────────────────────────────────────────────────────
router.get('/analytic-accounts', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await listAnalyticAccounts(tenantIdOf(req), {
      type: req.query.type || null,
      activeOnly: req.query.active !== 'false',
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/analytic-accounts', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const row = await createAnalyticAccount(tenantIdOf(req), req.user._id, req.body);
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/analytic-accounts/:id', checkPermission('finance', 'update'), async (req, res) => {
  try {
    res.json(await updateAnalyticAccount(tenantIdOf(req), req.user._id, req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/analytic-accounts/ensure', checkPermission('finance', 'update'), async (req, res) => {
  try {
    await ensureDefaultAnalyticAccounts(tenantIdOf(req), req.user._id);
    res.json(await listAnalyticAccounts(tenantIdOf(req), { activeOnly: false }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/analytic', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildAnalyticReport(tenantIdOf(req), {
      analyticAccountId: req.query.analyticAccountId || null,
      from: req.query.from,
      to: req.query.to,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** Close P&L into retained earnings and optionally set hard lock. */
router.post('/period-close', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const data = await closeAccountingPeriod(tenantIdOf(req), req.user._id, {
      from: req.body.from,
      to: req.body.to,
      setHardLock: req.body.setHardLock !== false,
      currency: req.body.currency || req.tenant?.settings?.currency || 'SAR',
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/cash-flow', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildCashFlowStatement(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/aged-ar', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildAgedReceivables(tenantIdOf(req), { asOf: req.query.asOf || null }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/aged-ap', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildAgedPayables(tenantIdOf(req), { asOf: req.query.asOf || null }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/tax', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildTaxReport(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
      taxUnitCode: req.query.taxUnit || req.query.taxUnitCode || null,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/** Batch AR payment reminders — reuses invoice WhatsApp endpoint semantics (wa.me + optional send). */
router.post('/follow-up/remind', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const ids = Array.isArray(req.body.invoiceIds) ? req.body.invoiceIds.filter(Boolean) : [];
    if (!ids.length) throw new Error('invoiceIds required');
    const language = req.body.language === 'en' ? 'en' : 'ar';
    const Invoice = (await import('../models/Invoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;
    const Tenant = (await import('../models/Tenant.js')).default;
    const tenant = req.tenant || await Tenant.findById(tenantId);
    const invoices = await Invoice.find({
      _id: { $in: ids.slice(0, 50) },
      tenantId,
      flow: 'sell',
      status: { $nin: ['draft', 'cancelled'] },
    }).lean();

    const partnerIds = [...new Set(invoices.map((i) => String(i.customerId || '')).filter(Boolean))];
    const partners = partnerIds.length
      ? await Customer.find({ _id: { $in: partnerIds }, tenantId }).select('name nameAr phone mobile').lean()
      : [];
    const byPartner = Object.fromEntries(partners.map((p) => [String(p._id), p]));

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${tenant?.domain || 'app.maqder.com'}`;

    const results = invoices.map((invoice) => {
      const customer = invoice.customerId ? byPartner[String(invoice.customerId)] : null;
      const phone = customer?.mobile || customer?.phone || invoice?.buyer?.phone || '';
      const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
      const residual = Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0));
      const amountLabel = `${residual.toFixed(2)} ${invoice.currency || 'SAR'}`;
      const customerName = customer?.name || customer?.nameAr || invoice?.buyer?.name || 'Customer';
      const link = `${baseUrl}/app/dashboard/accounting/invoices/${invoice._id}`;
      const textEn = `Dear ${customerName}, friendly reminder: invoice ${invoice.invoiceNumber} has an outstanding balance of ${amountLabel}. View: ${link}`;
      const textAr = `عزيزي ${customerName}، تذكير ودي: الفاتورة ${invoice.invoiceNumber} عليها رصيد متبقي ${amountLabel}. العرض: ${link}`;
      const messageText = language === 'ar' ? textAr : textEn;
      const waLink = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
        : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      return {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        partnerName: customerName,
        phone: cleanPhone || null,
        residual: Math.round(residual * 100) / 100,
        waLink,
        messageText,
      };
    });

    res.json({ count: results.length, language, results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Accounting Firms Mode ───────────────────────────────────────────────────
router.get('/firm/clients', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await listFirmClients(req.user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/firm/tenants/search', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await searchTenantsForFirm(req.user, { q: req.query.q || '' }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/firm/enable', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await enableAccountingFirmMode(tenantIdOf(req), req.user._id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/firm/clients', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.status(201).json(await linkFirmClient(req.user, {
      clientTenantId: req.body.clientTenantId || req.body.tenantId,
      grantAccess: req.body.grantAccess !== false,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/firm/clients/:id', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await unlinkFirmClient(req.user, req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/firm/switch', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await switchFirmClient(req.user, req.body.tenantId || req.body.clientTenantId);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
