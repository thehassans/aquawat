import {
  InvUomCategory,
  InvUom,
  InvLocation,
  InvOperationType,
  InvSettings,
  InvProductCategory,
} from '../../models/inventory/index.js';
import Warehouse from '../../models/Warehouse.js';
import { ensureSequence } from './sequence.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Ensure tenant inventory settings + virtual location roots + default UoM.
 * Idempotent. Does not create a warehouse if none exist.
 */
export async function ensureInventoryBootstrap(tenantId, userId = null) {
  const tid = toObjectId(tenantId);
  const createdBy = userId ? toObjectId(userId) : undefined;

  let settings = await InvSettings.findOne({ tenantId: tid });
  if (!settings) {
    settings = await InvSettings.create({ tenantId: tid, createdBy, engineEnabled: false });
  }

  // Default UoM
  let uomCat = await InvUomCategory.findOne({ tenantId: tid, name: 'Units' });
  if (!uomCat) {
    uomCat = await InvUomCategory.create({
      tenantId: tid,
      name: 'Units',
      nameAr: 'وحدات',
      measureType: 'unit',
      isSystem: true,
      createdBy,
    });
  }
  let uom = await InvUom.findOne({ tenantId: tid, categoryId: uomCat._id, uomType: 'reference' });
  if (!uom) {
    uom = await InvUom.create({
      tenantId: tid,
      name: 'Units',
      nameAr: 'وحدة',
      categoryId: uomCat._id,
      uomType: 'reference',
      factor: '1',
      rounding: '0.01',
      externalCode: 'PCE',
      createdBy,
    });
  }

  let rootCat = await InvProductCategory.findOne({ tenantId: tid, name: 'All' });
  if (!rootCat) {
    rootCat = await InvProductCategory.create({
      tenantId: tid,
      name: 'All',
      nameAr: 'الكل',
      completePath: 'All',
      costingMethod: 'average',
      valuationMode: 'automated',
      createdBy,
    });
  }

  const roots = await ensureVirtualRoots(tid, createdBy);

  // Bootstrap each existing warehouse that lacks engine locations
  const warehouses = await Warehouse.find({ tenantId: tid, isActive: true });
  const bootstrapped = [];
  for (const wh of warehouses) {
    if (wh.stockLocationId && wh.engineBootstrappedAt) continue;
    const result = await bootstrapWarehouse(tid, wh, roots, createdBy);
    bootstrapped.push(result);
  }

  return { settings, uom, rootCat, roots, bootstrappedWarehouses: bootstrapped };
}

async function ensureVirtualRoots(tenantId, createdBy) {
  const locDefs = [
    { name: 'Physical Locations', nameAr: 'المواقع الفعلية', completePath: 'Physical Locations', usage: 'view' },
    { name: 'Partner Locations', nameAr: 'مواقع الشركاء', completePath: 'Partner Locations', usage: 'view' },
    { name: 'Virtual Locations', nameAr: 'المواقع الافتراضية', completePath: 'Virtual Locations', usage: 'view' },
  ];
  const locMap = {};
  for (const def of locDefs) {
    let loc = await InvLocation.findOne({ tenantId, completePath: def.completePath });
    if (!loc) {
      loc = await InvLocation.create({ tenantId, ...def, createdBy });
    }
    locMap[def.name] = loc;
  }

  const vendorLoc = await upsertChild(tenantId, createdBy, locMap['Partner Locations'], 'Vendors', 'الموردون', 'vendor');
  const customerLoc = await upsertChild(tenantId, createdBy, locMap['Partner Locations'], 'Customers', 'العملاء', 'customer');
  const inventoryAdjLoc = await upsertChild(
    tenantId, createdBy, locMap['Virtual Locations'],
    'Inventory adjustment', 'تسوية المخزون', 'inventoryLoss',
  );
  const scrapLoc = await upsertChild(
    tenantId, createdBy, locMap['Virtual Locations'],
    'Scrap', 'الخردة', 'scrap', { isScrapLocation: true },
  );
  await upsertChild(tenantId, createdBy, locMap['Virtual Locations'], 'Production', 'الإنتاج', 'production');

  return {
    physicalRoot: locMap['Physical Locations'],
    partnerRoot: locMap['Partner Locations'],
    virtualRoot: locMap['Virtual Locations'],
    vendorLoc,
    customerLoc,
    inventoryAdjLoc,
    scrapLoc,
  };
}

async function upsertChild(tenantId, createdBy, parent, name, nameAr, usage, extra = {}) {
  const completePath = `${parent.completePath}/${name}`;
  let loc = await InvLocation.findOne({ tenantId, completePath });
  if (!loc) {
    loc = await InvLocation.create({
      tenantId,
      name,
      nameAr,
      parentId: parent._id,
      completePath,
      usage,
      createdBy,
      ...extra,
    });
  }
  return loc;
}

/**
 * Create location tree + 1-step operation types for a warehouse.
 */
