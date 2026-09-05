#!/usr/bin/env node
/**
 * Dry-run (default) / apply migration for orphan supplier payments
 * that debit AP without a vendor bill.
 *
 *   node backend/scripts/migrate-orphan-supplier-payments.mjs
 *   node backend/scripts/migrate-orphan-supplier-payments.mjs my-tenant-slug
 *   node backend/scripts/migrate-orphan-supplier-payments.mjs --apply my-tenant-slug
 *   node backend/scripts/migrate-orphan-supplier-payments.mjs --strategy=reclassify
 *   node backend/scripts/migrate-orphan-supplier-payments.mjs --strategy=reconstruct --apply
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const strategyArg = args.find((a) => a.startsWith('--strategy='));
const strategy = strategyArg ? strategyArg.split('=')[1] : 'auto';
const slug = args.find((a) => !a.startsWith('--')) || null;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const Tenant = (await import('../models/Tenant.js')).default;
  const { migrateOrphanSupplierPayments } = await import('../services/orphanSupplierPaymentMigration.js');

  const tenants = slug
    ? await Tenant.find({
      $or: [
        { slug },
        { subdomain: slug },
        { name: new RegExp(slug, 'i') },
      ],
    }).select('_id name slug subdomain').lean()
    : await Tenant.find({ isActive: { $ne: false } }).select('_id name slug subdomain').limit(50).lean();

  if (!tenants.length) {
    console.error(`No tenants matched: ${slug || '(all)'}`);
    process.exit(1);
  }

  console.log(apply ? 'APPLY mode' : 'DRY-RUN (pass --apply to write)');
  console.log(`Strategy: ${strategy}`);

  for (const t of tenants) {
    const label = t.slug || t.subdomain || t.name || String(t._id);
    const report = await migrateOrphanSupplierPayments(t._id, {
      dryRun: !apply,
      strategy,
      userId: null,
    });

    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({
      orphanCount: report.orphanCount,
      reconstructCount: report.reconstructCount,
      reclassifyCount: report.reclassifyCount,
      skipped: report.skipped,
      apBalanceBefore: report.apBalanceBefore,
      apBalanceAfter: report.apBalanceAfter,
      apBalanceNote: report.apBalanceNote,
      sample: (report.rows || []).slice(0, 20).map((r) => ({
        journal: r.journalNumber || r.journalEntryId,
        memo: r.memo,
        amount: r.amount,
        po: r.po?.poNumber,
        reason: r.reason,
        action: r.action,
        applied: r.applied,
        details: r.details?.preview || r.details?.would || r.details?.billNumber || r.details?.error || r.details,
      })),
    }, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
