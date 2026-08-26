/**
 * Inventory verification seed (§1.2 of the audit spec).
 *
 * Creates two tenants:
 *   inv-audit-a  — full seed (MAIN 1-step, WH2 2-step, 12 products, partners, 2 users)
 *   inv-audit-b  — isolation tenant (minimal separate data)
 *
 * Usage:
 *   node scripts/seedInventoryAuditTenant.js
 *   node scripts/seedInventoryAuditTenant.js --password='YourPass!'
 *   node scripts/seedInventoryAuditTenant.js --reset   # wipe prior audit seed for these slugs then recreate
 *
 * Credentials (default password InvAudit2026!):
 *   admin@inv-audit-a.test      — Inventory Admin (inventory_manager, all warehouses)
 *   operator@inv-audit-a.test   — Warehouse Operator (MAIN only when restriction on)
 *   admin@inv-audit-b.test      — Admin on isolation tenant
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Warehouse from '../models/Warehouse.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';
import InvSettings from '../models/inventory/InvSettings.js';
import InvProductCategory from '../models/inventory/InvProductCategory.js';
import InvLocation from '../models/inventory/InvLocation.js';
import InvProductAttribute from '../models/inventory/InvProductAttribute.js';
import InvAttributeValue from '../models/inventory/InvAttributeValue.js';
import InvProductVariant from '../models/inventory/InvProductVariant.js';
import InvAttributeExclusion from '../models/inventory/InvAttributeExclusion.js';
import InvProductRelation from '../models/inventory/InvProductRelation.js';
import InvProductBundle from '../models/inventory/InvProductBundle.js';
import InvTemplateAttributeValue from '../models/inventory/InvTemplateAttributeValue.js';
import InvQuant from '../models/inventory/InvQuant.js';

import {
  ensureInventoryBootstrap,
  bootstrapWarehouse,
  getDefaultUom,
  enableEngine,
} from '../services/inventory/bootstrap.js';
import { recomputeWarehouseRoutes } from '../services/inventory/warehouseSteps.js';
import { createLocation, createProductCategory } from '../services/inventory/configMasters.js';
import { nextProductId } from '../services/inventory/productIdentity.js';
import { applyQuantDelta } from '../services/inventory/quantDelta.js';
import {
  generateVariants,
  upsertExclusion,
  upsertTemplateAttributeValue,
  ensureDefaultVariant,
} from '../services/inventory/variants.js';
import { upsertRelation } from '../services/inventory/productRelations.js';
import { upsertBundle } from '../services/inventory/productBundles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SLUG_A = 'inv-audit-a';
const SLUG_B = 'inv-audit-b';
const DEFAULT_PASSWORD = 'InvAudit2026!';

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return true;
  return fallback;
}

function log(...args) {
  console.log('[inv-audit-seed]', ...args);
}

async function ensureTenant(slug, name) {
  let tenant = await Tenant.findOne({ slug });
  if (tenant) {
    log(`tenant exists ${slug} → ${tenant._id}`);
    return tenant;
  }
  tenant = await Tenant.create({
    name,
    slug,
    businessType: 'trading',
    businessTypes: ['trading'],
    subscription: {
      plan: 'trial',
      status: 'active',
      features: ['invoicing', 'inventory', 'multi_warehouse', 'advanced_reports', 'api_access'],
    },
    isActive: true,
    settings: {
      language: 'en',
      currency: 'SAR',
    },
  });
  log(`tenant created ${slug} → ${tenant._id}`);
  return tenant;
}

async function ensureUser({
  tenantId,
  email,
  password,
  firstName,
  lastName,
  role,
  permissions,
  warehouseIds = [],
}) {
  const existing = await User.findOne({ tenantId, email: email.toLowerCase() });
  // Store plaintext — User pre-save bcrypt-hashes. Login sends obfuscated plaintext (not SHA-256).
  if (existing) {
    existing.role = role;
    existing.permissions = permissions;
    existing.warehouseIds = warehouseIds;
    existing.isActive = true;
    existing.password = password;
    existing.loginAttempts = 0;
    existing.lockUntil = undefined;
    existing.firstName = firstName;
    existing.lastName = lastName;
    await existing.save();
    log(`user updated ${email}`);
    return existing;
  }
  const user = await User.create({
    tenantId,
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    role,
    permissions,
    warehouseIds,
    isActive: true,
    preferences: { language: 'en', theme: 'system' },
  });
  log(`user created ${email}`);
  return user;
}

async function ensureChildLocation(tid, userId, parent, name, nameAr, usage, warehouseId) {
  const completePath = `${parent.completePath}/${name}`;
  let loc = await InvLocation.findOne({ tenantId: tid, completePath });
  if (!loc) {
    loc = await createLocation(tid, userId, {
      name,
      nameAr,
      usage,
      parentId: parent._id,
      warehouseId,
    });
    log(`location created ${loc.completePath}`);
  }
  return loc;
}

/**
 * Always align warehouse input/output pointers to reception/delivery steps.
 * recomputeWarehouseRoutes can leave pointers on Stock when OT/vendor wiring skips.
 */
