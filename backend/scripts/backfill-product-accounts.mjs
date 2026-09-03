#!/usr/bin/env node
/**
 * Backfill product income / COGS / inventory accounts (and optional readable SKUs).
 *
 * Usage:
 *   node backend/scripts/backfill-product-accounts.mjs              # dry-run all tenants
 *   node backend/scripts/backfill-product-accounts.mjs golden-touch  # dry-run one slug
 *   node backend/scripts/backfill-product-accounts.mjs --apply golden-touch
 *   node backend/scripts/backfill-product-accounts.mjs --apply --rewrite-skus
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const rewriteSkus = args.includes('--rewrite-skus');
const slug = args.find((a) => !a.startsWith('--')) || null;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const Tenant = (await import('../models/Tenant.js')).default;
  const {
    backfillProductAccounts,
    reportInvoiceRevenueAccountGaps,
  } = await import('../services/inventory/productAccounting.js');

  const tenants = slug
    ? await Tenant.find({ $or: [{ slug }, { subdomain: slug }] }).select('_id name slug subdomain').lean()
    : await Tenant.find({}).select('_id name slug subdomain').limit(200).lean();

  if (!tenants.length) {
    console.error('No tenants found');
    process.exit(1);
  }

  console.log(apply ? 'APPLY mode' : 'DRY-RUN mode (pass --apply to write)');
  if (rewriteSkus) console.log('Will rewrite timestamp SKUs → PREFIX-00001');

  for (const t of tenants) {
    const label = t.slug || t.subdomain || t.name || String(t._id);
    const report = await backfillProductAccounts(t._id, {
      dryRun: !apply,
      rewriteTimestampSkus: rewriteSkus,
    });
    const gaps = await reportInvoiceRevenueAccountGaps(t._id, { limit: 30 });
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({
      scanned: report.scanned,
      wouldUpdate: report.wouldUpdate,
      updated: report.updated,
      missingIncome: report.missingIncome,
      missingCogs: report.missingCogs,
      timestampSkus: report.timestampSkus,
      sampleChanges: report.rows.slice(0, 8),
      invoiceGapSample: {
        scannedInvoices: gaps.scannedInvoices,
        linesMissingProductIncomeOverride: gaps.linesMissingProductIncomeOverride,
        linesMissingProductCogsOverride: gaps.linesMissingProductCogsOverride,
      },
    }, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
