/**
 * Migrate Customer + Supplier → unified Partner collection.
 *
 * Prefer Customer _id for dual-role pairs; remap discarded Supplier FKs.
 *
 * Usage (from backend/, MONGO_URI set):
 *   node scripts/migratePartners.js --dry-run
 *   node scripts/migratePartners.js --dry-run --tenant=<tenantId>
 *   node scripts/migratePartners.js --apply
 *   node scripts/migratePartners.js --apply --tenant=<tenantId>
 *   node scripts/migratePartners.js --apply --rename-legacy
 *
 * Safe to re-run after --apply only if partners is empty / you drop partners first.
 */
import mongoose from 'mongoose';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--apply');
const renameLegacy = args.includes('--rename-legacy');
const tenantArg = args.find((a) => a.startsWith('--tenant='));
const tenantFilterId = tenantArg ? tenantArg.split('=')[1] : null;

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('Set MONGO_URI (or MONGODB_URI / DATABASE_URL) before running.');
  process.exit(1);
}

function oid(id) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function sid(id) {
  return id ? String(id) : '';
}

function normalizeType(type, fromSupplier = false) {
  if (type === 'company' || (fromSupplier && !type)) return 'business';
  if (type === 'business' || type === 'individual') return type;
  return 'business';
}

function addrFrom(c = {}, s = {}) {
  const a = c.address || {};
  const b = s.address || {};
  return {
    street: a.street || b.street || '',
    streetAr: a.streetAr || '',
    city: a.city || b.city || '',
    cityAr: a.cityAr || '',
    district: a.district || b.district || '',
    districtAr: a.districtAr || '',
    postalCode: a.postalCode || b.postalCode || '',
    country: a.country || b.country || 'SA',
    buildingNumber: a.buildingNumber || b.buildingNumber || '',
    additionalNumber: a.additionalNumber || b.additionalNumber || '',
  };
}

function contactPersonFrom(c, s) {
  if (c?.contactPerson && typeof c.contactPerson === 'object') {
    return {
      name: c.contactPerson.name || '',
      email: c.contactPerson.email || '',
      phone: c.contactPerson.phone || '',
      position: c.contactPerson.position || '',
    };
  }
  if (typeof s?.contactPerson === 'string' && s.contactPerson) {
    return { name: s.contactPerson, email: '', phone: '', position: '' };
  }
  return { name: '', email: '', phone: '', position: '' };
}

function buildPartnerFromCustomer(c, s = null) {
  const name = c.name || s?.nameEn || s?.name || '—';
  const isVendor = Boolean(c.isVendor) || Boolean(s);
  const isCustomer = c.isCustomer !== false;
  return {
    _id: c._id,
    tenantId: c.tenantId,
    type: normalizeType(c.type || s?.type, Boolean(s)),
    name,
    nameAr: c.nameAr || s?.nameAr || '',
    nameEn: s?.nameEn || c.name || '',
    email: c.email || s?.email || '',
    phone: c.phone || c.mobile || s?.phone || '',
    mobile: c.mobile || '',
    website: s?.website || '',
    customerCode: c.customerCode || undefined,
    supplierCode: s?.code || undefined,
    vatNumber: c.vatNumber || s?.vatNumber || '',
    crNumber: c.crNumber || s?.crNumber || '',
    address: addrFrom(c, s || {}),
    contactPerson: contactPersonFrom(c, s),
    paymentTermsCustomer: typeof c.paymentTerms === 'string' ? c.paymentTerms : 'net30',
    paymentTermsVendor: s?.paymentTerms && typeof s.paymentTerms === 'object'
      ? s.paymentTerms
      : { term: 'net_30' },
    creditLimit: c.creditLimit || 0,
    currentBalance: c.currentBalance || 0,
    bank: s?.bank || {},
    notes: c.notes || s?.notes || '',
    tags: [...new Set([...(c.tags || []), ...(s?.tags || [])])],
    isActive: c.isActive !== false && (s ? s.isActive !== false : true),
    isCustomer,
    isVendor,
    parentCompanyId: c.parentCompanyId || null,
    receivableAccountId: c.receivableAccountId || null,
    payableAccountId: s?.payableAccountId || null,
    totalInvoices: c.totalInvoices || 0,
    totalRevenue: c.totalRevenue || 0,
    lastInvoiceDate: c.lastInvoiceDate || undefined,
    khayyatMeasurements: c.khayyatMeasurements || {},
    loyaltyPoints: c.loyaltyPoints || 0,
    khayyatRelations: c.khayyatRelations || [],
    khayyatReceiptNumbers: c.khayyatReceiptNumbers || '',
    khayyatHijriDate: c.khayyatHijriDate || '',
    stockWarn: c.stockWarn || 'no',
    stockWarnMsg: c.stockWarnMsg || '',
    isAddition: s?.isAddition || false,
    additionSource: s?.additionSource || 'direct',
    additionDate: s?.additionDate || undefined,
    createdBy: s?.createdBy || undefined,
    legacyCustomerId: c._id,
    legacySupplierId: s?._id || null,
    mergedFromSupplierIds: s ? [s._id] : [],
    createdAt: c.createdAt || s?.createdAt,
    updatedAt: c.updatedAt || s?.updatedAt || c.createdAt,
  };
}