async function syncWarehouseIoPointers(tid, userId, whDoc) {
  const wh = await Warehouse.findById(whDoc._id);
  const view = await InvLocation.findById(wh.viewLocationId);
  const stock = await InvLocation.findById(wh.stockLocationId);
  if (!view || !stock) throw new Error(`Warehouse ${wh.code} missing view/stock`);

  const input = await ensureChildLocation(tid, userId, view, 'Input', 'المدخل', 'internal', wh._id);
  const output = await ensureChildLocation(tid, userId, view, 'Output', 'المخرج', 'internal', wh._id);

  const reception = wh.receptionSteps || 'one';
  const delivery = wh.deliverySteps || 'ship';
  wh.inputLocationId = reception === 'one' ? stock._id : input._id;
  wh.outputLocationId = delivery === 'ship' ? stock._id : output._id;
  await wh.save();

  const InvOperationType = (await import('../models/inventory/InvOperationType.js')).default;
  const receiptOt = await InvOperationType.findOne({ tenantId: tid, warehouseId: wh._id, code: 'incoming' });
  const deliveryOt = await InvOperationType.findOne({ tenantId: tid, warehouseId: wh._id, code: 'outgoing' });
  const vendor = await InvLocation.findOne({ tenantId: tid, usage: 'vendor' });
  const customer = await InvLocation.findOne({ tenantId: tid, usage: 'customer' });
  if (receiptOt && vendor) {
    receiptOt.defaultSourceLocationId = vendor._id;
    receiptOt.defaultDestLocationId = reception === 'one' ? stock._id : input._id;
    await receiptOt.save();
  }
  if (deliveryOt && customer) {
    deliveryOt.defaultSourceLocationId = delivery === 'ship' ? stock._id : output._id;
    deliveryOt.defaultDestLocationId = customer._id;
    await deliveryOt.save();
  }
  return Warehouse.findById(wh._id);
}

/**
 * Prefer recomputeWarehouseRoutes (replica set). Always sync IO pointers afterwards.
 */
async function applyWarehouseSteps(tid, userId, whDoc) {
  try {
    await recomputeWarehouseRoutes(whDoc._id, tid, userId);
  } catch (err) {
    const msg = String(err?.message || err);
    if (!msg.includes('replica set') && err?.code !== 20 && !msg.includes('Transaction numbers')) {
      throw err;
    }
    log(`recomputeWarehouseRoutes unavailable (${msg.slice(0, 60)}…) — pointer sync only`);
  }
  return syncWarehouseIoPointers(tid, userId, whDoc);
}

