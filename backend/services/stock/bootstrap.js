import mongoose from 'mongoose';
import {
  StockUomCategory,
  StockUom,
  StockLocation,
  StockWarehouse,
  StockOperationType,
  StockProductCategory,
  StockSettings,
} from '../../models/stock/index.js';
import { ensureSequence } from './sequence.js';

/**
 * Bootstrap default stock configuration for a tenant (idempotent).
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {import('mongoose').Types.ObjectId|string} [userId]
 */
export async function ensureStockBootstrap(tenantId, userId = null) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const createdBy = userId ? new mongoose.Types.ObjectId(String(userId)) : undefined;

  let settings = await StockSettings.findOne({ tenantId: tid });
    if (!settings) {
      settings = await StockSettings.create({ tenantId: tid, createdBy, engineEnabled: true });
    } else if (settings.engineEnabled !== true) {
      settings.engineEnabled = true;
      await settings.save();
    }

  const whCount = await StockWarehouse.countDocuments({ tenantId: tid, active: true });
  if (whCount > 0) {
    return { bootstrapped: false, settings };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // UoM
    let uomCat = await StockUomCategory.findOne({ tenantId: tid, name: 'Units' }).session(session);
    if (!uomCat) {
      [uomCat] = await StockUomCategory.create([{ tenantId: tid, name: 'Units', measureType: 'unit', createdBy }], { session });
    }
    let uom = await StockUom.findOne({ tenantId: tid, categoryId: uomCat._id, uomType: 'reference' }).session(session);
    if (!uom) {
      [uom] = await StockUom.create([{
        tenantId: tid,
        name: 'Units',
        categoryId: uomCat._id,
        uomType: 'reference',
        factor: '1',
        rounding: '0.01',
        createdBy,
      }], { session });
    }

    // Product category root
    let rootCat = await StockProductCategory.findOne({ tenantId: tid, name: 'All' }).session(session);
    if (!rootCat) {
      [rootCat] = await StockProductCategory.create([{
        tenantId: tid,
        name: 'All',
        completeName: 'All',
        createdBy,
      }], { session });
    }

    // Virtual / partner location roots
    const locDefs = [
      { name: 'Physical Locations', completeName: 'Physical Locations', usage: 'view' },
      { name: 'Partner Locations', completeName: 'Partner Locations', usage: 'view' },
      { name: 'Virtual Locations', completeName: 'Virtual Locations', usage: 'view' },
    ];
    const locMap = {};
    for (const def of locDefs) {
      let loc = await StockLocation.findOne({ tenantId: tid, completeName: def.completeName }).session(session);
      if (!loc) {
        [loc] = await StockLocation.create([{ tenantId: tid, ...def, createdBy }], { session });
      }
      locMap[def.name] = loc;
    }

    const vendorLoc = await upsertChildLocation(session, tid, createdBy, locMap['Partner Locations'], 'Vendors', 'vendor');
    const customerLoc = await upsertChildLocation(session, tid, createdBy, locMap['Partner Locations'], 'Customers', 'customer');
    const inventoryAdjLoc = await upsertChildLocation(session, tid, createdBy, locMap['Virtual Locations'], 'Inventory adjustment', 'inventory');
    const scrapLoc = await upsertChildLocation(session, tid, createdBy, locMap['Virtual Locations'], 'Scrap', 'inventory', { isScrapLocation: true });
    await upsertChildLocation(session, tid, createdBy, locMap['Virtual Locations'], 'Production', 'production');

    // Warehouse WH
    const whView = await upsertChildLocation(session, tid, createdBy, locMap['Physical Locations'], 'WH', 'view');
    const whStock = await upsertChildLocation(session, tid, createdBy, whView, 'Stock', 'internal');

    const [warehouse] = await StockWarehouse.create([{
      tenantId: tid,
      name: 'Main Warehouse',
      code: 'WH',
      viewLocationId: whView._id,
      lotStockId: whStock._id,
      receptionSteps: 'one_step',
      deliverySteps: 'ship_only',
      sequencePrefix: 'WH',
      createdBy,
    }], { session });

    await StockLocation.updateMany(
      { _id: { $in: [whView._id, whStock._id] } },
      { $set: { warehouseId: warehouse._id } },
      { session },
    );

    const opTypes = [
      {
        name: 'Receipts',
        code: 'incoming',
        sequencePrefix: 'WH/IN',
        sequenceCode: 'WH/IN',
        defaultLocationSrcId: vendorLoc._id,
        defaultLocationDestId: whStock._id,
        useCreateLots: true,
        useExistingLots: true,
      },
      {
        name: 'Delivery Orders',
        code: 'outgoing',
        sequencePrefix: 'WH/OUT',
        sequenceCode: 'WH/OUT',
        defaultLocationSrcId: whStock._id,
        defaultLocationDestId: customerLoc._id,
        useExistingLots: true,
      },
      {
        name: 'Internal Transfers',
        code: 'internal',
        sequencePrefix: 'WH/INT',
        sequenceCode: 'WH/INT',
        defaultLocationSrcId: whStock._id,
        defaultLocationDestId: whStock._id,
        useExistingLots: true,
      },
    ];

    for (const ot of opTypes) {
      await StockOperationType.create([{
        tenantId: tid,
        name: ot.name,
        code: ot.code,
        sequencePrefix: ot.sequencePrefix,
        sequenceCode: ot.sequenceCode,
        warehouseId: warehouse._id,
        defaultLocationSrcId: ot.defaultLocationSrcId,
        defaultLocationDestId: ot.defaultLocationDestId,
        useCreateLots: ot.useCreateLots || false,
        useExistingLots: ot.useExistingLots || false,
        reservationMethod: 'at_confirm',
        createBackorder: 'ask',
        createdBy,
      }], { session });
      await ensureSequence(tid, ot.sequenceCode, ot.sequencePrefix, session);
    }

    await session.commitTransaction();
    return { bootstrapped: true, settings, warehouse, uom, rootCat, vendorLoc, customerLoc, inventoryAdjLoc, scrapLoc };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function upsertChildLocation(session, tenantId, createdBy, parent, name, usage, extra = {}) {
  const completeName = `${parent.completeName}/${name}`;
  let loc = await StockLocation.findOne({ tenantId, completeName }).session(session);
  if (!loc) {
    [loc] = await StockLocation.create([{
      tenantId,
      name,
      parentId: parent._id,
      completeName,
      usage,
      createdBy,
      ...extra,
    }], { session });
  }
  return loc;
}

export async function getDefaultUom(tenantId) {
  await ensureStockBootstrap(tenantId);
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const cat = await StockUomCategory.findOne({ tenantId: tid, name: 'Units' });
  if (!cat) return null;
  return StockUom.findOne({ tenantId: tid, categoryId: cat._id, uomType: 'reference' });
}