function buildPartnerFromSupplierOnly(s) {
  const name = s.nameEn || s.name || '—';
  return {
    _id: s._id,
    tenantId: s.tenantId,
    type: normalizeType(s.type, true),
    name,
    nameAr: s.nameAr || '',
    nameEn: s.nameEn || name,
    email: s.email || '',
    phone: s.phone || '',
    mobile: '',
    website: s.website || '',
    customerCode: undefined,
    supplierCode: s.code || undefined,
    vatNumber: s.vatNumber || '',
    crNumber: s.crNumber || '',
    address: addrFrom({}, s),
    contactPerson: contactPersonFrom(null, s),
    paymentTermsCustomer: 'net30',
    paymentTermsVendor: s.paymentTerms && typeof s.paymentTerms === 'object'
      ? s.paymentTerms
      : { term: 'net_30' },
    creditLimit: 0,
    currentBalance: 0,
    bank: s.bank || {},
    notes: s.notes || '',
    tags: s.tags || [],
    isActive: s.isActive !== false,
    isCustomer: Boolean(s.isCustomer),
    isVendor: s.isVendor !== false,
    parentCompanyId: s.parentCompanyId || null,
    receivableAccountId: null,
    payableAccountId: s.payableAccountId || null,
    isAddition: s.isAddition || false,
    additionSource: s.additionSource || 'direct',
    additionDate: s.additionDate || undefined,
    createdBy: s.createdBy || undefined,
    legacyCustomerId: null,
    legacySupplierId: s._id,
    mergedFromSupplierIds: [],
    createdAt: s.createdAt,
    updatedAt: s.updatedAt || s.createdAt,
  };
}

/** Collections / fields that may hold a discarded supplier (or any remapped) id */
const FK_SPECS = [
  { collection: 'invoices', fields: ['customerId', 'supplierId'] },
  { collection: 'quotations', fields: ['customerId'] },
  { collection: 'deliverynotes', fields: ['customerId'] },
  { collection: 'transactions', fields: ['customerId'] },
  { collection: 'purchaseorders', fields: ['supplierId', 'customerId'] },
  { collection: 'grns', fields: ['supplierId'] },
  { collection: 'purchasereturns', fields: ['supplierId'] },
  { collection: 'shipments', fields: ['supplierId'] },
  { collection: 'expenses', fields: ['supplierId', 'customerId'] },
  { collection: 'inventoryreorderrules', fields: ['preferredVendorId'] },
  { collection: 'invreorderrules', fields: ['preferredVendorId'] },
  { collection: 'vouchers', fields: ['partyId'] },
  { collection: 'invtransfers', fields: ['partnerId'] },
  { collection: 'invmoves', fields: ['partnerId'] },
  { collection: 'invprocurementgroups', fields: ['partnerId'] },
  { collection: 'workshopjobcards', fields: ['customerId'] },
  { collection: 'workshopvehicles', fields: ['customerId'] },
  { collection: 'workshopestimates', fields: ['customerId'] },
  { collection: 'workshopservicereminders', fields: ['customerId'] },
  { collection: 'workshoppurchaseorders', fields: ['supplierId'] },
  { collection: 'workshopinventoryitems', fields: ['primarySupplierId'] },
  { collection: 'khayyatstitchings', fields: ['customerId', 'relationId'] },
  { collection: 'khayyatdeliveries', fields: ['customerId'] },
  { collection: 'khayyatmeasurementprofiles', fields: ['customerId'] },
  { collection: 'khayyatfabrics', fields: ['supplierId'] },
  { collection: 'crmleads', fields: ['customerId'] },
  { collection: 'crmdeals', fields: ['customerId'] },
  { collection: 'crmactivities', fields: ['customerId'] },
  { collection: 'crmcontacts', fields: ['customerId'] },
  { collection: 'smsmessages', fields: ['relatedCustomerId'] },
  { collection: 'whatsappcontacts', fields: ['customerId'] },
  { collection: 'marqueeappointments', fields: ['customerId'] },
  { collection: 'calendarevents', fields: ['relatedCustomer'] },
  { collection: 'contracts', fields: ['customer'] },
  { collection: 'manpowerassignments', fields: ['clientId'] },
  { collection: 'manpowerworkers', fields: ['clientId'] },
  { collection: 'manpowertimesheets', fields: ['clientId'] },
  { collection: 'furnitureorders', fields: ['customerId'] },
  { collection: 'boutiquerentals', fields: ['customerId'] },
  { collection: 'khataaccounts', fields: ['customerId'] },
  { collection: 'partners', fields: ['parentCompanyId'] },
];