async function ensureWarehouse(tid, userId, {
  code, nameEn, nameAr, receptionSteps, deliverySteps, isPrimary,
}) {
  let wh = await Warehouse.findOne({ tenantId: tid, code });
  if (!wh) {
    wh = await Warehouse.create({
      tenantId: tid,
      code,
      nameEn,
      nameAr,
      type: isPrimary ? 'main' : 'branch',
      isPrimary: !!isPrimary,
      isActive: true,
      receptionSteps,
      deliverySteps,
    });
    log(`warehouse created ${code}`);
  } else {
    wh.receptionSteps = receptionSteps;
    wh.deliverySteps = deliverySteps;
    wh.isPrimary = !!isPrimary;
    wh.isActive = true;
    await wh.save();
    log(`warehouse updated ${code}`);
  }

  if (!wh.stockLocationId || !wh.engineBootstrappedAt) {
    await bootstrapWarehouse(tid, wh, null, userId);
    wh = await Warehouse.findById(wh._id);
  }
  wh = await applyWarehouseSteps(tid, userId, wh);

  const stock = await InvLocation.findById(wh.stockLocationId);
  if (stock) {
    await ensureChildLocation(tid, userId, stock, 'Shelf-A', 'رف أ', 'internal', wh._id);
  }

  return Warehouse.findById(wh._id).lean();
}

async function ensureCategory(tid, userId, { name, nameAr, costingMethod, parentId }) {
  const existing = await InvProductCategory.findOne({
    tenantId: tid,
    name,
    parentId: parentId || null,
  });
  if (existing) {
    existing.costingMethod = costingMethod;
    existing.valuationMode = 'manual';
    await existing.save();
    return existing;
  }
  return createProductCategory(tid, userId, {
    name,
    nameAr,
    parentId: parentId || null,
    costingMethod,
    valuationMode: 'manual',
  });
}

async function ensureProduct(tid, uomId, def) {
  let p = await Product.findOne({ tenantId: tid, sku: def.sku });
  if (p) {
    Object.assign(p, {
      nameEn: def.nameEn,
      nameAr: def.nameAr,
      categoryId: def.categoryId,
      uomId,
      tracking: def.tracking,
      useExpirationDate: !!def.useExpirationDate,
      expirationDays: def.expirationDays || undefined,
      trackInventory: def.trackInventory !== false,
      canBeSold: true,
      canBePurchased: true,
      sellingPrice: def.sellingPrice,
      costPrice: def.costPrice,
      status: 'active',
      productType: def.productType || 'goods',
    });
    if (!p.productId) p.productId = await nextProductId(tid);
    await p.save();
    return p;
  }
  const productId = await nextProductId(tid);
  return Product.create({
    tenantId: tid,
    sku: def.sku,
    productId,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
    categoryId: def.categoryId,
    uomId,
    tracking: def.tracking,
    useExpirationDate: !!def.useExpirationDate,
    expirationDays: def.expirationDays || undefined,
    trackInventory: def.trackInventory !== false,
    canBeSold: true,
    canBePurchased: true,
    sellingPrice: def.sellingPrice,
    costPrice: def.costPrice,
    status: 'active',
    productType: def.productType || 'goods',
  });
}

async function seedOpeningStock(tid, stockLocationId, products) {
  const simples = products.filter((p) => p.tracking === 'none');
  if (!simples.length || !stockLocationId) return 0;

  const InvQuant = (await import('../models/inventory/InvQuant.js')).default;
  let seeded = 0;
  for (const p of simples) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await InvQuant.findOne({
      tenantId: tid,
      productId: p._id,
      locationId: stockLocationId,
    });
    if (existing) continue;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await applyQuantDelta(session, tid, p._id, stockLocationId, '100', '0', new Date(), {
        tracking: 'none',
      });
      await session.commitTransaction();
      seeded += 1;
    } catch (err) {
      try { await session.abortTransaction(); } catch { /* */ }
      try {
        await applyQuantDelta(null, tid, p._id, stockLocationId, '100', '0', new Date(), {
          tracking: 'none',
        });
        seeded += 1;
      } catch (inner) {
        log(`skip opening stock ${p.sku}: ${String(inner?.message || inner).slice(0, 60)}`);
      }
    } finally {
      session.endSession();
    }
  }
  log(`opening stock seeded for ${seeded} simple SKUs @ MAIN/Stock qty=100`);
  return seeded;
}

