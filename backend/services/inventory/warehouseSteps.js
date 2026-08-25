import {
  InvLocation,
  InvOperationType,
  InvRoute,
  InvRule,
} from '../../models/inventory/index.js';
import Warehouse from '../../models/Warehouse.js';
import { ensureSequence } from './sequence.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

async function upsertChild(session, tid, userId, parent, name, nameAr, usage, warehouseId) {
  const completePath = `${parent.completePath}/${name}`;
  let loc = await InvLocation.findOne({ tenantId: tid, completePath }).session(session);
  if (!loc) {
    const [created] = await InvLocation.create([{
      tenantId: tid,
      name,
      nameAr,
      parentId: parent._id,
      completePath,
      usage,
      warehouseId,
      createdBy: userId,
    }], { session });
    loc = created;
  } else if (!loc.warehouseId && warehouseId) {
    loc.warehouseId = warehouseId;
    await loc.save({ session });
  }
  return loc;
}

async function upsertOpType(session, tid, userId, wh, def) {
  let ot = await InvOperationType.findOne({
    tenantId: tid,
    warehouseId: wh._id,
    sequenceCode: def.sequenceCode,
  }).session(session);

  if (!ot) {
    const [created] = await InvOperationType.create([{
      tenantId: tid,
      warehouseId: wh._id,
      name: def.name,
      nameAr: def.nameAr,
      code: def.code,
      sequencePrefix: def.sequencePrefix,
      sequenceCode: def.sequenceCode,
      defaultSourceLocationId: def.defaultSourceLocationId,
      defaultDestLocationId: def.defaultDestLocationId,
      reservationMethod: 'atConfirm',
      createBackorder: 'ask',
      active: true,
      createdBy: userId,
    }], { session });
    ot = created;
    await ensureSequence(tid, def.sequenceCode, def.sequencePrefix);
  } else {
    ot.defaultSourceLocationId = def.defaultSourceLocationId;
    ot.defaultDestLocationId = def.defaultDestLocationId;
    ot.active = true;
    ot.name = def.name;
    if (def.nameAr) ot.nameAr = def.nameAr;
    await ot.save({ session });
  }
  return ot;
}

async function upsertRouteRule(session, tid, userId, {
  routeName,
  warehouseId,
  ruleName,
  action,
  operationTypeId,
  sourceLocationId,
  destLocationId,
  procureMethod = 'makeToStock',
  sequence = 20,
}) {
  let route = await InvRoute.findOne({
    tenantId: tid,
    name: routeName,
    warehouseIds: warehouseId,
  }).session(session);

  if (!route) {
    const [created] = await InvRoute.create([{
      tenantId: tid,
      name: routeName,
      sequence: 10,
      active: true,
      warehouseIds: [warehouseId],
      createdBy: userId,
    }], { session });
    route = created;
  } else if (!route.active) {
    route.active = true;
    await route.save({ session });
  }

  let rule = await InvRule.findOne({
    tenantId: tid,
    routeId: route._id,
    name: ruleName,
  }).session(session);

  if (!rule) {
    await InvRule.create([{
      tenantId: tid,
      name: ruleName,
      routeId: route._id,
      sequence,
      action,
      operationTypeId,
      sourceLocationId,
      destLocationId,
      procureMethod,
      active: true,
      createdBy: userId,
    }], { session });
  } else {
    rule.operationTypeId = operationTypeId;
    rule.sourceLocationId = sourceLocationId;
    rule.destLocationId = destLocationId;
    rule.action = action;
    rule.procureMethod = procureMethod;
    rule.active = true;
    await rule.save({ session });
  }

  return route;
}

/**
 * Recompute warehouse locations, op types, routes and rules for reception/delivery steps.
 * In-flight transfers keep original locations; new ops apply going forward.
 */
