import mongoose from 'mongoose';
import {
  StockWarehouse,
  StockLocation,
  StockOperationType,
  StockRoute,
  StockRule,
} from '../../models/stock/index.js';
import { ensureSequence } from './sequence.js';
import { StockValidationError } from './errors.js';

/**
 * Recompute warehouse locations, operation types, routes and rules for reception/delivery steps.
 * Existing in-flight pickings keep their original locations (we don't migrate them).
 * New op types / rules apply going forward.
 */
export async function recomputeWarehouseRoutes(warehouseId, tenantId, userId = null) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const wh = await StockWarehouse.findOne({ _id: warehouseId, tenantId: tid });
  if (!wh) throw new StockValidationError('Warehouse not found', 'WH_NOT_FOUND');

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const view = await StockLocation.findById(wh.viewLocationId).session(session);
    const stock = await StockLocation.findById(wh.lotStockId).session(session);
    if (!view || !stock) throw new StockValidationError('Warehouse locations incomplete', 'WH_LOCS');

    const vendor = await StockLocation.findOne({
      tenantId: tid,
      usage: 'vendor',
      completeName: /Vendors$/,
    }).session(session);
    const customer = await StockLocation.findOne({
      tenantId: tid,
      usage: 'customer',
      completeName: /Customers$/,
    }).session(session);

    // Ensure step locations
    const input = await ensureWhChild(session, tid, userId, wh, view, 'Input', 'internal', 'whInputId');
    const qc = await ensureWhChild(session, tid, userId, wh, view, 'Quality Control', 'internal', 'whQcId');
    const pack = await ensureWhChild(session, tid, userId, wh, view, 'Packing', 'internal', 'whPackId');
    const output = await ensureWhChild(session, tid, userId, wh, view, 'Output', 'internal', 'whOutputId');

    // Archive step-specific op types (keep classic IN/OUT/INT)
    await StockOperationType.updateMany(
      {
        tenantId: tid,
        warehouseId: wh._id,
        sequenceCode: { $in: ['WH/QC', 'WH/PACK', 'WH/PICK', 'WH/STORE'] },
      },
      { $set: { active: false } },
      { session },
    );

    // Update main receipt/delivery defaults based on steps
    const receiptOt = await StockOperationType.findOne({
      tenantId: tid,
      warehouseId: wh._id,
      code: 'incoming',
      sequenceCode: `${wh.code || 'WH'}/IN`,
    }).session(session) || await StockOperationType.findOne({
      tenantId: tid,
      warehouseId: wh._id,
      code: 'incoming',
    }).session(session);

    const deliveryOt = await StockOperationType.findOne({
      tenantId: tid,
      warehouseId: wh._id,
      code: 'outgoing',
    }).session(session);

    if (receiptOt && vendor) {
      if (wh.receptionSteps === 'one_step') {
        receiptOt.defaultLocationSrcId = vendor._id;
        receiptOt.defaultLocationDestId = stock._id;
        receiptOt.active = true;
      } else if (wh.receptionSteps === 'two_steps') {
        receiptOt.defaultLocationSrcId = vendor._id;
        receiptOt.defaultLocationDestId = input._id;
        await upsertOpType(session, tid, userId, wh, {
          name: 'Store',
          code: 'internal',
          sequencePrefix: `${wh.code || 'WH'}/STORE`,
          sequenceCode: 'WH/STORE',
          defaultLocationSrcId: input._id,
          defaultLocationDestId: stock._id,
        });
      } else {
        // three_steps: Vendor → Input → QC → Stock
        receiptOt.defaultLocationSrcId = vendor._id;
        receiptOt.defaultLocationDestId = input._id;
        await upsertOpType(session, tid, userId, wh, {
          name: 'Quality',
          code: 'internal',
          sequencePrefix: `${wh.code || 'WH'}/QC`,
          sequenceCode: 'WH/QC',
          defaultLocationSrcId: input._id,
          defaultLocationDestId: qc._id,
        });
        await upsertOpType(session, tid, userId, wh, {
          name: 'Store',
          code: 'internal',
          sequencePrefix: `${wh.code || 'WH'}/STORE`,
          sequenceCode: 'WH/STORE',
          defaultLocationSrcId: qc._id,
          defaultLocationDestId: stock._id,
        });
      }
      await receiptOt.save({ session });
    }

    if (deliveryOt && customer) {
      if (wh.deliverySteps === 'ship_only') {
        deliveryOt.defaultLocationSrcId = stock._id;
        deliveryOt.defaultLocationDestId = customer._id;
      } else if (wh.deliverySteps === 'pick_ship') {
        deliveryOt.defaultLocationSrcId = output._id;
        deliveryOt.defaultLocationDestId = customer._id;
        await upsertOpType(session, tid, userId, wh, {
          name: 'Pick',
          code: 'internal',
          sequencePrefix: `${wh.code || 'WH'}/PICK`,
          sequenceCode: 'WH/PICK',
          defaultLocationSrcId: stock._id,
          defaultLocationDestId: output._id,
        });
      } else {
        // pick_pack_ship
        deliveryOt.defaultLocationSrcId = output._id;
        deliveryOt.defaultLocationDestId = customer._id;
        await upsertOpType(session, tid, userId, wh, {
          name: 'Pick',
          code: 'internal',
          sequencePrefix: `${wh.code || 'WH'}/PICK`,
          sequenceCode: 'WH/PICK',
          defaultLocationSrcId: stock._id,
          defaultLocationDestId: pack._id,
        });
        await upsertOpType(session, tid, userId, wh, {
          name: 'Pack',
          code: 'internal',
          sequencePrefix: `${wh.code || 'WH'}/PACK`,
          sequenceCode: 'WH/PACK',
          defaultLocationSrcId: pack._id,
          defaultLocationDestId: output._id,
        });
      }
      await deliveryOt.save({ session });
    }

    // Rebuild warehouse receive/deliver routes
    await rebuildStepRoutes(session, tid, userId, wh, {
      stock, input, qc, pack, output, vendor, customer, receiptOt, deliveryOt,
    });

    await syncInterWarehouseResupply(session, tid, userId, wh, stock);

    await session.commitTransaction();
    return StockWarehouse.findById(wh._id).lean();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * For each resupplyWarehouseIds entry, ensure a pull route from supplier stock → this stock.
 */