async function ensureAttr(tid, userId, { name, nameAr, displayType, createVariantMode }) {
  let attr = await InvProductAttribute.findOne({ tenantId: tid, name });
  if (attr) {
    attr.displayType = displayType || attr.displayType;
    attr.createVariantMode = createVariantMode || attr.createVariantMode;
    attr.createVariant = (createVariantMode || attr.createVariantMode) !== 'never';
    attr.active = true;
    await attr.save();
    return attr;
  }
  return InvProductAttribute.create({
    tenantId: tid,
    name,
    nameAr,
    displayType: displayType || 'select',
    createVariantMode: createVariantMode || 'always',
    createVariant: (createVariantMode || 'always') !== 'never',
    sequence: 10,
    active: true,
    createdBy: userId,
  });
}

async function ensureAttrValue(tid, userId, attributeId, { name, nameAr, extraPrice, htmlColor, sequence }) {
  let val = await InvAttributeValue.findOne({ tenantId: tid, attributeId, name });
  if (val) {
    val.extraPrice = extraPrice ?? val.extraPrice;
    val.htmlColor = htmlColor || val.htmlColor;
    val.sequence = sequence ?? val.sequence;
    val.active = true;
    await val.save();
    return val;
  }
  return InvAttributeValue.create({
    tenantId: tid,
    attributeId,
    name,
    nameAr,
    extraPrice: extraPrice || 0,
    htmlColor,
    sequence: sequence || 10,
    active: true,
    createdBy: userId,
  });
}

/**
 * v5 fixture: Colour(Red/Blue/Silk) × Size(S/M/L/XXL) = 12, exclude Silk+XXL → 11.
 * + accessory, upsell, kit bundle (AUD-KIT-01).
 */
