#!/usr/bin/env node
/**
 * Recalculate invoice dueDate from issueDate + payment terms (date-only safe).
 *
 *   node backend/scripts/repair-invoice-due-dates.mjs
 *   node backend/scripts/repair-invoice-due-dates.mjs --apply
 *   node backend/scripts/repair-invoice-due-dates.mjs --apply golden-touch
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeDueDateFromPaymentTerms,
  findPaymentTerm,
} from '../utils/invoicePaymentTerms.js';
import { compareDateOnly, extractDateOnly } from '../utils/dateOnly.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slug = args.find((a) => !a.startsWith('--')) || null;

function needsRepair(inv) {
  const issueOnly = extractDateOnly(inv.issueDate);
  const dueOnly = extractDateOnly(inv.dueDate);
  if (!issueOnly) return { repair: false, reason: 'no-issue-date' };
  if (!dueOnly) return { repair: true, reason: 'null-due' };
  if (compareDateOnly(dueOnly, issueOnly) < 0) return { repair: true, reason: 'due-before-issue' };

  const termId = String(inv.paymentTerms || '').trim();
  if (termId && findPaymentTerm(termId)) {
    const expected = extractDateOnly(computeDueDateFromPaymentTerms(inv.issueDate, termId));
    if (expected && expected !== dueOnly) return { repair: true, reason: 'mismatch-term', expected };
  }
  return { repair: false, reason: 'ok' };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const Tenant = (await import('../models/Tenant.js')).default;
  const Invoice = (await import('../models/Invoice.js')).default;

  const tenants = slug
    ? await Tenant.find({
      $or: [
        { slug: new RegExp(slug, 'i') },
        { name: new RegExp(slug, 'i') },
        { 'business.legalNameEn': new RegExp(slug, 'i') },
      ],
    }).select('_id name slug').lean()
    : await Tenant.find({}).select('_id name slug').limit(500).lean();

  if (!tenants.length) {
    console.error('No tenants found');
    process.exit(1);
  }

  console.log(apply ? 'APPLY mode' : 'DRY-RUN (pass --apply to write)');
  let scanned = 0;
  let toFix = 0;
  let fixed = 0;

  for (const tenant of tenants) {
    const invoices = await Invoice.find({
      tenantId: tenant._id,
      flow: { $ne: 'purchase' },
      status: { $nin: ['cancelled', 'void'] },
    }).select('_id invoiceNumber issueDate dueDate paymentTerms status').lean();

    const rows = [];
    for (const inv of invoices) {
      scanned += 1;
      const check = needsRepair(inv);
      if (!check.repair) continue;
      toFix += 1;
      const termId = String(inv.paymentTerms || '').trim() || 'immediate';
      const nextDue = computeDueDateFromPaymentTerms(inv.issueDate, findPaymentTerm(termId) ? termId : 'immediate')
        || computeDueDateFromPaymentTerms(inv.issueDate, 'immediate');
      rows.push({
        invoiceNumber: inv.invoiceNumber,
        issueDate: extractDateOnly(inv.issueDate),
        oldDue: extractDateOnly(inv.dueDate),
        newDue: extractDateOnly(nextDue),
        paymentTerms: termId,
        reason: check.reason,
      });

      if (apply && nextDue) {
        await Invoice.collection.updateOne(
          { _id: inv._id },
          { $set: { dueDate: nextDue } },
        );
        fixed += 1;
      }
    }

    if (rows.length) {
      console.log(`\nTenant ${tenant.name} (${tenant.slug || tenant._id}) — ${rows.length} invoices`);
      for (const r of rows.slice(0, 50)) {
        console.log(`  ${r.invoiceNumber}: ${r.issueDate} | ${r.oldDue || '—'} → ${r.newDue} (${r.paymentTerms}, ${r.reason})`);
      }
      if (rows.length > 50) console.log(`  … +${rows.length - 50} more`);
    }
  }

  console.log('\n--- Summary ---');
  console.log({ scanned, toFix, fixed: apply ? fixed : 0, mode: apply ? 'apply' : 'dry-run' });
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