async function syncInterWarehouseResupply(session, tenantId, userId, wh, stock) {
  const supplierIds = (wh.resupplyWarehouseIds || []).map((id) => String(id));

  // Deactivate obsolete inter-WH routes for this warehouse as supplied
  const existingRoutes = await StockRoute.find({
    tenantId,
    suppliedWhId: wh._id,
    supplierWhId: { $ne: null },
  }).session(session);

  for (const route of existingRoutes) {
    if (!supplierIds.includes(String(route.supplierWhId))) {
      route.active = false;
      await route.save({ session });
      await StockRule.updateMany(
        { tenantId, routeId: route._id },
        { $set: { active: false } },
        { session },
      );
    }
  }

  const internalOt = await StockOperationType.findOne({
    tenantId,
    warehouseId: wh._id,
    code: 'internal',
    active: true,
  }).session(session);

  for (const supplierId of supplierIds) {
    if (String(supplierId) === String(wh._id)) continue;
    const supplier = await StockWarehouse.findOne({
      _id: supplierId,
      tenantId,
      active: true,
    }).session(session);
    if (!supplier?.lotStockId) continue;

    const routeName = `${wh.code}: Resupply from ${supplier.code}`;
    let route = await StockRoute.findOne({
      tenantId,
      suppliedWhId: wh._id,
      supplierWhId: supplier._id,
    }).session(session);

    if (!route) {
      [route] = await StockRoute.create([{
        tenantId,
        name: routeName,
        sequence: 50,
        warehouseIds: [wh._id, supplier._id],
        warehouseSelectable: true,
        suppliedWhId: wh._id,
        supplierWhId: supplier._id,
        createdBy: userId,
      }], { session });
    } else {
      route.active = true;
      route.name = routeName;
      route.warehouseIds = [wh._id, supplier._id];
      await route.save({ session });
    }

    let rule = await StockRule.findOne({
      tenantId,
      routeId: route._id,
      action: 'pull',
      locationDestId: stock._id,
    }).session(session);

    if (!rule) {
      await StockRule.create([{
        tenantId,
        name: `${supplier.code} → ${wh.code}`,
        routeId: route._id,
        sequence: 10,
        action: 'pull',
        operationTypeId: internalOt?._id || null,
        locationSrcId: supplier.lotStockId,
        locationDestId: stock._id,
        procureMethod: 'make_to_stock',
        createdBy: userId,
      }], { session });
    } else {
      rule.active = true;
      rule.locationSrcId = supplier.lotStockId;
      rule.operationTypeId = internalOt?._id || rule.operationTypeId;
      await rule.save({ session });
    }
  }
}