async function seedVariantFixture(tid, userId, { catStd, uomId, simpleProducts }) {
  const colour = await ensureAttr(tid, userId, {
    name: 'Colour',
    nameAr: 'اللون',
    displayType: 'color',
    createVariantMode: 'always',
  });
  const size = await ensureAttr(tid, userId, {
    name: 'Size',
    nameAr: 'المقاس',
    displayType: 'pill',
    createVariantMode: 'always',
  });

  const red = await ensureAttrValue(tid, userId, colour._id, { name: 'Red', nameAr: 'أحمر', htmlColor: '#DC2626', sequence: 10 });
  const blue = await ensureAttrValue(tid, userId, colour._id, { name: 'Blue', nameAr: 'أزرق', htmlColor: '#2563EB', sequence: 20 });
  const silk = await ensureAttrValue(tid, userId, colour._id, {
    name: 'Silk',
    nameAr: 'حرير',
    htmlColor: '#F5F0E6',
    extraPrice: 15,
    sequence: 30,
  });
  const sizeS = await ensureAttrValue(tid, userId, size._id, { name: 'S', nameAr: 'S', sequence: 10 });
  const sizeM = await ensureAttrValue(tid, userId, size._id, { name: 'M', nameAr: 'M', extraPrice: 5, sequence: 20 });
  const sizeL = await ensureAttrValue(tid, userId, size._id, { name: 'L', nameAr: 'L', extraPrice: 8, sequence: 30 });
  const sizeXxl = await ensureAttrValue(tid, userId, size._id, { name: 'XXL', nameAr: 'XXL', extraPrice: 12, sequence: 40 });

  const tee = await ensureProduct(tid, uomId, {
    sku: 'AUD-TEE-01',
    nameEn: 'Audit Tee',
    nameAr: 'تيشيرت تدقيق',
    tracking: 'none',
    categoryId: catStd._id,
    sellingPrice: 50,
    costPrice: 20,
  });

  tee.attributeLines = [
    {
      attributeId: colour._id,
      valueIds: [red._id, blue._id, silk._id],
      createVariantMode: 'always',
    },
    {
      attributeId: size._id,
      valueIds: [sizeS._id, sizeM._id, sizeL._id, sizeXxl._id],
      createVariantMode: 'always',
    },
  ];
  await tee.save();

  // Per-template extra: Silk +15 on this tee (also set globally above)
  await upsertTemplateAttributeValue(tid, userId, {
    templateId: tee._id,
    attributeId: colour._id,
    attributeValueId: silk._id,
    priceExtra: 15,
  });
  await upsertTemplateAttributeValue(tid, userId, {
    templateId: tee._id,
    attributeId: size._id,
    attributeValueId: sizeM._id,
    priceExtra: 5,
  });

  await upsertExclusion(tid, userId, {
    templateId: tee._id,
    attributeValueId: silk._id,
    excludedValueIds: [sizeXxl._id],
  });

  const gen = await generateVariants(tid, userId, {
    productId: tee._id,
    attributeLines: tee.attributeLines,
    dryRun: false,
  });
  log(`variant tee: combinations=${gen.combinationCount} created=${gen.created} excluded=${gen.excludedCount}`);

  const accessoryTarget = simpleProducts.find((p) => p.sku === 'AUD-SIM-01') || simpleProducts[0];
  const upsellTarget = simpleProducts.find((p) => p.sku === 'AUD-SIM-02') || simpleProducts[1];

  await upsertRelation(tid, userId, {
    sourceProductId: tee._id,
    relatedProductId: accessoryTarget._id,
    type: 'accessory',
    note: 'Phone case style add-on for demo',
  });
  await upsertRelation(tid, userId, {
    sourceProductId: tee._id,
    relatedProductId: upsellTarget._id,
    type: 'upsell',
    note: 'Upgrade suggestion',
  });

  const kit = await ensureProduct(tid, uomId, {
    sku: 'AUD-KIT-01',
    nameEn: 'Audit Starter Kit',
    nameAr: 'طقم تدقيق',
    tracking: 'none',
    categoryId: catStd._id,
    sellingPrice: 80,
    costPrice: 0,
    trackInventory: false,
  });
  await upsertBundle(tid, userId, {
    productId: kit._id,
    type: 'kit',
    lines: [
      { componentProductId: accessoryTarget._id, qty: '1', sequence: 10 },
      { componentProductId: upsellTarget._id, qty: '2', sequence: 20 },
    ],
  });

  // Default variants for simple seeded products (stock remains on productId + null variant for now)
  for (const p of simpleProducts) {
    // eslint-disable-next-line no-await-in-loop
    await ensureDefaultVariant(tid, userId, p._id);
  }

  const variantCount = await InvProductVariant.countDocuments({
    tenantId: tid,
    productId: tee._id,
    active: true,
  });

  return {
    templateSku: 'AUD-TEE-01',
    templateId: String(tee._id),
    variantCount,
    expectedVariants: 11,
    exclusion: 'Silk × XXL',
    kitSku: 'AUD-KIT-01',
    accessorySku: accessoryTarget.sku,
    upsellSku: upsellTarget.sku,
    generate: {
      combinationCount: gen.combinationCount,
      created: gen.created,
      excludedCount: gen.excludedCount,
    },
  };
}

async function wipeAuditTenant(slug) {
  const tenant = await Tenant.findOne({ slug });
  if (!tenant) return;
  const tid = tenant._id;
  log(`--reset: wiping data for ${slug}`);
  await Promise.all([
    Product.deleteMany({ tenantId: tid }),
    Supplier.deleteMany({ tenantId: tid }),
    Customer.deleteMany({ tenantId: tid }),
    User.deleteMany({ tenantId: tid }),
    Warehouse.deleteMany({ tenantId: tid }),
    InvProductCategory.deleteMany({ tenantId: tid }),
    InvLocation.deleteMany({ tenantId: tid }),
    InvSettings.deleteMany({ tenantId: tid }),
    InvProductAttribute.deleteMany({ tenantId: tid }),
    InvAttributeValue.deleteMany({ tenantId: tid }),
    InvProductVariant.deleteMany({ tenantId: tid }),
    InvAttributeExclusion.deleteMany({ tenantId: tid }),
    InvProductRelation.deleteMany({ tenantId: tid }),
    InvProductBundle.deleteMany({ tenantId: tid }),
    InvTemplateAttributeValue.deleteMany({ tenantId: tid }),
    InvQuant.deleteMany({ tenantId: tid }),
  ]);
  // Leave tenant doc; recreate children
}

