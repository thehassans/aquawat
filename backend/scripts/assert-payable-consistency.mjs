/**
 * Assert AP consistency across dashboard/COA/TB/BS/vendors/aged-AP.
 *
 * Usage:
 *   node backend/scripts/assert-payable-consistency.mjs [tenantId|slug]
 *
 * Exit 0 if all equal within 0.05 SAR; else exit 1 and print deltas.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const arg = String(process.argv[2] || '').trim();

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const Tenant = (await import('../models/Tenant.js')).default;
  let tenant = null;
  if (arg) {
    if (mongoose.Types.ObjectId.isValid(arg) && String(new mongoose.Types.ObjectId(arg)) === arg) {
      tenant = await Tenant.findById(arg).select('_id name slug').lean();
    } else {
      tenant = await Tenant.findOne({ slug: arg.toLowerCase() }).select('_id name slug').lean();
    }
  } else {
    tenant = await Tenant.findOne({ isActive: true }).select('_id name slug').lean();
  }
  if (!tenant) throw new Error(`Tenant not found: ${arg || '(first active)'}`);

  const {
    assertPayableConsistency,
    buildTrialBalance,
    buildBalanceSheet,
    buildAgedPayables,
    getAccountingDashboard,
    syncStoredAccountBalances,
  } = await import('../services/accountingService.js');
  const { listAccountingVendors } = await import('../services/vendorDirectoryService.js');

  const tenantId = tenant._id;
  const storedSync = await syncStoredAccountBalances(tenantId);

  const [core, tb, bs, aged, dash, vendors] = await Promise.all([
    assertPayableConsistency(tenantId),
    buildTrialBalance(tenantId),
    buildBalanceSheet(tenantId),
    buildAgedPayables(tenantId),
    getAccountingDashboard(tenantId),
    listAccountingVendors(tenantId, { limit: 1 }),
  ]);

  const tbAp = (tb.rows || []).find((r) => String(r.code) === '2000');
  const bsAp = (bs.liabilities || []).find((r) => String(r.code) === '2000');

  const lines = {
    tenant: `${tenant.name} (${tenant.slug})`,
    glAp: core.glAp,
    storedCoa: core.account?.storedBalance ?? null,
    trialBalance2000: tbAp?.balance ?? null,
    balanceSheet2000: bsAp?.balance ?? null,
    partnerSum: core.partnerSum,
    agedApTotal: aged?.buckets?.total ?? aged?.totals?.openResidual ?? null,
    dashboardAp: dash?.apBalance ?? null,
    vendorDirectoryPayables: vendors?.totals?.payablesSum ?? null,
    storedSync,
  };

  const tol = 0.05;
  const checks = {
    'dashboard AP == TB 2000': Math.abs((lines.dashboardAp || 0) - (lines.trialBalance2000 || 0)) <= tol,
    'TB 2000 == BS 2000': Math.abs((lines.trialBalance2000 || 0) - (lines.balanceSheet2000 || 0)) <= tol,
    'TB 2000 == partner open sum': Math.abs((lines.trialBalance2000 || 0) - (lines.partnerSum || 0)) <= tol,
    'TB 2000 == aged AP total': Math.abs((lines.trialBalance2000 || 0) - (lines.agedApTotal || 0)) <= tol,
    'TB 2000 == vendors KPI': Math.abs((lines.trialBalance2000 || 0) - (lines.vendorDirectoryPayables || 0)) <= tol,
    'three-way directory==TB==aged':
      Math.abs((lines.vendorDirectoryPayables || 0) - (lines.trialBalance2000 || 0)) <= tol
      && Math.abs((lines.vendorDirectoryPayables || 0) - (lines.agedApTotal || 0)) <= tol,
  };

  console.log(JSON.stringify({ lines, checks }, null, 2));
  const ok = Object.values(checks).every(Boolean);
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