async function ensureWhChild(session, tenantId, userId, wh, parent, name, usage, field) {
  const completeName = `${parent.completeName}/${name}`;
  let loc = await StockLocation.findOne({ tenantId, completeName }).session(session);
  if (!loc) {
    [loc] = await StockLocation.create([{
      tenantId,
      name,
      parentId: parent._id,
      completeName,
      usage,
      warehouseId: wh._id,
      createdBy: userId,
    }], { session });
  } else {
    loc.active = true;
    loc.warehouseId = wh._id;
    await loc.save({ session });
  }
  wh[field] = loc._id;
  await wh.save({ session });
  return loc;
}

async function upsertOpType(session, tenantId, userId, wh, def) {
  let ot = await StockOperationType.findOne({
    tenantId,
    warehouseId: wh._id,
    sequenceCode: def.sequenceCode,
  }).session(session);

  if (!ot) {
    [ot] = await StockOperationType.create([{
      tenantId,
      warehouseId: wh._id,
      ...def,
      reservationMethod: 'at_confirm',
      createBackorder: 'ask',
      useExistingLots: true,
      createdBy: userId,
    }], { session });
    await ensureSequence(tenantId, def.sequenceCode, def.sequencePrefix, session);
  } else {
    ot.name = def.name;
    ot.defaultLocationSrcId = def.defaultLocationSrcId;
    ot.defaultLocationDestId = def.defaultLocationDestId;
    ot.active = true;
    await ot.save({ session });
  }
  return ot;
}

