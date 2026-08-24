import mongoose from 'mongoose';

const URIS = [
  process.env.MONGODB_URI,
  "mongodb://127.0.0.1:27017/zatca-erp",
  "mongodb://127.0.0.1:27017/maqder",
  "mongodb://localhost:27017/zatca-erp",
  "mongodb://localhost:27017/maqder"
].filter(Boolean);

async function connectAny() {
  for (const uri of URIS) {
    try {
      console.log('Connecting to:', uri);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
      console.log('✅ Connected successfully to MongoDB');
      return;
    } catch (err) {
      console.log('❌ Failed:', err.message);
    }
  }
  throw new Error('All connection attempts failed');
}

async function runCleanup() {
  await connectAny();

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const Supplier = mongoose.model('Supplier', new mongoose.Schema({}, { strict: false }));

  const vatNumber = '314807049800003';
  const crNumber = '7054403162';

  const tenant = await Tenant.findOne({
    $or: [
      { 'business.vatNumber': vatNumber },
      { 'business.crNumber': crNumber },
      { name: new RegExp('Allied Power', 'i') },
      { slug: 'allied-power' }
    ]
  });

  if (!tenant) {
    console.error('Allied Power Tenant not found!');
    process.exit(1);
  }

  const tenantId = tenant._id;
  console.log(`\n🧹 Starting cleanup for Tenant: "${tenant.name}" (${tenantId})`);

  // 1. Remove suppliers that do not have a VAT number
  const allSuppliers = await Supplier.find({ tenantId });
  const suppliersToDelete = allSuppliers.filter(s => {
    const vat = (s.vatNumber || '').trim();
    return !vat || vat.length < 5;
  });

  const supplierIdsToDelete = suppliersToDelete.map(s => s._id);
  console.log(`Found ${suppliersToDelete.length} suppliers without VAT to remove.`);

  const supplierDeleteResult = await Supplier.deleteMany({
    _id: { $in: supplierIdsToDelete }
  });
  console.log(`✅ Removed ${supplierDeleteResult.deletedCount} suppliers without VAT.`);

  const remainingSuppliersCount = await Supplier.countDocuments({ tenantId });
  console.log(`Total remaining suppliers with VAT: ${remainingSuppliersCount}`);

  // 2. Remove duplicate products
  const allProducts = await Product.find({ tenantId });
  console.log(`\nFound ${allProducts.length} products. Checking for duplicates...`);

  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const productGroups = {};

  allProducts.forEach(p => {
    const key = normalize(p.sku) || normalize(p.nameEn || p.name);
    if (!productGroups[key]) productGroups[key] = [];
    productGroups[key].push(p);
  });

  const duplicateGroups = Object.entries(productGroups).filter(([k, v]) => v.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate product group(s).`);

  const productIdsToDelete = [];

  for (const [key, group] of duplicateGroups) {
    // Sort by name length or completeness so we keep the best one
    group.sort((a, b) => {
      const aScore = (a.description?.length || 0) + (a.nameEn?.length || 0) + (a.unitCost ? 10 : 0);
      const bScore = (b.description?.length || 0) + (b.nameEn?.length || 0) + (b.unitCost ? 10 : 0);
      return bScore - aScore; // Highest score first
    });

    const keep = group[0];
    const dupes = group.slice(1);

    console.log(`\nGroup "${key}": Keeping product [${keep._id}] "${keep.nameEn}" (SKU: ${keep.sku})`);
    for (const d of dupes) {
      console.log(` - Deleting duplicate [${d._id}] "${d.nameEn}" (SKU: ${d.sku})`);
      productIdsToDelete.push(d._id);
    }
  }

  if (productIdsToDelete.length > 0) {
    const productDeleteResult = await Product.deleteMany({
      _id: { $in: productIdsToDelete }
    });
    console.log(`\n✅ Removed ${productDeleteResult.deletedCount} duplicate products.`);
  } else {
    console.log(`No duplicate products to delete.`);
  }

  const remainingProductsCount = await Product.countDocuments({ tenantId });
  console.log(`Total remaining unique products: ${remainingProductsCount}`);

  await mongoose.disconnect();
  console.log('\n🎉 Cleanup completed successfully.');
}

runCleanup().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
