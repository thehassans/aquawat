#!/usr/bin/env node
/**
 * Backfill AccountPayment rows from orphan InvoicePayment journals.
 *
 *   node backend/scripts/backfill-customer-payments.mjs
 *   node backend/scripts/backfill-customer-payments.mjs golden-touch
 *   node backend/scripts/backfill-customer-payments.mjs --apply golden-touch
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slug = args.find((a) => !a.startsWith('--')) || null;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const Tenant = (await import('../models/Tenant.js')).default;
  const { backfillCustomerPaymentsFromJournals } = await import('../services/customerPaymentService.js');

  const tenants = slug
    ? await Tenant.find({ $or: [{ slug }, { subdomain: slug }] }).select('_id name slug subdomain').lean()
    : await Tenant.find({}).select('_id name slug subdomain').limit(200).lean();

  if (!tenants.length) {
    console.error('No tenants found');
    process.exit(1);
  }

  console.log(apply ? 'APPLY mode' : 'DRY-RUN (pass --apply to write)');

  for (const t of tenants) {
    const label = t.slug || t.subdomain || t.name || String(t._id);
    const report = await backfillCustomerPaymentsFromJournals(t._id, {
      dryRun: !apply,
      limit: 2000,
    });
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({
      scanned: report.scanned,
      wouldCreate: report.wouldCreate,
      created: report.created,
      skippedExisting: report.skippedExisting,
      sample: report.rows.slice(0, 12),
    }, null, 2));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
