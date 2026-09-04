/**
 * Prod one-shot: heal interim types + backfill COGS for all active tenants (or one slug).
 * Runs inside maqder_backend container.
 */
import mongoose from 'mongoose';

const slugArg = String(process.argv[2] || '').trim();

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);

  const Tenant = (await import('../models/Tenant.js')).default;
  const Invoice = (await import('../models/Invoice.js')).default;
  const JournalEntry = (await import('../models/JournalEntry.js')).default;
  const ChartOfAccount = (await import('../models/ChartOfAccount.js')).default;
  const { ensureStockAccountingAccounts } = await import('../services/inventory/stockAccounting.js');
  const { postSalesInvoiceCogsJournal, syncStoredAccountBalances } = await import('../services/accountingService.js');

  let tenants;
  if (slugArg) {
    const one = await Tenant.findOne({
      $or: [
        { slug: slugArg.toLowerCase() },
        { name: new RegExp(slugArg, 'i') },
      ],
    }).select('_id name slug').lean();
    tenants = one ? [one] : [];
  } else {
    tenants = await Tenant.find({ isActive: { $ne: false } }).select('_id name slug').lean();
  }

  if (!tenants.length) throw new Error(`No tenants matched: ${slugArg || '(all)'}`);

  const summary = [];
  for (const tenant of tenants) {
    await ensureStockAccountingAccounts(tenant._id);

    const interims = await ChartOfAccount.find({
      tenantId: tenant._id,
      code: { $in: ['1310', '1320', '5000'] },
    }).select('code type subtype balance').lean();

    const invoices = await Invoice.find({
      tenantId: tenant._id,
      flow: { $ne: 'purchase' },
      status: { $nin: ['draft', 'cancelled'] },
      invoiceType: { $nin: ['381'] },
    }).sort({ issueDate: 1 });

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
        console.warn(`${tenant.slug} ${inv.invoiceNumber}: ${err.message}`);
      }
    }

    await syncStoredAccountBalances(tenant._id);

    const after = await ChartOfAccount.find({
      tenantId: tenant._id,
      code: { $in: ['1310', '1320', '5000'] },
    }).select('code type subtype balance').lean();

    // Live 5000 from journals
    const { getAccountBalances } = await import('../services/ledger/balances.js');
    const live = await getAccountBalances({ tenantId: tenant._id, includeReversed: false });
    const live5000 = (live.rows || []).find((r) => String(r.code) === '5000');
    const live1310 = (live.rows || []).find((r) => String(r.code) === '1310');

    summary.push({
      tenant: `${tenant.name} (${tenant.slug})`,
      interimsBefore: interims,
      interimsAfter: after,
      invoices: invoices.length,
      cogsPosted: posted,
      skipped,
      failed,
      live5000: live5000?.naturalBalance ?? live5000?.balance ?? null,
      live1310: {
        type: after.find((a) => a.code === '1310')?.type,
        balance: live1310?.naturalBalance ?? live1310?.balance ?? null,
      },
    });
  }

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