async function seedPrimaryTenant(password) {
  const tenant = await ensureTenant(SLUG_A, 'Inventory Audit A');
  const tid = tenant._id;

  await ensureInventoryBootstrap(tid);
  await enableEngine(tid);
  await InvSettings.findOneAndUpdate(
    { tenantId: tid },
    {
      $set: {
        inventoryAccountingMode: 'costing',
        inventoryEvaluationEnabled: true,
        stockAccountingEnabled: false,
        enforceWarehouseRestriction: true,
        groupStockMultiLocations: true,
        groupAdvLocation: true,
        groupProductionLot: true,
        moduleProductExpiry: true,
        groupProductVariant: true,
        engineEnabled: true,
      },
    },
    { upsert: true },
  );

  const adminPerms = [
    { module: 'inventory', actions: ['create', 'read', 'update', 'delete', 'export'] },
    { module: 'supply_chain', actions: ['create', 'read', 'update', 'export'] },
    { module: 'landed_costs', actions: ['create', 'read', 'update', 'export'] },
    { module: 'mrp', actions: ['read', 'update'] },
    { module: 'settings', actions: ['read'] },
    { module: 'purchases', actions: ['create', 'read', 'update', 'export'] },
    { module: 'invoicing', actions: ['create', 'read', 'update', 'export'] },
  ];

  const admin = await ensureUser({
    tenantId: tid,
    email: 'admin@inv-audit-a.test',
    password,
    firstName: 'Audit',
    lastName: 'Admin',
    role: 'admin',
    permissions: adminPerms,
    warehouseIds: [],
  });

  // Ensure trial limits don't hide multi-WH / second user
  tenant.subscription = tenant.subscription || {};
  tenant.subscription.status = 'active';
  tenant.subscription.maxUsers = Math.max(Number(tenant.subscription.maxUsers) || 0, 5);
  tenant.subscription.features = Array.from(new Set([
    ...(tenant.subscription.features || []),
    'invoicing', 'inventory', 'multi_warehouse', 'advanced_reports', 'api_access',
  ]));
  tenant.markModified('subscription');
  await tenant.save();

  const uom = await getDefaultUom(tid);
  if (!uom) throw new Error('Default UoM missing after bootstrap');

  const main = await ensureWarehouse(tid, admin._id, {
    code: 'MAIN',
    nameEn: 'Main Warehouse',
    nameAr: 'المستودع الرئيسي',
    receptionSteps: 'one',
    deliverySteps: 'ship',
    isPrimary: true,
  });

  const wh2 = await ensureWarehouse(tid, admin._id, {
    code: 'WH2',
    nameEn: 'Warehouse Two',
    nameAr: 'المستودع الثاني',
    receptionSteps: 'two',
    deliverySteps: 'pickShip',
    isPrimary: false,
  });

  const rootCat = await InvProductCategory.findOne({ tenantId: tid, name: 'All' });
  const catStd = await ensureCategory(tid, admin._id, {
    name: 'Standard Cost',
    nameAr: 'تكلفة معيارية',
    costingMethod: 'standard',
    parentId: rootCat?._id,
  });
  const catFifo = await ensureCategory(tid, admin._id, {
    name: 'FIFO Cost',
    nameAr: 'تكلفة FIFO',
    costingMethod: 'fifo',
    parentId: rootCat?._id,
  });
  const catAvg = await ensureCategory(tid, admin._id, {
    name: 'Average Cost',
    nameAr: 'تكلفة متوسط',
    costingMethod: 'average',
    parentId: rootCat?._id,
  });

  const productDefs = [
    // 4 simple (untracked)
    { sku: 'AUD-SIM-01', nameEn: 'Simple Widget A', nameAr: 'قطعة بسيطة أ', tracking: 'none', categoryId: catStd._id, sellingPrice: 25, costPrice: 10 },
    { sku: 'AUD-SIM-02', nameEn: 'Simple Widget B', nameAr: 'قطعة بسيطة ب', tracking: 'none', categoryId: catFifo._id, sellingPrice: 30, costPrice: 12 },
    { sku: 'AUD-SIM-03', nameEn: 'Simple Widget C', nameAr: 'قطعة بسيطة ج', tracking: 'none', categoryId: catAvg._id, sellingPrice: 18, costPrice: 8 },
    { sku: 'AUD-SIM-04', nameEn: 'Simple Widget D', nameAr: 'قطعة بسيطة د', tracking: 'none', categoryId: catAvg._id, sellingPrice: 22, costPrice: 9 },
    // 4 lot-tracked
    { sku: 'AUD-LOT-01', nameEn: 'Lot Paint Red', nameAr: 'طلاء أحمر دفعة', tracking: 'lot', categoryId: catFifo._id, sellingPrice: 45, costPrice: 20 },
    { sku: 'AUD-LOT-02', nameEn: 'Lot Paint Blue', nameAr: 'طلاء أزرق دفعة', tracking: 'lot', categoryId: catFifo._id, sellingPrice: 45, costPrice: 20 },
    { sku: 'AUD-LOT-03', nameEn: 'Lot Chemical X', nameAr: 'مادة كيميائية X', tracking: 'lot', categoryId: catStd._id, sellingPrice: 80, costPrice: 40 },
    { sku: 'AUD-LOT-04', nameEn: 'Lot Chemical Y', nameAr: 'مادة كيميائية Y', tracking: 'lot', categoryId: catAvg._id, sellingPrice: 90, costPrice: 45 },
    // 2 serial-tracked
    { sku: 'AUD-SER-01', nameEn: 'Serial Laptop', nameAr: 'حاسوب تسلسلي', tracking: 'serial', categoryId: catStd._id, sellingPrice: 3500, costPrice: 2800 },
    { sku: 'AUD-SER-02', nameEn: 'Serial Scanner', nameAr: 'ماسح تسلسلي', tracking: 'serial', categoryId: catAvg._id, sellingPrice: 900, costPrice: 600 },
    // 2 with expiry (lot + expiry)
    { sku: 'AUD-EXP-01', nameEn: 'Expiry Milk 1L', nameAr: 'حليب منتهي الصلاحية ١ل', tracking: 'lot', useExpirationDate: true, expirationDays: 14, categoryId: catFifo._id, sellingPrice: 8, costPrice: 4 },
    { sku: 'AUD-EXP-02', nameEn: 'Expiry Yogurt', nameAr: 'زبادي صلاحية', tracking: 'lot', useExpirationDate: true, expirationDays: 21, categoryId: catAvg._id, sellingPrice: 6, costPrice: 3 },
  ];

  const products = [];
  for (const def of productDefs) {
    // eslint-disable-next-line no-await-in-loop
    products.push(await ensureProduct(tid, uom._id, def));
  }
  log(`products ready: ${products.length}`);

  await seedOpeningStock(tid, main.stockLocationId, products);

  for (const [code, nameEn] of [['VEND-01', 'Audit Vendor One'], ['VEND-02', 'Audit Vendor Two']]) {
    // eslint-disable-next-line no-await-in-loop
    const s = await Supplier.findOneAndUpdate(
      { tenantId: tid, code },
      {
        $set: {
          nameEn,
          nameAr: nameEn,
          type: 'company',
          isActive: true,
        },
        $setOnInsert: { tenantId: tid, code },
      },
      { upsert: true, new: true },
    );
    log(`supplier ${s.code}`);
  }

  for (const [code, name] of [['CUST-01', 'Audit Customer One'], ['CUST-02', 'Audit Customer Two']]) {
    // eslint-disable-next-line no-await-in-loop
    let c = await Customer.findOne({ tenantId: tid, customerCode: code });
    if (!c) {
      c = await Customer.create({
        tenantId: tid,
        customerCode: code,
        name,
        nameAr: name,
        type: 'business',
        isActive: true,
      });
    }
    log(`customer ${c.customerCode || c.name}`);
  }

  const operator = await ensureUser({
    tenantId: tid,
    email: 'operator@inv-audit-a.test',
    password,
    firstName: 'Warehouse',
    lastName: 'Operator',
    role: 'viewer',
    permissions: [
      { module: 'inventory', actions: ['create', 'read', 'update'] },
    ],
    warehouseIds: [main._id],
  });

  const variantFixture = await seedVariantFixture(tid, admin._id, {
    catStd,
    uomId: uom._id,
    simpleProducts: products.filter((p) => p.tracking === 'none'),
  });

  return {
    tenant,
    admin,
    operator,
    warehouses: { MAIN: main, WH2: wh2 },
    categories: { standard: catStd, fifo: catFifo, average: catAvg },
    products: products.map((p) => ({ sku: p.sku, productId: p.productId, tracking: p.tracking })),
    variantFixture,
  };
}

