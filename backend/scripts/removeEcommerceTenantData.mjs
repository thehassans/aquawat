/**
 * One-time MongoDB cleanup after removing the ecommerce tenant vertical.
 *
 * - Strips `ecommerce` from tenant businessTypes
 * - Unsets legacy `tenant.ecommerce` subdocument
 * - Drops orphaned ecommerce collections (if they exist)
 *
 * Usage:
 *   node backend/scripts/removeEcommerceTenantData.mjs
 *   node backend/scripts/removeEcommerceTenantData.mjs --dry-run
 */
import mongoose from 'mongoose';

const DRY_RUN = process.argv.includes('--dry-run');

const URIS = [
  process.env.MONGODB_URI,
  'mongodb://127.0.0.1:27017/zatca-erp',
  'mongodb://127.0.0.1:27017/maqder',
  'mongodb://localhost:27017/zatca-erp',
  'mongodb://localhost:27017/maqder',
].filter(Boolean);

const ECOMMERCE_COLLECTIONS = [
  'ecommerceorders',
  'ecommerceproducts',
  'ecommercereviews',
  'ecommercecoupons',
  'ecommercebundles',
  'ecommercereturns',
  'ecommercegiftcards',
  'abandonedcarts',
  'loyaltypoints',
];

async function connectAny() {
  for (const uri of URIS) {
    try {
      console.log('Connecting to:', uri);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('Connected.');
      return uri;
    } catch (err) {
      console.log('Failed:', err.message);
    }
  }
  throw new Error('Could not connect to MongoDB');
}

async function run() {
  const uri = await connectAny();
  const db = mongoose.connection.db;

  const tenantFilter = {
    $or: [
      { businessTypes: 'ecommerce' },
      { ecommerce: { $exists: true, $ne: null } },
    ],
  };

  const affectedCount = await db.collection('tenants').countDocuments(tenantFilter);
  console.log(`\nTenants with ecommerce data: ${affectedCount}`);

  if (affectedCount > 0) {
    if (DRY_RUN) {
      const sample = await db.collection('tenants').find(tenantFilter).project({ name: 1, slug: 1, businessTypes: 1 }).limit(10).toArray();
      console.log('Sample tenants:', JSON.stringify(sample, null, 2));
    } else {
      const result = await db.collection('tenants').updateMany(tenantFilter, {
        $pull: { businessTypes: 'ecommerce' },
        $unset: { ecommerce: '' },
      });
      console.log(`Updated tenants: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    }
  }

  // Remove demo ecommerce-only tenants (seedDemoStore leftovers)
  const demoOrphans = await db.collection('tenants').find({
    $and: [
      { $or: [{ slug: 'demo-store' }, { slug: 'demo-storefront' }, { name: /^Demo Store$/i }] },
      { $or: [{ businessTypes: { $exists: false } }, { businessTypes: { $size: 0 } }] },
    ],
  }).project({ name: 1, slug: 1, businessTypes: 1 }).toArray();

  console.log(`\nOrphan demo-store tenants: ${demoOrphans.length}`);
  if (demoOrphans.length > 0) {
    if (DRY_RUN) {
      console.log('Would delete:', JSON.stringify(demoOrphans, null, 2));
    } else {
      const ids = demoOrphans.map((t) => t._id);
      const del = await db.collection('tenants').deleteMany({ _id: { $in: ids } });
      console.log(`Deleted orphan demo tenants: ${del.deletedCount}`);
    }
  }

  console.log('\nEcommerce collections:');
  const existing = await db.listCollections().toArray();
  const names = new Set(existing.map((c) => c.name));

  for (const name of ECOMMERCE_COLLECTIONS) {
    if (!names.has(name)) {
      console.log(`  - ${name}: (not present)`);
      continue;
    }
    const count = await db.collection(name).countDocuments();
    if (DRY_RUN) {
      console.log(`  - ${name}: ${count} documents (would drop)`);
    } else {
      await db.collection(name).drop();
      console.log(`  - ${name}: dropped (${count} documents)`);
    }
  }

  console.log(DRY_RUN ? '\nDry run complete — no changes written.' : '\nCleanup complete.');
  await mongoose.disconnect();
  console.log('Disconnected from', uri);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
