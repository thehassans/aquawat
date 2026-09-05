/**
 * Assert dashboard AR == COA 1200 == BS 1200 == customer receivables KPI == aged AR total.
 * Also asserts cash+bank is identical on dashboard vs trial balance after a reversal.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

import Partner from '../models/Partner.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import {
  createJournalEntry,
  reverseJournalEntry,
  buildTrialBalance,
  buildBalanceSheet,
  buildAgedReceivables,
  buildAgedPayables,
  getAccountingDashboard,
  syncStoredAccountBalances,
} from '../services/accountingService.js';
import { getAccountBalances, getPartnerBalances, assertReceivableConsistency, assertPayableConsistency } from '../services/ledger/balances.js';
import { listAccountingCustomers } from '../services/customerDirectoryService.js';
import { listAccountingVendors } from '../services/vendorDirectoryService.js';
import {
  resolveAccountingSkip,
  connectAccountingMongo,
  disconnectAccountingMongo,
  createAccountingTestTenant,
} from './helpers/accountingIntegrationHarness.js';

const skipReason = await resolveAccountingSkip();

describe('ledger balance consistency (five-way AR + cash)', { skip: skipReason || false }, () => {
  let tenant;
  let customer;
  let vendor;
  let cash;
  let ar;
  let ap;
  let sales;
  let expense;

  before(async () => {
    await connectAccountingMongo();
    tenant = await createAccountingTestTenant({ slugSuffix: `lb-${Date.now().toString(36)}` });
    customer = await Partner.create({
      tenantId: tenant._id,
      name: 'Consistency Customer',
      nameEn: 'Consistency Customer',
      isCustomer: true,
      isActive: true,
    });
    vendor = await Partner.create({
      tenantId: tenant._id,
      name: 'Consistency Vendor',
      nameEn: 'Consistency Vendor',
      isVendor: true,
      isCustomer: false,
      isActive: true,
    });
    const accounts = await ChartOfAccount.find({ tenantId: tenant._id }).lean();
    cash = accounts.find((a) => a.code === '1000');
    ar = accounts.find((a) => a.code === '1200');
    ap = accounts.find((a) => a.code === '2000');
    sales = accounts.find((a) => a.code === '4000');
    expense = accounts.find((a) => a.type === 'expense') || accounts.find((a) => a.code === '5000');
    assert.ok(cash && ar && sales, 'default CoA missing cash/ar/sales');
    assert.ok(ap, 'default CoA missing AP 2000');
    assert.ok(expense, 'default CoA missing expense');

    // AR debit 115 / Sales credit 115
    await createJournalEntry({
      tenantId: tenant._id,
      userId: null,
      entryDate: new Date(),
      type: 'invoice',
      memo: 'Test AR invoice',
      lines: [
        {
          accountId: ar._id,
          accountCode: '1200',
          accountName: 'Accounts Receivable',
          debit: 115,
          credit: 0,
          partnerId: customer._id,
        },
        {
          accountId: sales._id,
          accountCode: '4000',
          accountName: 'Sales',
          debit: 0,
          credit: 115,
        },
      ],
      status: 'posted',
    });

    // Cash debit 50 / AR credit 50 (partial collection)
    await createJournalEntry({
      tenantId: tenant._id,
      userId: null,
      entryDate: new Date(),
      type: 'payment',
      memo: 'Test AR receipt',
      lines: [
        {
          accountId: cash._id,
          accountCode: '1000',
          accountName: 'Cash on Hand',
          debit: 50,
          credit: 0,
        },
        {
          accountId: ar._id,
          accountCode: '1200',
          accountName: 'Accounts Receivable',
          debit: 0,
          credit: 50,
          partnerId: customer._id,
        },
      ],
      status: 'posted',
    });

    // Expense debit 133.50 / AP credit 133.50
    await createJournalEntry({
      tenantId: tenant._id,
      userId: null,
      entryDate: new Date(),
      type: 'bill',
      memo: 'Test AP bill',
      lines: [
        {
          accountId: expense._id,
          accountCode: expense.code,
          accountName: expense.name,
          debit: 133.5,
          credit: 0,
        },
        {
          accountId: ap._id,
          accountCode: '2000',
          accountName: 'Accounts Payable',
          debit: 0,
          credit: 133.5,
          partnerId: vendor._id,
        },
      ],
      status: 'posted',
    });
  });

  after(async () => {
    if (tenant?._id) {
      await Partner.deleteMany({ tenantId: tenant._id });
      await ChartOfAccount.deleteMany({ tenantId: tenant._id });
      const JournalEntry = (await import('../models/JournalEntry.js')).default;
      await JournalEntry.deleteMany({ tenantId: tenant._id });
      const Tenant = (await import('../models/Tenant.js')).default;
      await Tenant.deleteOne({ _id: tenant._id });
    }
    await disconnectAccountingMongo();
  });

  it('five AR surfaces equal: dashboard, COA, BS, customers KPI, aged AR', async () => {
    const [core, gl, tb, bs, aged, dash, customers, partners] = await Promise.all([
      assertReceivableConsistency(tenant._id),
      getAccountBalances({ tenantId: tenant._id, includeReversed: false }),
      buildTrialBalance(tenant._id),
      buildBalanceSheet(tenant._id),
      buildAgedReceivables(tenant._id),
      getAccountingDashboard(tenant._id),
      listAccountingCustomers(tenant._id, { limit: 50 }),
      getPartnerBalances({ tenantId: tenant._id, partnerType: 'customer' }),
    ]);

    const coa1200 = (gl.rows || []).find((r) => String(r.code) === '1200');
    const tb1200 = (tb.rows || []).find((r) => String(r.code) === '1200');
    const bs1200 = (bs.assets || []).find((r) => String(r.code) === '1200');

    const expected = 65; // 115 − 50
    const surfaces = {
      assertGl: core.glAr,
      assertPartners: core.partnerSum,
      coa: coa1200?.naturalBalance ?? coa1200?.balance,
      trialBalance: tb1200?.balance,
      balanceSheet: bs1200?.balance,
      dashboard: dash.arBalance,
      aged: aged?.buckets?.total,
      customersKpi: customers?.totals?.receivablesSum,
      partnerTotals: partners?.totals?.openResidual,
    };

    for (const [name, value] of Object.entries(surfaces)) {
      assert.equal(
        Math.round((Number(value) || 0) * 100) / 100,
        expected,
        `${name} should be ${expected}, got ${value}`,
      );
    }
    assert.equal(core.ok, true);
  });

  it('three-way AP: dashboard, COA 2000, vendors KPI, aged AP', async () => {
    const [core, gl, tb, aged, dash, vendors, partners] = await Promise.all([
      assertPayableConsistency(tenant._id),
      getAccountBalances({ tenantId: tenant._id, includeReversed: false }),
      buildTrialBalance(tenant._id),
      buildAgedPayables(tenant._id),
      getAccountingDashboard(tenant._id),
      listAccountingVendors(tenant._id, { limit: 50 }),
      getPartnerBalances({ tenantId: tenant._id, partnerType: 'vendor' }),
    ]);

    const coa2000 = (gl.rows || []).find((r) => String(r.code) === '2000');
    const tb2000 = (tb.rows || []).find((r) => String(r.code) === '2000');
    const expected = 133.5;

    const surfaces = {
      assertGl: core.glAp,
      assertPartners: core.partnerSum,
      coa: coa2000?.naturalBalance ?? coa2000?.balance,
      trialBalance: tb2000?.balance,
      dashboard: dash.apBalance,
      aged: aged?.buckets?.total,
      vendorsKpi: vendors?.totals?.payablesSum,
      partnerTotals: partners?.totals?.openResidual,
    };

    for (const [name, value] of Object.entries(surfaces)) {
      assert.equal(
        Math.round((Number(value) || 0) * 100) / 100,
        expected,
        `${name} should be ${expected}, got ${value}`,
      );
    }
    assert.equal(core.ok, true);
  });

  it('cash matches across CoA, TB, dashboard after reversal (excludes reversed pair)', async () => {
    const junk = await createJournalEntry({
      tenantId: tenant._id,
      userId: null,
      entryDate: new Date(),
      type: 'manual',
      memo: 'Cash noise to reverse',
      lines: [
        {
          accountId: cash._id,
          accountCode: '1000',
          accountName: 'Cash on Hand',
          debit: 46,
          credit: 0,
        },
        {
          accountId: sales._id,
          accountCode: '4000',
          accountName: 'Sales',
          debit: 0,
          credit: 46,
        },
      ],
      status: 'posted',
    });

    await reverseJournalEntry(tenant._id, junk._id, null, 'test reverse');
    await syncStoredAccountBalances(tenant._id, { accountIds: [cash._id] });

    const [gl, tb, dash] = await Promise.all([
      getAccountBalances({ tenantId: tenant._id, accountIds: [cash._id], activeOnly: false }),
      buildTrialBalance(tenant._id),
      getAccountingDashboard(tenant._id),
    ]);

    const coaCash = gl.rows.find((r) => String(r.code) === '1000');
    const tbCash = (tb.rows || []).find((r) => String(r.code) === '1000');
    const tbBank = (tb.rows || []).find((r) => String(r.code) === '1100');
    const expectedCash = 50; // only the receipt remains

    assert.equal(Math.round((coaCash?.naturalBalance || 0) * 100) / 100, expectedCash);
    assert.equal(Math.round((tbCash?.balance || 0) * 100) / 100, expectedCash);
    assert.equal(
      Math.round(((tbCash?.balance || 0) + (tbBank?.balance || 0)) * 100) / 100,
      Math.round((dash.cashBalance || 0) * 100) / 100,
    );
    assert.equal(
      Math.round((coaCash?.storedBalance || 0) * 100) / 100,
      expectedCash,
      'stored cash should match live after sync',
    );
  });
});
