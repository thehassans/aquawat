import express from 'express';
import { protect, tenantFilter, requireTenantFilter, checkPermission } from '../middleware/auth.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import JournalEntry from '../models/JournalEntry.js';
import Customer from '../models/Customer.js';
import {
  ensureDefaultChartOfAccounts,
  createJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  buildTrialBalance,
  buildProfitAndLoss,
  buildBalanceSheet,
  buildGeneralLedger,
  getAccountingDashboard,
  buildCustomerAccountReport,
  buildCustomerSummaryReport,
  buildSupplierSummaryReport,
  normaliseLines,
  assertBalanced,
} from '../services/accountingService.js';

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
    if (req.query.active !== 'false') filter.isActive = true;
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

// ─── Journal Entries ─────────────────────────────────────────────────────────
router.get('/journals', checkPermission('finance', 'read'), async (req, res) => {
  try {
    const tenantId = tenantIdOf(req);
    const filter = { tenantId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
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
    const rows = await Customer.find({ tenantId: tenantIdOf(req) })
      .select('name nameAr phone mobile')
      .sort({ name: 1 })
      .limit(500)
      .lean();
    res.json(rows);
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

export default router;