export async function recomputeWarehouseRoutes(warehouseId, tenantId, userId = null) {
  const mongoose = (await import('mongoose')).default;
  const tid = toObjectId(tenantId);
  const wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid });
  if (!wh) throw new InventoryValidationError('Warehouse not found', 'WH_NOT_FOUND');
  if (!wh.viewLocationId || !wh.stockLocationId) {
    throw new InventoryValidationError('Warehouse not bootstrapped', 'WH_NOT_BOOTSTRAPPED');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const view = await InvLocation.findById(wh.viewLocationId).session(session);
    const stock = await InvLocation.findById(wh.stockLocationId).session(session);
    if (!view || !stock) throw new InventoryValidationError('Warehouse locations incomplete', 'WH_LOCS');

    const vendor = await InvLocation.findOne({
      tenantId: tid,
      usage: 'vendor',
      completePath: /Vendors$/,
    }).session(session);
    const customer = await InvLocation.findOne({
      tenantId: tid,
      usage: 'customer',
      completePath: /Customers$/,
    }).session(session);

    const code = (wh.code || 'WH').toUpperCase();
    const input = await upsertChild(session, tid, userId, view, 'Input', 'المدخل', 'internal', wh._id);
    const qc = await upsertChild(session, tid, userId, view, 'Quality Control', 'مراقبة الجودة', 'internal', wh._id);
    const pack = await upsertChild(session, tid, userId, view, 'Packing', 'التعبئة', 'internal', wh._id);
    const output = await upsertChild(session, tid, userId, view, 'Output', 'المخرج', 'internal', wh._id);

    await InvOperationType.updateMany(
      {
        tenantId: tid,
        warehouseId: wh._id,
        sequenceCode: { $in: [`${code}/QC`, `${code}/STORE`, `${code}/PICK`, `${code}/PACK`] },
      },
      { $set: { active: false } },
      { session },
    );

    // Deactivate step routes from prior config (keep Buy / Resupply)
    await InvRoute.updateMany(
      {
        tenantId: tid,
        warehouseIds: wh._id,
        name: { $regex: /^(Receive|Ship|Pick|Pack|Store|QC)\b/ },
      },
      { $set: { active: false } },
      { session },
    );

    const receiptOt = await InvOperationType.findOne({
      tenantId: tid,
      warehouseId: wh._id,
      code: 'incoming',
      sequenceCode: `${code}/IN`,
    }).session(session) || await InvOperationType.findOne({
      tenantId: tid,
      warehouseId: wh._id,
      code: 'incoming',
    }).session(session);

    const deliveryOt = await InvOperationType.findOne({
      tenantId: tid,
      warehouseId: wh._id,
      code: 'outgoing',
    }).session(session);

    const reception = wh.receptionSteps || 'one';
    const delivery = wh.deliverySteps || 'ship';

    // Reception
    if (receiptOt && vendor) {
      if (reception === 'one') {
        receiptOt.defaultSourceLocationId = vendor._id;
        receiptOt.defaultDestLocationId = stock._id;
        wh.inputLocationId = stock._id;
        wh.qualityLocationId = null;
        await receiptOt.save({ session });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Receive ${code}`,
          warehouseId: wh._id,
          ruleName: 'Vendors → Stock',
          action: 'pull',
          operationTypeId: receiptOt._id,
          sourceLocationId: vendor._id,
          destLocationId: stock._id,
        });
      } else if (reception === 'two') {
        receiptOt.defaultSourceLocationId = vendor._id;
        receiptOt.defaultDestLocationId = input._id;
        wh.inputLocationId = input._id;
        wh.qualityLocationId = null;
        await receiptOt.save({ session });
        const storeOt = await upsertOpType(session, tid, userId, wh, {
          name: 'Put Away',
          nameAr: 'تخزين',
          code: 'internal',
          sequencePrefix: `${code}/STORE`,
          sequenceCode: `${code}/STORE`,
          defaultSourceLocationId: input._id,
          defaultDestLocationId: stock._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Receive ${code}`,
          warehouseId: wh._id,
          ruleName: 'Vendors → Input',
          action: 'pull',
          operationTypeId: receiptOt._id,
          sourceLocationId: vendor._id,
          destLocationId: input._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Store ${code}`,
          warehouseId: wh._id,
          ruleName: 'Input → Stock',
          action: 'push',
          operationTypeId: storeOt._id,
          sourceLocationId: input._id,
          destLocationId: stock._id,
          sequence: 30,
        });
      } else {
        // three: Vendor → Input → QC → Stock
        receiptOt.defaultSourceLocationId = vendor._id;
        receiptOt.defaultDestLocationId = input._id;
        wh.inputLocationId = input._id;
        wh.qualityLocationId = qc._id;
        await receiptOt.save({ session });
        const qcOt = await upsertOpType(session, tid, userId, wh, {
          name: 'Quality Control',
          nameAr: 'مراقبة الجودة',
          code: 'internal',
          sequencePrefix: `${code}/QC`,
          sequenceCode: `${code}/QC`,
          defaultSourceLocationId: input._id,
          defaultDestLocationId: qc._id,
        });
        const storeOt = await upsertOpType(session, tid, userId, wh, {
          name: 'Put Away',
          nameAr: 'تخزين',
          code: 'internal',
          sequencePrefix: `${code}/STORE`,
          sequenceCode: `${code}/STORE`,
          defaultSourceLocationId: qc._id,
          defaultDestLocationId: stock._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Receive ${code}`,
          warehouseId: wh._id,
          ruleName: 'Vendors → Input',
          action: 'pull',
          operationTypeId: receiptOt._id,
          sourceLocationId: vendor._id,
          destLocationId: input._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `QC ${code}`,
          warehouseId: wh._id,
          ruleName: 'Input → QC',
          action: 'push',
          operationTypeId: qcOt._id,
          sourceLocationId: input._id,
          destLocationId: qc._id,
          sequence: 25,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Store ${code}`,
          warehouseId: wh._id,
          ruleName: 'QC → Stock',
          action: 'push',
          operationTypeId: storeOt._id,
          sourceLocationId: qc._id,
          destLocationId: stock._id,
          sequence: 30,
        });
      }
    }

    // Delivery
    if (deliveryOt && customer) {
      if (delivery === 'ship') {
        deliveryOt.defaultSourceLocationId = stock._id;
        deliveryOt.defaultDestLocationId = customer._id;
        wh.outputLocationId = stock._id;
        wh.packingLocationId = null;
        await deliveryOt.save({ session });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Ship ${code}`,
          warehouseId: wh._id,
          ruleName: 'Stock → Customers',
          action: 'pull',
          operationTypeId: deliveryOt._id,
          sourceLocationId: stock._id,
          destLocationId: customer._id,
        });
      } else if (delivery === 'pickShip') {
        deliveryOt.defaultSourceLocationId = output._id;
        deliveryOt.defaultDestLocationId = customer._id;
        wh.outputLocationId = output._id;
        wh.packingLocationId = null;
        await deliveryOt.save({ session });
        const pickOt = await upsertOpType(session, tid, userId, wh, {
          name: 'Pick',
          nameAr: 'انتقاء',
          code: 'internal',
          sequencePrefix: `${code}/PICK`,
          sequenceCode: `${code}/PICK`,
          defaultSourceLocationId: stock._id,
          defaultDestLocationId: output._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Pick ${code}`,
          warehouseId: wh._id,
          ruleName: 'Stock → Output',
          action: 'pull',
          operationTypeId: pickOt._id,
          sourceLocationId: stock._id,
          destLocationId: output._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Ship ${code}`,
          warehouseId: wh._id,
          ruleName: 'Output → Customers',
          action: 'pull',
          operationTypeId: deliveryOt._id,
          sourceLocationId: output._id,
          destLocationId: customer._id,
          sequence: 30,
        });
      } else {
        // pickPackShip
        deliveryOt.defaultSourceLocationId = output._id;
        deliveryOt.defaultDestLocationId = customer._id;
        wh.outputLocationId = output._id;
        wh.packingLocationId = pack._id;
        await deliveryOt.save({ session });
        const pickOt = await upsertOpType(session, tid, userId, wh, {
          name: 'Pick',
          nameAr: 'انتقاء',
          code: 'internal',
          sequencePrefix: `${code}/PICK`,
          sequenceCode: `${code}/PICK`,
          defaultSourceLocationId: stock._id,
          defaultDestLocationId: pack._id,
        });
        const packOt = await upsertOpType(session, tid, userId, wh, {
          name: 'Pack',
          nameAr: 'تعبئة',
          code: 'internal',
          sequencePrefix: `${code}/PACK`,
          sequenceCode: `${code}/PACK`,
          defaultSourceLocationId: pack._id,
          defaultDestLocationId: output._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Pick ${code}`,
          warehouseId: wh._id,
          ruleName: 'Stock → Pack',
          action: 'pull',
          operationTypeId: pickOt._id,
          sourceLocationId: stock._id,
          destLocationId: pack._id,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Pack ${code}`,
          warehouseId: wh._id,
          ruleName: 'Pack → Output',
          action: 'push',
          operationTypeId: packOt._id,
          sourceLocationId: pack._id,
          destLocationId: output._id,
          sequence: 25,
        });
        await upsertRouteRule(session, tid, userId, {
          routeName: `Ship ${code}`,
          warehouseId: wh._id,
          ruleName: 'Output → Customers',
          action: 'pull',
          operationTypeId: deliveryOt._id,
          sourceLocationId: output._id,
          destLocationId: customer._id,
          sequence: 30,
        });
      }
    }

    // Buy route (stock location)
    if (wh.buyToResupply !== false && stock) {
      await upsertRouteRule(session, tid, userId, {
        routeName: `Buy ${code}`,
        warehouseId: wh._id,
        ruleName: 'Buy for Stock',
        action: 'buy',
        operationTypeId: null,
        sourceLocationId: null,
        destLocationId: stock._id,
        sequence: 10,
      });
    }

    // Inter-warehouse resupply routes
    for (const supplierWhId of wh.resupplyFromWarehouseIds || []) {
      const supplierWh = await Warehouse.findOne({ _id: supplierWhId, tenantId: tid }).session(session);
      if (!supplierWh?.stockLocationId || !stock) continue;
      const intOt = await InvOperationType.findOne({
        tenantId: tid,
        warehouseId: wh._id,
        code: 'internal',
        sequenceCode: `${code}/INT`,
      }).session(session);
      const routeName = `Resupply ${code} from ${supplierWh.code || supplierWh.name}`;
      let route = await InvRoute.findOne({ tenantId: tid, name: routeName }).session(session);
      if (!route) {
        const [created] = await InvRoute.create([{
          tenantId: tid,
          name: routeName,
          sequence: 15,
          active: true,
          warehouseIds: [wh._id, supplierWh._id],
          suppliedWarehouseId: wh._id,
          supplierWarehouseId: supplierWh._id,
          createdBy: userId,
        }], { session });
        route = created;
      } else {
        route.active = true;
        route.suppliedWarehouseId = wh._id;
        route.supplierWarehouseId = supplierWh._id;
        await route.save({ session });
      }
      let rule = await InvRule.findOne({
        tenantId: tid,
        routeId: route._id,
        destLocationId: stock._id,
      }).session(session);
      if (!rule) {
        await InvRule.create([{
          tenantId: tid,
          name: `${supplierWh.code || 'SUP'} → ${code}`,
          routeId: route._id,
          sequence: 20,
          action: 'pull',
          operationTypeId: intOt?._id || null,
          sourceLocationId: supplierWh.stockLocationId,
          destLocationId: stock._id,
          procureMethod: 'makeToStock',
          active: true,
          createdBy: userId,
        }], { session });
      } else {
        rule.sourceLocationId = supplierWh.stockLocationId;
        rule.operationTypeId = intOt?._id || null;
        rule.active = true;
        await rule.save({ session });
      }
    }

    await wh.save({ session });
    await session.commitTransaction();
    return wh;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
