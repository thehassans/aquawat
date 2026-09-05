import express from 'express';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import { applyOwnerScopeToQuery, shouldScopeInvoicesToSelf, applyCustomerOwnerScope, applySupplierOwnerScope, denyCompanyWideFinanceIfScoped } from '../utils/accessScope.js';
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
  getTaxById,
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
  resolveFollowUpLevel,
  getReminderTemplate,
  setReminderTemplate,
  renderReminderTemplate,
  getReconciliationModels,
  setReconciliationModels,
  getJournalGroups,
  setJournalGroups,
  getAccountingPaymentProviders,
  setAccountingPaymentProviders,
  handleAccountingPaymentProviderWebhook,
  getBankAccountsCatalog,
  createBankAccountSetup,
  getCurrenciesCatalog,
  setCurrenciesCatalog,
  getAssetModels,
  setAssetModels,
  getDeferredModels,
  setDeferredModels,
  getAnalyticPlans,
  setAnalyticPlans,
  getAccountTags,
  setAccountTags,
  getAccountGroups,
  setAccountGroups,
  getHorizontalGroups,
  setHorizontalGroups,
  getTaxGroups,
  setTaxGroups,
  getReportDefinitions,
  setReportDefinitions,
  getBankSyncStatus,
  startBankSyncOAuth,
  disconnectBankSync,
  syncBankFeed,
  completeBankSyncOAuth,
  getProductCategoriesAccountingBridge,
  getTaxUnits,
  setTaxUnits,
  getAnalyticDistributionModels,
  setAnalyticDistributionModels,
  buildFixedAssetRegister,
  postMonthlyDepreciation,
  postMonthlyAmortization,
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
  disableAccountingFirmMode,
  listFirmClients,
  linkFirmClient,
  unlinkFirmClient,
  switchFirmClient,
  searchTenantsForFirm,
} from '../services/accountingFirmService.js';
import JournalItem from '../models/JournalItem.js';

const router = express.Router();