async function collectionExists(db, name) {
  const cols = await db.listCollections({ name }).toArray();
  return cols.length > 0;
}

async function remapField(db, collection, field, remap, report) {
  if (!(await collectionExists(db, collection))) {
    report.skippedCollections.push(collection);
    return 0;
  }
  let modified = 0;
  for (const [from, to] of remap.entries()) {
    if (from === to) continue;
    const fromOid = oid(from);
    const toOid = oid(to);
    if (!fromOid || !toOid) continue;
    if (dryRun) {
      const n = await db.collection(collection).countDocuments({ [field]: fromOid });
      modified += n;
    } else {
      const res = await db.collection(collection).updateMany(
        { [field]: fromOid },
        { $set: { [field]: toOid } }
      );
      modified += res.modifiedCount;
    }
  }
  if (modified) {
    report.remaps.push({ collection, field, count: modified });
  }
  return modified;
}

async function remapProductSuppliers(db, remap, report) {
  const name = 'products';
  if (!(await collectionExists(db, name))) return 0;
  let modified = 0;
  const cursor = db.collection(name).find({ 'suppliers.supplierId': { $exists: true } });
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    let changed = false;
    const next = (doc.suppliers || []).map((row) => {
      const key = sid(row.supplierId);
      if (key && remap.has(key) && remap.get(key) !== key) {
        changed = true;
        return { ...row, supplierId: oid(remap.get(key)) };
      }
      return row;
    });
    if (!changed) continue;
    modified += 1;
    if (!dryRun) {
      await db.collection(name).updateOne({ _id: doc._id }, { $set: { suppliers: next } });
    }
  }
  if (modified) report.remaps.push({ collection: name, field: 'suppliers.supplierId', count: modified });
  return modified;
}

async function remapKhayyatRelations(db, remap, report) {
  const name = 'partners';
  if (!(await collectionExists(db, name))) return 0;
  let modified = 0;
  const cursor = db.collection(name).find({ 'khayyatRelations.0': { $exists: true } });
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    let changed = false;
    const next = (doc.khayyatRelations || []).map((row) => {
      const key = sid(row.customerId);
      if (key && remap.has(key) && remap.get(key) !== key) {
        changed = true;
        return { ...row, customerId: oid(remap.get(key)) };
      }
      return row;
    });
    if (!changed) continue;
    modified += 1;
    if (!dryRun) {
      await db.collection(name).updateOne({ _id: doc._id }, { $set: { khayyatRelations: next } });
    }
  }
  if (modified) report.remaps.push({ collection: name, field: 'khayyatRelations.customerId', count: modified });
  return modified;
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const tenantMatch = tenantFilterId ? { tenantId: oid(tenantFilterId) } : {};

const legacyCustomersName = (await collectionExists(db, 'customers')) ? 'customers'
  : (await collectionExists(db, 'customers_legacy')) ? 'customers_legacy' : null;
const legacySuppliersName = (await collectionExists(db, 'suppliers')) ? 'suppliers'
  : (await collectionExists(db, 'suppliers_legacy')) ? 'suppliers_legacy' : null;

if (!legacyCustomersName && !legacySuppliersName) {
  console.error('No customers/suppliers (or *_legacy) collections found.');
  await mongoose.disconnect();
  process.exit(1);
}

const customers = legacyCustomersName
  ? await db.collection(legacyCustomersName).find(tenantMatch).toArray()
  : [];
const suppliers = legacySuppliersName
  ? await db.collection(legacySuppliersName).find(tenantMatch).toArray()
  : [];

const supplierById = new Map(suppliers.map((s) => [sid(s._id), s]));
const customerById = new Map(customers.map((c) => [sid(c._id), c]));

const usedSupplierIds = new Set();
const partners = [];
const remap = new Map(); // oldId -> partnerId (string)

// Linked pairs: prefer customer id
for (const c of customers) {
  let s = null;
  if (c.linkedSupplierId) {
    s = supplierById.get(sid(c.linkedSupplierId)) || null;
  }
  if (!s) {
    s = suppliers.find((x) => sid(x.linkedCustomerId) === sid(c._id)) || null;
  }
  if (s) {
    usedSupplierIds.add(sid(s._id));
    const p = buildPartnerFromCustomer(c, s);
    partners.push(p);
    remap.set(sid(c._id), sid(p._id));
    remap.set(sid(s._id), sid(p._id));
  } else {
    const p = buildPartnerFromCustomer(c, null);
    partners.push(p);
    remap.set(sid(c._id), sid(p._id));
  }
}

