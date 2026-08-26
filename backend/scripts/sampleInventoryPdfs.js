/**
 * Generate sample PDFs for every print layout (visual QA).
 *
 * Usage:
 *   node scripts/sampleInventoryPdfs.js [--tenantId=<id>] [--out=./tmp/print-samples]
 *
 * Requires MONGO_URI / env from .env. Uses first transfer / products / locations when present;
 * layouts that need missing data write a small scaffold PDF instead of failing the batch.
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const { PRINT_LAYOUTS, renderInventoryPdf } = await import('../services/inventory/invPrint.js');
  const InvTransfer = (await import('../models/inventory/InvTransfer.js')).default;
  const InvLocation = (await import('../models/inventory/InvLocation.js')).default;
  const Product = (await import('../models/Product.js')).default;
  const InvLot = (await import('../models/inventory/InvLot.js')).default;
  const InvPackage = (await import('../models/inventory/InvPackage.js')).default;

  let tenantId = args.tenantId;
  if (!tenantId) {
    const t = await InvTransfer.findOne({}).select('tenantId').lean();
    tenantId = t?.tenantId ? String(t.tenantId) : null;
  }
  if (!tenantId) {
    const p = await Product.findOne({}).select('tenantId').lean();
    tenantId = p?.tenantId ? String(p.tenantId) : null;
  }
  if (!tenantId) {
    console.error('No tenant found — pass --tenantId=');
    process.exit(1);
  }

  const outDir = path.resolve(args.out || path.join(process.cwd(), 'tmp', 'print-samples'));
  fs.mkdirSync(outDir, { recursive: true });

  const transfer = await InvTransfer.findOne({ tenantId }).sort({ createdAt: -1 }).lean();
  const transfers = await InvTransfer.find({ tenantId }).sort({ createdAt: -1 }).limit(5).lean();
  const products = await Product.find({ tenantId }).limit(8).select('_id').lean();
  const locations = await InvLocation.find({ tenantId }).limit(8).select('_id').lean();
  const lots = await InvLot.find({ tenantId }).limit(4).select('_id').lean().catch(() => []);
  const packages = await InvPackage.find({ tenantId }).limit(4).select('_id').lean().catch(() => []);

  const base = {
    transferId: transfer?._id,
    transferIds: transfers.map((t) => t._id),
    productIds: products.map((p) => p._id),
    locationIds: locations.map((l) => l._id),
    lotIds: lots.map((l) => l._id),
    packageIds: packages.map((p) => p._id),
    copies: 1,
    lang: 'ar',
    filters: {},
  };

  console.log(`Tenant ${tenantId} → ${outDir}`);
  console.log(`Layouts: ${PRINT_LAYOUTS.length}`);

  for (const layout of PRINT_LAYOUTS) {
    const file = path.join(outDir, `${layout}.pdf`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const buf = await renderInventoryPdf(tenantId, { ...base, layout });
      fs.writeFileSync(file, buf);
      console.log(`OK  ${layout} (${buf.length} bytes)`);
    } catch (err) {
      console.warn(`SKIP ${layout}: ${err.message || err}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