async function seedIsolationTenant(password) {
  const tenant = await ensureTenant(SLUG_B, 'Inventory Audit B');
  const tid = tenant._id;
  await ensureInventoryBootstrap(tid);
  await enableEngine(tid);
  await InvSettings.findOneAndUpdate(
    { tenantId: tid },
    {
      $set: {
        inventoryAccountingMode: 'ops_only',
        inventoryEvaluationEnabled: false,
        stockAccountingEnabled: false,
        engineEnabled: true,
      },
    },
    { upsert: true },
  );

  const admin = await ensureUser({
    tenantId: tid,
    email: 'admin@inv-audit-b.test',
    password,
    firstName: 'Isolation',
    lastName: 'Admin',
    role: 'inventory_manager',
    permissions: [
      { module: 'inventory', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'settings', actions: ['read'] },
    ],
  });

  const uom = await getDefaultUom(tid);
  const wh = await ensureWarehouse(tid, admin._id, {
    code: 'B-MAIN',
    nameEn: 'B Main',
    nameAr: 'ب رئيسي',
    receptionSteps: 'one',
    deliverySteps: 'ship',
    isPrimary: true,
  });

  await ensureProduct(tid, uom._id, {
    sku: 'B-ONLY-01',
    nameEn: 'Tenant B Secret Widget',
    nameAr: 'منتج ب السري',
    tracking: 'none',
    categoryId: null,
    sellingPrice: 99,
    costPrice: 50,
  });

  await Customer.findOneAndUpdate(
    { tenantId: tid, customerCode: 'B-CUST' },
    {
      $set: { name: 'Tenant B Customer', type: 'business', isActive: true },
      $setOnInsert: { tenantId: tid, customerCode: 'B-CUST' },
    },
    { upsert: true },
  );

  return { tenant, admin, warehouse: wh };
}