async function rebuildStepRoutes(session, tenantId, userId, wh, locs) {
  const routeName = `${wh.code || 'WH'}: Receive in ${wh.receptionSteps.replace('_', ' ')}`;
  let route = await StockRoute.findOne({ tenantId, name: routeName }).session(session);
  if (!route) {
    [route] = await StockRoute.create([{
      tenantId,
      name: routeName,
      sequence: 5,
      warehouseSelectable: true,
      warehouseIds: [wh._id],
      createdBy: userId,
    }], { session });
  } else {
    route.active = true;
    route.warehouseIds = [wh._id];
    await route.save({ session });
  }

  // Clear old rules for this route
  await StockRule.deleteMany({ tenantId, routeId: route._id }).session(session);

  const { stock, input, qc, vendor, receiptOt } = locs;
  if (wh.receptionSteps === 'two_steps' && input && stock) {
    const storeOt = await StockOperationType.findOne({
      tenantId, warehouseId: wh._id, sequenceCode: 'WH/STORE', active: true,
    }).session(session);
    await StockRule.create([{
      tenantId,
      name: `${wh.code}: Input → Stock`,
      routeId: route._id,
      sequence: 20,
      action: 'push',
      operationTypeId: storeOt?._id,
      locationSrcId: input._id,
      locationDestId: stock._id,
      procureMethod: 'make_to_stock',
      createdBy: userId,
    }], { session });
  }
  if (wh.receptionSteps === 'three_steps' && input && qc && stock) {
    const qcOt = await StockOperationType.findOne({
      tenantId, warehouseId: wh._id, sequenceCode: 'WH/QC', active: true,
    }).session(session);
    const storeOt = await StockOperationType.findOne({
      tenantId, warehouseId: wh._id, sequenceCode: 'WH/STORE', active: true,
    }).session(session);
    await StockRule.create([
      {
        tenantId,
        name: `${wh.code}: Input → QC`,
        routeId: route._id,
        sequence: 10,
        action: 'push',
        operationTypeId: qcOt?._id,
        locationSrcId: input._id,
        locationDestId: qc._id,
        createdBy: userId,
      },
      {
        tenantId,
        name: `${wh.code}: QC → Stock`,
        routeId: route._id,
        sequence: 20,
        action: 'push',
        operationTypeId: storeOt?._id,
        locationSrcId: qc._id,
        locationDestId: stock._id,
        createdBy: userId,
      },
    ], { session });
  }

  // Delivery route
  const delName = `${wh.code || 'WH'}: Deliver in ${wh.deliverySteps.replace(/_/g, ' ')}`;
  let delRoute = await StockRoute.findOne({ tenantId, name: delName }).session(session);
  if (!delRoute) {
    [delRoute] = await StockRoute.create([{
      tenantId,
      name: delName,
      sequence: 6,
      warehouseIds: [wh._id],
      createdBy: userId,
    }], { session });
  }
  await StockRule.deleteMany({ tenantId, routeId: delRoute._id }).session(session);

  const { pack, output, customer, deliveryOt } = locs;
  if (wh.deliverySteps === 'pick_ship' && stock && output) {
    const pickOt = await StockOperationType.findOne({
      tenantId, warehouseId: wh._id, sequenceCode: 'WH/PICK', active: true,
    }).session(session);
    await StockRule.create([{
      tenantId,
      name: `${wh.code}: Stock → Output`,
      routeId: delRoute._id,
      sequence: 10,
      action: 'pull',
      operationTypeId: pickOt?._id,
      locationSrcId: stock._id,
      locationDestId: output._id,
      procureMethod: 'make_to_stock',
      createdBy: userId,
    }], { session });
  }
  if (wh.deliverySteps === 'pick_pack_ship' && stock && pack && output) {
    const pickOt = await StockOperationType.findOne({
      tenantId, warehouseId: wh._id, sequenceCode: 'WH/PICK', active: true,
    }).session(session);
    const packOt = await StockOperationType.findOne({
      tenantId, warehouseId: wh._id, sequenceCode: 'WH/PACK', active: true,
    }).session(session);
    await StockRule.create([
      {
        tenantId,
        name: `${wh.code}: Stock → Pack`,
        routeId: delRoute._id,
        sequence: 10,
        action: 'pull',
        operationTypeId: pickOt?._id,
        locationSrcId: stock._id,
        locationDestId: pack._id,
        createdBy: userId,
      },
      {
        tenantId,
        name: `${wh.code}: Pack → Output`,
        routeId: delRoute._id,
        sequence: 20,
        action: 'pull',
        operationTypeId: packOt?._id,
        locationSrcId: pack._id,
        locationDestId: output._id,
        createdBy: userId,
      },
    ], { session });
  }

  // Ensure a pull-from-stock rule for customer location replenishment (MTO delivery)
  if (customer && stock && deliveryOt) {
    let resupplyRoute = await StockRoute.findOne({
      tenantId,
      name: `${wh.code || 'WH'}: Resupply Stock`,
    }).session(session);
    if (!resupplyRoute) {
      [resupplyRoute] = await StockRoute.create([{
        tenantId,
        name: `${wh.code || 'WH'}: Resupply Stock`,
        sequence: 100,
        warehouseIds: [wh._id],
        createdBy: userId,
      }], { session });
    }
    const existing = await StockRule.findOne({
      tenantId,
      routeId: resupplyRoute._id,
      locationDestId: stock._id,
      action: 'buy',
    }).session(session);
    if (!existing) {
      await StockRule.create([{
        tenantId,
        name: `${wh.code}: Buy → Stock`,
        routeId: resupplyRoute._id,
        sequence: 10,
        action: 'buy',
        locationDestId: stock._id,
        locationSrcId: vendor?._id,
        procureMethod: 'make_to_order',
        createdBy: userId,
      }], { session });
    }
  }
}