export async function bootstrapWarehouse(tenantId, warehouse, roots = null, createdBy = null) {
  const tid = toObjectId(tenantId);
  const wh = warehouse._id ? warehouse : await Warehouse.findOne({ _id: warehouse, tenantId: tid });
  if (!wh) throw new Error('Warehouse not found');

  const r = roots || await ensureVirtualRoots(tid, createdBy);
  const code = (wh.code || 'WH').toUpperCase();

  const whView = await upsertChild(tid, createdBy, r.physicalRoot, code, wh.nameAr || code, 'view');
  const whStock = await upsertChild(tid, createdBy, whView, 'Stock', 'المخزون', 'internal');

  await InvLocation.updateMany(
    { _id: { $in: [whView._id, whStock._id] } },
    { $set: { warehouseId: wh._id } },
  );

  const opDefs = [
    {
      name: 'Receipts',
      nameAr: 'الاستلامات',
      code: 'incoming',
      sequencePrefix: `${code}/IN`,
      sequenceCode: `${code}/IN`,
      defaultSourceLocationId: r.vendorLoc._id,
      defaultDestLocationId: whStock._id,
      cardColor: '#0d9488',
      useCreateLots: true,
      useExistingLots: true,
    },
    {
      name: 'Delivery Orders',
      nameAr: 'أوامر التسليم',
      code: 'outgoing',
      sequencePrefix: `${code}/OUT`,
      sequenceCode: `${code}/OUT`,
      defaultSourceLocationId: whStock._id,
      defaultDestLocationId: r.customerLoc._id,
      cardColor: '#0284c7',
      useExistingLots: true,
    },
    {
      name: 'Internal Transfers',
      nameAr: 'تحويلات داخلية',
      code: 'internal',
      sequencePrefix: `${code}/INT`,
      sequenceCode: `${code}/INT`,
      defaultSourceLocationId: whStock._id,
      defaultDestLocationId: whStock._id,
      cardColor: '#7c3aed',
    },
    {
      name: 'Inventory Adjustments',
      nameAr: 'تسويات المخزون',
      code: 'internal',
      sequencePrefix: `${code}/ADJ`,
      sequenceCode: `${code}/ADJ`,
      defaultSourceLocationId: r.inventoryAdjLoc._id,
      defaultDestLocationId: whStock._id,
      cardColor: '#b45309',
      reservationMethod: 'manual',
    },
  ];

  for (const ot of opDefs) {
    const existing = await InvOperationType.findOne({ tenantId: tid, sequenceCode: ot.sequenceCode });
    if (!existing) {
      await InvOperationType.create({
        tenantId: tid,
        warehouseId: wh._id,
        name: ot.name,
        nameAr: ot.nameAr,
        code: ot.code,
        sequencePrefix: ot.sequencePrefix,
        sequenceCode: ot.sequenceCode,
        defaultSourceLocationId: ot.defaultSourceLocationId,
        defaultDestLocationId: ot.defaultDestLocationId,
        useCreateLots: ot.useCreateLots || false,
        useExistingLots: ot.useExistingLots || false,
        reservationMethod: ot.reservationMethod || 'atConfirm',
        createBackorder: 'ask',
        cardColor: ot.cardColor,
        createdBy,
      });
    }
    await ensureSequence(tid, ot.sequenceCode, ot.sequencePrefix);
  }

  // Wire return operation types: Receipts ↔ Deliveries
  const receiptOt = await InvOperationType.findOne({ tenantId: tid, sequenceCode: `${code}/IN` });
  const deliveryOt = await InvOperationType.findOne({ tenantId: tid, sequenceCode: `${code}/OUT` });
  if (receiptOt && deliveryOt) {
    if (!receiptOt.returnOperationTypeId) {
      receiptOt.returnOperationTypeId = deliveryOt._id;
      await receiptOt.save();
    }
    if (!deliveryOt.returnOperationTypeId) {
      deliveryOt.returnOperationTypeId = receiptOt._id;
      await deliveryOt.save();
    }
  }

  wh.viewLocationId = whView._id;
  wh.stockLocationId = whStock._id;
  wh.inputLocationId = whStock._id;
  wh.outputLocationId = whStock._id;
  wh.receptionSteps = wh.receptionSteps || 'one';
  wh.deliverySteps = wh.deliverySteps || 'ship';
  wh.engineBootstrappedAt = new Date();
  await wh.save();

  return { warehouse: wh, stockLocation: whStock, viewLocation: whView };
}

export async function getDefaultUom(tenantId) {
  await ensureInventoryBootstrap(tenantId);
  const tid = toObjectId(tenantId);
  const cat = await InvUomCategory.findOne({ tenantId: tid, name: 'Units' });
  if (!cat) return null;
  return InvUom.findOne({ tenantId: tid, categoryId: cat._id, uomType: 'reference' });
}

export async function enableEngine(tenantId, userId = null) {
  await ensureInventoryBootstrap(tenantId, userId);
  const settings = await InvSettings.findOneAndUpdate(
    { tenantId: toObjectId(tenantId) },
    { $set: { engineEnabled: true, updatedBy: userId || undefined } },
    { new: true },
  );
  return settings;
}