async function main() {
  const password = arg('password', DEFAULT_PASSWORD);
  const doReset = Boolean(arg('reset', false));
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/maqder';

  await mongoose.connect(uri);
  log(`connected ${uri.replace(/\/\/.*@/, '//***@')}`);

  if (doReset) {
    await wipeAuditTenant(SLUG_A);
    await wipeAuditTenant(SLUG_B);
  }

  const primary = await seedPrimaryTenant(password);
  const isolation = await seedIsolationTenant(password);

  const summary = {
    password,
    primary: {
      slug: SLUG_A,
      tenantId: String(primary.tenant._id),
      adminEmail: 'admin@inv-audit-a.test',
      operatorEmail: 'operator@inv-audit-a.test',
      warehouses: {
        MAIN: { id: String(primary.warehouses.MAIN._id), steps: '1-step receive/deliver' },
        WH2: { id: String(primary.warehouses.WH2._id), steps: '2-step receive/deliver' },
      },
      productCount: primary.products.length,
      products: primary.products,
      variantFixture: primary.variantFixture,
      note: 'enforceWarehouseRestriction=true; groupProductVariant=true; operator scoped to MAIN only',
    },
    isolation: {
      slug: SLUG_B,
      tenantId: String(isolation.tenant._id),
      adminEmail: 'admin@inv-audit-b.test',
      warehouse: { code: 'B-MAIN', id: String(isolation.warehouse._id) },
      note: 'Use for tenant isolation — B data must never appear in A',
    },
  };

  console.log('\n=== INVENTORY AUDIT SEED READY ===\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nLogin with the emails above and the password shown in summary.password');
  console.log('Re-run with --reset to wipe and recreate audit tenants\' child data.\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[inv-audit-seed] FAILED', err);
  try { await mongoose.disconnect(); } catch { /* */ }
  process.exit(1);
});