/** Payment gateway webhook — public, posts customer receipt on capture */
router.post('/webhooks/payment/:provider', async (req, res) => {
  try {
    const secret = req.headers['x-webhook-secret'] || req.body?.webhookSecret || '';
    const result = await handleAccountingPaymentProviderWebhook(req.params.provider, req.body, {
      webhookSecret: secret,
      headers: req.headers,
      rawBody: Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : (req.rawBody || null),
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
});

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const tenantIdOf = (req) => req.user.tenantId || req.tenantFilter?.tenantId;

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const data = await getAccountingDashboard(tenantIdOf(req), {
      ownerUser: shouldScopeInvoicesToSelf(req.user) ? req.user : null,
    });
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
    const accounts = await ChartOfAccount.find(filter).sort({ code: 1 }).lean();
    // Heal stock interim type misclassifications (1310/1320 must stay assets in 1xxx)
    try {
      const { ensureStockAccountingAccounts } = await import('../services/inventory/stockAccounting.js');
      await ensureStockAccountingAccounts(tenantId);
    } catch { /* non-fatal */ }
    // Overlay live balances from shared ledger (excludes reversed pairs)
    const { getAccountBalances } = await import('../services/ledger/balances.js');
    const live = await getAccountBalances({
      tenantId,
      accountIds: accounts.map((a) => a._id),
      activeOnly: false,
      includeReversed: false,
    });
    const byId = Object.fromEntries((live.rows || []).map((r) => [String(r.accountId), r]));
    const enriched = accounts.map((a) => {
      const row = byId[String(a._id)];
      const natural = row ? Number(row.naturalBalance) : Number(a.balance || 0);
      return {
        ...a,
        balance: natural,
        naturalBalance: natural,
        rawDebitMinusCredit: row?.rawDebitMinusCredit ?? null,
        storedBalance: Number(a.balance || 0),
      };
    });
    // Heal stored CoA drift so Cash / AR never diverge from live rebuild
    const driftedIds = enriched
      .filter((a) => Math.abs(Number(a.balance || 0) - Number(a.storedBalance || 0)) > 0.01)
      .map((a) => a._id);
    if (driftedIds.length) {
      const { syncStoredAccountBalances } = await import('../services/ledger/balances.js');
      await syncStoredAccountBalances(tenantId, { accountIds: driftedIds });
      for (const a of enriched) {
        if (driftedIds.some((id) => String(id) === String(a._id))) {
          a.storedBalance = Number(a.balance || 0);
        }
      }
    }
    res.json(enriched);
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
      tags: Array.isArray(req.body.tags) ? req.body.tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 10) : [],
      allowNegativeBalance: req.body.allowNegativeBalance === true,
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

    const allowed = ['name', 'nameAr', 'subtype', 'parentCode', 'description', 'isActive', 'isPostable', 'tags', 'allowNegativeBalance'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'tags') {
          account.tags = Array.isArray(req.body.tags)
            ? req.body.tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 10)
            : [];
        } else if (key === 'allowNegativeBalance') {
          account.allowNegativeBalance = req.body.allowNegativeBalance === true;
        } else {
          account[key] = req.body[key];
        }
      }
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
    if (req.body.negativeCashBalancePolicy !== undefined) {
      patch.negativeCashBalancePolicy = req.body.negativeCashBalancePolicy;
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
    res.status(error?.status || 400).json({ error: error.message, code: error.code });
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
      groupBy: req.query.groupBy,
      createdBy: shouldScopeInvoicesToSelf(req.user) ? req.user._id : null,
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

router.get('/reminder-template', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getReminderTemplate(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/reminder-template', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setReminderTemplate(tenantIdOf(req), req.body?.template || req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reconciliation-models', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getReconciliationModels(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/reconciliation-models', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setReconciliationModels(tenantIdOf(req), req.body?.models || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/journal-groups', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getJournalGroups(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/journal-groups', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setJournalGroups(tenantIdOf(req), req.body?.groups || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/payment-providers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAccountingPaymentProviders(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/payment-providers', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAccountingPaymentProviders(tenantIdOf(req), req.body?.providers || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-accounts', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getBankAccountsCatalog(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bank-accounts/setup', checkPermission('finance', 'create'), async (req, res) => {
  try {
    res.status(201).json(await createBankAccountSetup(tenantIdOf(req), req.user._id, req.body || {}));
  } catch (error) {
    res.status(error.status || error.statusCode || 400).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }
});

router.post('/liquidity-check', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { evaluateOutboundLiquidity } = await import('../services/accountingService.js');
    const result = await evaluateOutboundLiquidity({
      tenantId: tenantIdOf(req),
      accountId: req.body?.accountId || null,
      paymentMethod: req.body?.paymentMethod || req.body?.method || 'bank_transfer',
      amount: req.body?.amount,
      confirmNegative: req.body?.confirmNegativeCash === true || req.body?.confirmNegative === true,
    });
    res.status(result.ok ? 200 : (result.code === 'NEGATIVE_CASH_WARNING' ? 409 : 400)).json(result);
  } catch (error) {
    res.status(error.status || error.statusCode || 500).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
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

router.get('/account-groups', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getAccountGroups(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/account-groups', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setAccountGroups(tenantIdOf(req), req.body?.groups || []));
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

router.get('/tax-groups', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getTaxGroups(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tax-groups', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setTaxGroups(tenantIdOf(req), req.body?.groups || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/report-definitions', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getReportDefinitions(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/report-definitions', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await setReportDefinitions(tenantIdOf(req), req.body?.definitions || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/bank-sync/status', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getBankSyncStatus(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bank-sync/connect', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await startBankSyncOAuth(tenantIdOf(req), req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-sync/disconnect', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await disconnectBankSync(tenantIdOf(req), req.body?.provider));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-sync/sync', checkPermission('finance', 'update'), async (req, res) => {
  try {
    res.json(await syncBankFeed(tenantIdOf(req), req.user._id, req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bank-sync/oauth/callback', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await completeBankSyncOAuth(tenantIdOf(req), req.body || {}));
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
});

router.get('/product-categories-bridge', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getProductCategoriesAccountingBridge(tenantIdOf(req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    res.json(await buildFixedAssetRegister(tenantIdOf(req), { modelCode: req.query.modelCode }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/depreciation-schedule', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const { buildDepreciationSchedule } = await import('../services/accountingService.js');
    res.json(await buildDepreciationSchedule(tenantIdOf(req), {
      modelCode: req.query.modelCode,
      accountId: req.query.accountId || null,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/deferred-accounts', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const kind = req.query.kind === 'revenue' ? 'revenue' : 'expense';
    res.json(await buildDeferredAccountsReport(tenantIdOf(req), kind, {
      modelCode: req.query.modelCode,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/deferred-models', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const kind = req.query.kind === 'revenue' ? 'revenue' : 'expense';
    res.json(await getDeferredModels(tenantIdOf(req), kind));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/deferred-models', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    const kind = req.body?.kind === 'revenue' ? 'revenue' : 'expense';
    res.json(await setDeferredModels(tenantIdOf(req), kind, req.body?.models || []));
  } catch (error) {
    res.status(400).json({ error: error.message });
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

router.post('/actions/post-amortization', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await postMonthlyAmortization(tenantIdOf(req), req.user._id, {
      kind: req.body?.kind === 'revenue' ? 'revenue' : 'expense',
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
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const data = await buildTrialBalance(tenantIdOf(req), {
      asOf: req.query.asOf || null,
      from: req.query.from || null,
      to: req.query.to || null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/profit-and-loss', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const data = await buildProfitAndLoss(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
      analyticAccountId: req.query.analyticAccountId || null,
      basis: req.query.basis === 'cash' ? 'cash' : 'accrual',
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/balance-sheet', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const data = await buildBalanceSheet(tenantIdOf(req), { asOf: req.query.asOf || null });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/general-ledger/:accountId', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
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

router.get('/reports/journal-report', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const { buildJournalReport } = await import('../services/accountingService.js');
    res.json(await buildJournalReport(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
      journalId: req.query.journalId || null,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/sequence-integrity', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const { buildSequenceIntegrityReport } = await import('../services/journalBookService.js');
    res.json(await buildSequenceIntegrityReport(tenantIdOf(req), {
      year: req.query.year ? Number(req.query.year) : new Date().getFullYear(),
      journalId: req.query.journalId || null,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/journal-book-mapping', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const { buildJournalBookMappingReport } = await import('../services/journalBookService.js');
    res.json(await buildJournalBookMappingReport(tenantIdOf(req), {
      from: req.query.from,
      to: req.query.to,
      onlyMismatches: req.query.onlyMismatches !== '0',
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parties/customers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: tenantIdOf(req), isCustomer: true };
    await applyCustomerOwnerScope(filter, req.user, tenantIdOf(req));
    if (req.query.q) {
      const q = String(req.query.q).trim();
      const searchOr = [{ name: new RegExp(q, 'i') }, { nameAr: new RegExp(q, 'i') }, { nameEn: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { mobile: new RegExp(q, 'i') }];
      filter.$and = (filter.$and || []).concat([{ $or: searchOr }]);
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

// C3 — Customer invoices list (pagination / filters / sort) — proxies sell invoices
router.get('/invoices', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const Invoice = (await import('../models/Invoice.js')).default;
    const mongoose = (await import('mongoose')).default;
    const { applyInvoiceListSearch } = await import('../utils/invoiceSearch.js');

    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      transactionType,
      search,
      dateFrom,
      dateTo,
      startDate,
      endDate,
      customerId,
      productId,
      type,
      zatcaFilter,
      sortBy,
      sortDir,
    } = req.query;

    const query = { tenantId: tenantIdOf(req), flow: 'sell', invoiceType: '388' };
    applyOwnerScopeToQuery(query, req.user);
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (transactionType || type) query.transactionType = transactionType || type;
    const customerFilter = customerId && mongoose.Types.ObjectId.isValid(customerId) ? customerId : null;
    if (customerFilter) query.customerId = customerFilter;
    const productFilter = productId && mongoose.Types.ObjectId.isValid(productId) ? productId : null;
    if (productFilter) query['lineItems.productId'] = productFilter;
    const fromDate = startDate || dateFrom;
    const toDate = endDate || dateTo;
    if (fromDate || toDate) {
      query.issueDate = {};
      if (fromDate) query.issueDate.$gte = new Date(fromDate);
      if (toDate) query.issueDate.$lte = new Date(toDate);
    }
    const searchTerm = String(search || '').trim();
    if (searchTerm) {
      await applyInvoiceListSearch(query, searchTerm, tenantIdOf(req));
    }
    if (zatcaFilter === 'cleared') query['zatca.submissionStatus'] = 'cleared';
    else if (zatcaFilter === 'reported') query['zatca.submissionStatus'] = 'reported';
    else if (zatcaFilter === 'failed' || zatcaFilter === 'rejected') query['zatca.submissionStatus'] = 'rejected';
    else if (zatcaFilter === 'not_submitted') {
      query.$and = (query.$and || []).concat([{
        $or: [
          { 'zatca.submissionStatus': { $exists: false } },
          { 'zatca.submissionStatus': null },
          { 'zatca.submissionStatus': 'pending' },
          { 'zatca.submissionStatus': '' },
        ],
      }]);
    } else if (zatcaFilter === 'submitted') {
      query['zatca.submittedAt'] = { $exists: true, $ne: null };
    }

    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const sortFieldMap = {
      issueDate: 'issueDate',
      dueDate: 'dueDate',
      invoiceNumber: 'invoiceNumber',
      grandTotal: 'grandTotal',
      status: 'status',
      paymentStatus: 'paymentStatus',
    };
    const sortField = sortFieldMap[String(sortBy || '')] || 'issueDate';
    const sortDirection = String(sortDir || '').toLowerCase() === 'asc' ? 1 : -1;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .select('-zatca.signedXml -zatca.qrCodeData -travelDetails.passengers -travelDetails.segments -searchText')
        .sort({ [sortField]: sortDirection, _id: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    res.json({
      invoices,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// C2 — Accounting customer directory (balances + filters + pagination)
router.get('/customers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listAccountingCustomers } = await import('../services/customerDirectoryService.js');
    const data = await listAccountingCustomers(tenantIdOf(req), {
      search: req.query.search || req.query.q || '',
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
      order: req.query.order,
      hasOpenBalance: req.query.hasOpenBalance,
      overdueOnly: req.query.overdueOnly,
      isActive: req.query.isActive || 'all',
      city: req.query.city || '',
      ownerUser: shouldScopeInvoicesToSelf(req.user) ? req.user : null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers/check-duplicate', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { checkCustomerDuplicate } = await import('../services/customerDirectoryService.js');
    const data = await checkCustomerDuplicate(tenantIdOf(req), {
      name: req.body?.name,
      nameEn: req.body?.nameEn,
      nameAr: req.body?.nameAr,
      vatNumber: req.body?.vatNumber,
      phone: req.body?.phone || req.body?.mobile,
      excludeId: req.body?.excludeId || null,
    });
    res.json(data);
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message, code: error.code });
  }
});

router.get('/customers/duplicates', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { findCustomerDuplicateGroups } = await import('../services/sales/customerMergeService.js');
    const data = await findCustomerDuplicateGroups(tenantIdOf(req));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers/merge/preview', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { previewCustomerMerge } = await import('../services/sales/customerMergeService.js');
    const data = await previewCustomerMerge(tenantIdOf(req), {
      primaryId: req.body?.primaryId,
      secondaryIds: req.body?.secondaryIds || [],
    });
    res.json(data);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post('/customers/merge', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { mergeCustomers } = await import('../services/sales/customerMergeService.js');
    const data = await mergeCustomers(tenantIdOf(req), {
      primaryId: req.body?.primaryId,
      secondaryIds: req.body?.secondaryIds || [],
      fieldChoices: req.body?.fieldChoices || {},
      addressChoices: req.body?.addressChoices || {},
      userId: req.user?._id,
    });
    res.json(data);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error.message });
  }
});

router.get('/customers/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    if (shouldScopeInvoicesToSelf(req.user)) {
      const findQuery = { _id: req.params.id, tenantId: tenantIdOf(req) };
      await applyCustomerOwnerScope(findQuery, req.user, tenantIdOf(req));
      const allowed = await Customer.findOne(findQuery).select('_id').lean();
      if (!allowed) return res.status(404).json({ error: 'Customer not found' });
    }
    const { getAccountingCustomerDetail } = await import('../services/customerDirectoryService.js');
    const data = await getAccountingCustomerDetail(tenantIdOf(req), req.params.id, {
      ownerUser: shouldScopeInvoicesToSelf(req.user) ? req.user : null,
    });
    res.json(data);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error.message, code: error.code });
  }
});

// C2v — Accounting vendor directory (AP from getPartnerBalances / COA 2000)
router.get('/vendors', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listAccountingVendors } = await import('../services/vendorDirectoryService.js');
    const data = await listAccountingVendors(tenantIdOf(req), {
      search: req.query.search || req.query.q || '',
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
      order: req.query.order,
      hasOpenBalance: req.query.hasOpenBalance,
      overdueOnly: req.query.overdueOnly,
      isActive: req.query.isActive || 'all',
      city: req.query.city || '',
      ownerUser: shouldScopeInvoicesToSelf(req.user) ? req.user : null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vendors/check-duplicate', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { checkVendorDuplicate } = await import('../services/vendorDirectoryService.js');
    const data = await checkVendorDuplicate(tenantIdOf(req), {
      name: req.body?.name,
      nameEn: req.body?.nameEn,
      nameAr: req.body?.nameAr,
      vatNumber: req.body?.vatNumber,
      phone: req.body?.phone || req.body?.mobile,
      excludeId: req.body?.excludeId || null,
    });
    res.json(data);
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message, code: error.code });
  }
});

router.get('/vendors/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getAccountingVendorDetail } = await import('../services/vendorDirectoryService.js');
    const data = await getAccountingVendorDetail(tenantIdOf(req), req.params.id, {
      ownerUser: shouldScopeInvoicesToSelf(req.user) ? req.user : null,
    });
    res.json(data);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error.message, code: error.code });
  }
});

router.get('/parties/suppliers', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const filter = { tenantId: tenantIdOf(req), isVendor: true };
    await applySupplierOwnerScope(filter, req.user, tenantIdOf(req));
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
      asOf: req.query.asOf || null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/receivable-consistency', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const {
      assertReceivableConsistency,
      buildTrialBalance,
      buildBalanceSheet,
      buildAgedReceivables,
      getAccountingDashboard,
      syncStoredAccountBalances,
    } = await import('../services/accountingService.js');
    const { listAccountingCustomers } = await import('../services/customerDirectoryService.js');
    const tenantId = tenantIdOf(req);
    const asOf = req.query.asOf || null;

    let storedSync = null;
    if (String(req.query.repairStored || '') === '1') {
      storedSync = await syncStoredAccountBalances(tenantId);
    }

    const [core, tb, bs, aged, dash, customers] = await Promise.all([
      assertReceivableConsistency(tenantId, { asOf }),
      buildTrialBalance(tenantId, { asOf }),
      buildBalanceSheet(tenantId, { asOf }),
      buildAgedReceivables(tenantId, { asOf }),
      getAccountingDashboard(tenantId),
      listAccountingCustomers(tenantId, { limit: 1 }),
    ]);
    const tbAr = (tb.rows || []).find((r) => String(r.code) === '1200');
    const bsAr = (bs.assets || []).find((r) => String(r.code) === '1200');
    const customerReceivables = customers?.totals?.receivablesSum ?? null;
    const cashTb = round2(
      (tb.rows || [])
        .filter((r) => r.code === '1000' || r.code === '1100')
        .reduce((s, r) => s + Number(r.balance || 0), 0),
    );
    const report = {
      ...core,
      trialBalance1200: tbAr?.balance ?? null,
      balanceSheet1200: bsAr?.balance ?? null,
      agedArTotal: aged?.buckets?.total ?? null,
      dashboardAr: dash?.arBalance ?? null,
      customerDirectoryReceivables: customerReceivables,
      dashboardCash: dash?.cashBalance ?? null,
      trialCash: cashTb,
      storedSync,
      equal: {
        dashboardVsTb: Math.abs((dash?.arBalance || 0) - (tbAr?.balance || 0)) < 0.05,
        glVsTb: Math.abs((core.glAr || 0) - (tbAr?.balance || 0)) < 0.05,
        glVsBs: Math.abs((core.glAr || 0) - (bsAr?.balance || 0)) < 0.05,
        glVsAged: Math.abs((core.glAr || 0) - (aged?.buckets?.total || 0)) < 0.05,
        glVsPartners: core.ok,
        glVsCustomerDirectory: Math.abs((core.glAr || 0) - (customerReceivables || 0)) < 0.05,
        cashDashboardVsTb: Math.abs((dash?.cashBalance || 0) - cashTb) < 0.05,
      },
    };
    report.allEqual = Object.values(report.equal).every(Boolean);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/payable-consistency', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
  try {
    const {
      assertPayableConsistency,
      buildTrialBalance,
      buildBalanceSheet,
      buildAgedPayables,
      getAccountingDashboard,
      syncStoredAccountBalances,
    } = await import('../services/accountingService.js');
    const { listAccountingVendors } = await import('../services/vendorDirectoryService.js');
    const tenantId = tenantIdOf(req);
    const asOf = req.query.asOf || null;

    let storedSync = null;
    if (String(req.query.repairStored || '') === '1') {
      storedSync = await syncStoredAccountBalances(tenantId);
    }

    const [core, tb, bs, aged, dash, vendors] = await Promise.all([
      assertPayableConsistency(tenantId, { asOf }),
      buildTrialBalance(tenantId, { asOf }),
      buildBalanceSheet(tenantId, { asOf }),
      buildAgedPayables(tenantId, { asOf }),
      getAccountingDashboard(tenantId),
      listAccountingVendors(tenantId, { limit: 1 }),
    ]);
    const tbAp = (tb.rows || []).find((r) => String(r.code) === '2000');
    const bsAp = (bs.liabilities || []).find((r) => String(r.code) === '2000');
    const vendorPayables = vendors?.totals?.payablesSum ?? null;
    const report = {
      ...core,
      trialBalance2000: tbAp?.balance ?? null,
      balanceSheet2000: bsAp?.balance ?? null,
      agedApTotal: aged?.buckets?.total ?? aged?.totals?.openResidual ?? null,
      dashboardAp: dash?.apBalance ?? null,
      vendorDirectoryPayables: vendorPayables,
      storedSync,
      equal: {
        dashboardVsTb: Math.abs((dash?.apBalance || 0) - (tbAp?.balance || 0)) < 0.05,
        glVsTb: Math.abs((core.glAp || 0) - (tbAp?.balance || 0)) < 0.05,
        glVsBs: Math.abs((core.glAp || 0) - (bsAp?.balance || 0)) < 0.05,
        glVsAged: Math.abs((core.glAp || 0) - (aged?.buckets?.total || aged?.totals?.openResidual || 0)) < 0.05,
        glVsPartners: core.ok,
        glVsVendorDirectory: Math.abs((core.glAp || 0) - (vendorPayables || 0)) < 0.05,
        threeWay:
          Math.abs((vendorPayables || 0) - (tbAp?.balance || 0)) < 0.05
          && Math.abs((vendorPayables || 0) - (aged?.buckets?.total || aged?.totals?.openResidual || 0)) < 0.05,
      },
    };
    report.allEqual = Object.values(report.equal).every(Boolean);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
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
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
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

router.get('/taxes/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await getTaxById(tenantIdOf(req), req.params.id));
  } catch (error) {
    res.status(error.message === 'Tax not found' ? 404 : 500).json({ error: error.message });
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

router.get('/bank-recon/suggest', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { suggestBankMatches } = await import('../services/bankReconciliationService.js');
    if (!req.query.statementLineId) return res.status(400).json({ error: 'statementLineId required' });
    res.json(await suggestBankMatches(tenantIdOf(req), req.query.statementLineId, {
      limit: req.query.limit,
    }));
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

router.post('/bank-recon/auto-match', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { autoMatchBankStatementLines } = await import('../services/bankReconciliationService.js');
    res.json(await autoMatchBankStatementLines(tenantIdOf(req), req.user._id, req.body || {}));
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
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
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
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
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
    res.json(await buildAgedReceivables(tenantIdOf(req), {
      asOf: req.query.asOf || null,
      groupBy: req.query.groupBy || 'customer',
      createdBy: shouldScopeInvoicesToSelf(req.user) ? req.user._id : null,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/aged-ap', checkPermission('finance', 'read'), async (req, res) => {
  try {
    res.json(await buildAgedPayables(tenantIdOf(req), {
      asOf: req.query.asOf || null,
      groupBy: req.query.groupBy || 'invoice',
      createdBy: shouldScopeInvoicesToSelf(req.user) ? req.user._id : null,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/reports/tax', checkPermission('finance', 'read'), async (req, res) => {
  if (denyCompanyWideFinanceIfScoped(req, res)) return;
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

/** Batch AR payment reminders — delegates to followUpService (dryRun by default). */
router.post('/follow-up/remind', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { sendFollowUpReminders } = await import('../services/followUpService.js');
    const data = await sendFollowUpReminders({
      tenantId: tenantIdOf(req),
      userId: req.user?._id,
      invoiceIds: Array.isArray(req.body.invoiceIds) ? req.body.invoiceIds : [],
      language: req.body.language === 'en' ? 'en' : 'ar',
      channel: req.body.channel || null,
      levelId: req.body.levelId || null,
      dryRun: req.body.dryRun !== false && req.body.dryRun !== 'false',
      asOf: req.body.asOf || null,
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

/** C7 — Preview or send follow-up reminders (dryRun default true). */
router.post('/follow-ups/send', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { sendFollowUpReminders } = await import('../services/followUpService.js');
    const dryRun = req.body.dryRun !== false && req.body.dryRun !== 'false';
    const data = await sendFollowUpReminders({
      tenantId: tenantIdOf(req),
      userId: req.user?._id,
      invoiceIds: Array.isArray(req.body.invoiceIds) ? req.body.invoiceIds : [],
      language: req.body.language === 'en' ? 'en' : 'ar',
      channel: req.body.channel || null,
      levelId: req.body.levelId || null,
      dryRun,
      asOf: req.body.asOf || null,
    });
    res.json(data);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

router.get('/follow-ups/logs', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listFollowUpLogs } = await import('../services/followUpService.js');
    res.json(await listFollowUpLogs(tenantIdOf(req), {
      customerId: req.query.customerId || null,
      invoiceId: req.query.invoiceId || null,
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/follow-ups/last', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getLastFollowUpsByInvoiceIds } = await import('../services/followUpService.js');
    const ids = String(req.query.invoiceIds || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    res.json({ byInvoice: await getLastFollowUpsByInvoiceIds(tenantIdOf(req), ids) });
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

router.post('/firm/disable', checkPermission('finance', 'approve'), async (req, res) => {
  try {
    res.json(await disableAccountingFirmMode(tenantIdOf(req), req.user._id));
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

// ─── C4: Unified customer payments ───────────────────────────────────────────

router.get('/customer-payments', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listCustomerPayments } = await import('../services/customerPaymentService.js');
    const data = await listCustomerPayments(req.user.tenantId, {
      search: req.query.search || '',
      page: req.query.page,
      limit: req.query.limit,
      partnerId: req.query.partnerId || req.query.customerId || null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customer-payments/open-invoices', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getOpenCustomerInvoices } = await import('../services/customerPaymentService.js');
    const customerId = req.query.customerId || req.query.partnerId;
    if (!customerId) return res.status(400).json({ error: 'customerId required' });
    const rows = await getOpenCustomerInvoices(req.user.tenantId, customerId);
    res.json({ invoices: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customer-payments', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const { createCustomerPayment } = await import('../services/customerPaymentService.js');
    const payment = await createCustomerPayment({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      customerId: req.body.customerId || req.body.partnerId || null,
      customerName: req.body.customerName || req.body.partnerName || '',
      date: req.body.date || new Date(),
      amount: req.body.amount,
      method: req.body.method || 'bank_transfer',
      journalId: req.body.journalId || null,
      reference: req.body.reference || '',
      memo: req.body.memo || '',
      currency: req.body.currency || req.tenant?.settings?.currency || 'SAR',
      allocations: req.body.allocations || [],
      source: req.body.source || 'payments_page',
      autoAllocateOldest: !!req.body.autoAllocateOldest,
      differenceMode: req.body.differenceMode,
      differenceAccountId: req.body.differenceAccountId,
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message, code: error.code });
  }
});

router.post('/customer-payments/backfill', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { backfillCustomerPaymentsFromJournals } = await import('../services/customerPaymentService.js');
    const report = await backfillCustomerPaymentsFromJournals(req.user.tenantId, {
      dryRun: req.body?.dryRun !== false && req.query?.apply !== '1',
      limit: req.body?.limit || req.query?.limit,
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── C4: Unified vendor payments ─────────────────────────────────────────────

router.get('/vendor-payments', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listVendorPayments } = await import('../services/vendorPaymentService.js');
    const data = await listVendorPayments(req.user.tenantId, {
      search: req.query.search || '',
      page: req.query.page,
      limit: req.query.limit,
      partnerId: req.query.partnerId || req.query.vendorId || null,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vendor-payments/open-bills', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getOpenVendorBills } = await import('../services/vendorPaymentService.js');
    const vendorId = req.query.vendorId || req.query.partnerId || req.query.supplierId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId required' });
    const rows = await getOpenVendorBills(req.user.tenantId, vendorId);
    res.json({ bills: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vendor-payments', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const { createVendorPayment } = await import('../services/vendorPaymentService.js');
    const payment = await createVendorPayment({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      vendorId: req.body.vendorId || req.body.partnerId || req.body.supplierId || null,
      vendorName: req.body.vendorName || req.body.partnerName || '',
      date: req.body.date || new Date(),
      amount: req.body.amount,
      method: req.body.method || 'bank_transfer',
      journalId: req.body.journalId || null,
      reference: req.body.reference || '',
      memo: req.body.memo || '',
      currency: req.body.currency || req.tenant?.settings?.currency || 'SAR',
      allocations: req.body.allocations || [],
      source: req.body.source || 'payments_page',
      autoAllocateOldest: !!req.body.autoAllocateOldest,
      confirmNegativeCash: !!req.body.confirmNegativeCash,
      attachments: req.body.attachments || [],
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message, code: error.code });
  }
});

router.post('/vendor-payments/backfill', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { backfillVendorPaymentsFromJournals } = await import('../services/vendorPaymentService.js');
    const report = await backfillVendorPaymentsFromJournals(req.user.tenantId, {
      dryRun: req.body?.dryRun !== false && req.query?.apply !== '1',
      limit: req.body?.limit || req.query?.limit,
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Dry-run / apply: reclassify orphan PO→AP payments to Advance (1290) or reconstruct bills. */
router.post('/vendor-payments/migrate-orphans', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { migrateOrphanSupplierPayments } = await import('../services/orphanSupplierPaymentMigration.js');
    const apply = req.body?.dryRun === false || req.query?.apply === '1';
    const report = await migrateOrphanSupplierPayments(req.user.tenantId, {
      dryRun: !apply,
      strategy: req.body?.strategy || 'auto',
      userId: req.user._id,
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Vendor payment batches (CSV / bank file export) ─────────────────────────

router.get('/payment-batches', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { listPaymentBatches } = await import('../services/paymentBatchService.js');
    res.json(await listPaymentBatches(req.user.tenantId, {
      status: req.query.status || undefined,
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/payment-batches/:id', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { getPaymentBatch } = await import('../services/paymentBatchService.js');
    res.json(await getPaymentBatch(req.user.tenantId, req.params.id));
  } catch (error) {
    res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post('/payment-batches', checkPermission('finance', 'create'), async (req, res) => {
  try {
    const { createPaymentBatch } = await import('../services/paymentBatchService.js');
    const batch = await createPaymentBatch({
      tenantId: req.user.tenantId,
      userId: req.user._id,
      invoiceIds: req.body.invoiceIds || req.body.billIds || [],
      executionDate: req.body.executionDate,
      format: req.body.format || 'csv',
      notes: req.body.notes || '',
    });
    res.status(201).json(batch);
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message });
  }
});

router.post('/payment-batches/:id/export', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const { exportPaymentBatchCsv } = await import('../services/paymentBatchService.js');
    const result = await exportPaymentBatchCsv(req.user.tenantId, req.params.id);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Payment-Batch-Id', String(result.batch?._id || req.params.id));
    res.setHeader('X-Payment-Batch-Status', String(result.batch?.status || 'exported'));
    res.send(result.csv);
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message });
  }
});

router.post('/payment-batches/:id/confirm', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { confirmPaymentBatch } = await import('../services/paymentBatchService.js');
    res.json(await confirmPaymentBatch(req.user.tenantId, req.params.id, req.user._id));
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message });
  }
});

router.post('/payment-batches/:id/cancel', checkPermission('finance', 'update'), async (req, res) => {
  try {
    const { cancelPaymentBatch } = await import('../services/paymentBatchService.js');
    res.json(await cancelPaymentBatch(req.user.tenantId, req.params.id));
  } catch (error) {
    res.status(error?.status || 400).json({ error: error.message });
  }
});

export default router;
