/**
 * Backfill InvoiceCogs journals for posted sell invoices missing COGS.
 * Also heals 1310/1320 account types to asset.
 *
 * Usage:
 *   node backend/scripts/backfill-invoice-cogs.mjs [tenantId|slug]
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
  const Invoice = (await import('../models/Invoice.js')).default;
  const JournalEntry = (await import('../models/JournalEntry.js')).default;
  const { ensureStockAccountingAccounts } = await import('../services/inventory/stockAccounting.js');
  const { postSalesInvoiceCogsJournal, syncStoredAccountBalances } = await import('../services/accountingService.js');

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

  await ensureStockAccountingAccounts(tenant._id);

  const invoices = await Invoice.find({
    tenantId: tenant._id,
    flow: { $ne: 'purchase' },
    status: { $nin: ['draft', 'cancelled'] },
    invoiceType: { $nin: ['381'] },
  }).sort({ issueDate: 1 }).lean();

  let posted = 0;
  let skipped = 0;
  let failed = 0;
  for (const inv of invoices) {
    const existing = await JournalEntry.findOne({
      tenantId: tenant._id,
      sourceModel: 'InvoiceCogs',
      sourceId: inv._id,
      status: { $nin: ['void'] },
    }).select('_id').lean();
    if (existing) {
      skipped += 1;
      continue;
    }
    try {
      const entry = await postSalesInvoiceCogsJournal({
        tenantId: tenant._id,
        userId: null,
        invoice: inv,
        currency: inv.currency || 'SAR',
      });
      if (entry) posted += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      console.warn(`COGS failed for ${inv.invoiceNumber}: ${err.message}`);
    }
  }

  const sync = await syncStoredAccountBalances(tenant._id);
  console.log(JSON.stringify({
    tenant: `${tenant.name} (${tenant.slug})`,
    invoices: invoices.length,
    cogsPosted: posted,
    skipped,
    failed,
    storedSync: sync,
  }, null, 2));

  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
