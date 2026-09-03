/**
 * Assert AR consistency across dashboard/COA/TB/BS/customers/aged-AR.
 *
 * Usage:
 *   node backend/scripts/assert-receivable-consistency.mjs [tenantId|slug]
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
    assertReceivableConsistency,
    buildTrialBalance,
    buildBalanceSheet,
    buildAgedReceivables,
    getAccountingDashboard,
  } = await import('../services/accountingService.js');

  const tenantId = tenant._id;
  const [core, tb, bs, aged, dash] = await Promise.all([
    assertReceivableConsistency(tenantId),
    buildTrialBalance(tenantId),
    buildBalanceSheet(tenantId),
    buildAgedReceivables(tenantId),
    getAccountingDashboard(tenantId),
  ]);

  const tbAr = (tb.rows || []).find((r) => String(r.code) === '1200');
  const bsAr = (bs.assets || []).find((r) => String(r.code) === '1200');
  const cashTb = round2(
    (tb.rows || [])
      .filter((r) => r.code === '1000' || r.code === '1100')
      .reduce((s, r) => s + Number(r.balance || 0), 0),
  );

  const lines = {
    tenant: `${tenant.name} (${tenant.slug})`,
    glAr: core.glAr,
    storedCoa: core.account?.storedBalance ?? null,
    trialBalance1200: tbAr?.balance ?? null,
    balanceSheet1200: bsAr?.balance ?? null,
    partnerSum: core.partnerSum,
    agedArTotal: aged?.buckets?.total ?? null,
    dashboardAr: dash?.arBalance ?? null,
    dashboardCash: dash?.cashBalance ?? null,
    trialCash: cashTb,
  };

  const tol = 0.05;
  const checks = {
    'dashboard AR == TB 1200': Math.abs((lines.dashboardAr || 0) - (lines.trialBalance1200 || 0)) <= tol,
    'TB 1200 == BS 1200': Math.abs((lines.trialBalance1200 || 0) - (lines.balanceSheet1200 || 0)) <= tol,
    'TB 1200 == partner open sum': Math.abs((lines.trialBalance1200 || 0) - (lines.partnerSum || 0)) <= tol,
    'TB 1200 == aged AR total': Math.abs((lines.trialBalance1200 || 0) - (lines.agedArTotal || 0)) <= tol,
    'dashboard cash == TB cash+bank': Math.abs((lines.dashboardCash || 0) - (lines.trialCash || 0)) <= tol,
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
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