for (const s of suppliers) {
  if (usedSupplierIds.has(sid(s._id))) continue;
  // Orphan reverse link without customer in set
  if (s.linkedCustomerId && customerById.has(sid(s.linkedCustomerId))) {
    continue; // already merged via customer loop
  }
  const p = buildPartnerFromSupplierOnly(s);
  partners.push(p);
  remap.set(sid(s._id), sid(p._id));
}

// Detect supplierCode collisions within tenant
const codeCollisions = [];
const codeSeen = new Map();
for (const p of partners) {
  if (!p.supplierCode) continue;
  const key = `${sid(p.tenantId)}::${p.supplierCode}`;
  if (codeSeen.has(key)) {
    codeCollisions.push({ code: p.supplierCode, a: codeSeen.get(key), b: sid(p._id) });
  } else {
    codeSeen.set(key, sid(p._id));
  }
}

const report = {
  mode: dryRun ? 'dry-run' : 'apply',
  tenantFilter: tenantFilterId || null,
  legacyCustomers: customers.length,
  legacySuppliers: suppliers.length,
  linkedPairs: usedSupplierIds.size,
  partnersToWrite: partners.length,
  expectedFormula: customers.length + suppliers.length - usedSupplierIds.size,
  codeCollisions,
  remaps: [],
  skippedCollections: [],
};

console.log(JSON.stringify({
  summary: {
    mode: report.mode,
    customers: report.legacyCustomers,
    suppliers: report.legacySuppliers,
    linkedPairs: report.linkedPairs,
    partners: report.partnersToWrite,
    expected: report.expectedFormula,
    codeCollisions: codeCollisions.length,
  },
}, null, 2));

if (codeCollisions.length) {
  console.warn('supplierCode collisions (will need manual fix if unique index fails):', codeCollisions.slice(0, 20));
}

// Remap parentCompanyId / khayyatRelations on in-memory partners before insert
for (const p of partners) {
  const key = sid(p.parentCompanyId);
  if (key && remap.has(key)) {
    p.parentCompanyId = oid(remap.get(key));
  }
  if (Array.isArray(p.khayyatRelations)) {
    p.khayyatRelations = p.khayyatRelations.map((row) => {
      const ck = sid(row.customerId);
      if (ck && remap.has(ck)) return { ...row, customerId: oid(remap.get(ck)) };
      return row;
    });
  }
}

const existingPartners = await db.collection('partners').countDocuments(tenantMatch);
if (existingPartners > 0 && !dryRun) {
  console.error(`partners already has ${existingPartners} docs for filter. Aborting to avoid duplicates. Drop/filter first.`);
  await mongoose.disconnect();
  process.exit(1);
}

if (!dryRun) {
  if (partners.length) {
    const chunk = 500;
    for (let i = 0; i < partners.length; i += chunk) {
      const slice = partners.slice(i, i + chunk);
      await db.collection('partners').insertMany(slice, { ordered: false });
    }
  }
  console.log(`Inserted ${partners.length} partners.`);
} else {
  console.log(`[dry-run] would insert ${partners.length} partners.`);
}

// Only remap discarded supplier ids (where from !== to) plus any customer→partner identity is no-op
const activeRemap = new Map([...remap.entries()].filter(([a, b]) => a !== b));
console.log(`Active FK remaps (discarded → survivor): ${activeRemap.size}`);

for (const spec of FK_SPECS) {
  for (const field of spec.fields) {
    await remapField(db, spec.collection, field, activeRemap, report);
  }
}
await remapProductSuppliers(db, activeRemap, report);
await remapKhayyatRelations(db, activeRemap, report);

if (!dryRun && renameLegacy) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (legacyCustomersName === 'customers') {
    await db.collection('customers').rename(`customers_legacy_${ts}`);
    console.log(`Renamed customers → customers_legacy_${ts}`);
  }
  if (legacySuppliersName === 'suppliers') {
    await db.collection('suppliers').rename(`suppliers_legacy_${ts}`);
    console.log(`Renamed suppliers → suppliers_legacy_${ts}`);
  }
}

console.log(JSON.stringify({ remaps: report.remaps, skippedCollections: [...new Set(report.skippedCollections)] }, null, 2));
console.log(dryRun
  ? 'Dry-run complete. Re-run with --apply to write.'
  : 'Apply complete.');

await mongoose.disconnect();
