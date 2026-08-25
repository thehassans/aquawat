import InvOperationType from '../../models/inventory/InvOperationType.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import Warehouse from '../../models/Warehouse.js';
import { toObjectId } from '../../models/inventory/common.js';
import { createTransfer } from './createTransfer.js';
import { confirmTransfer, validateTransfer } from './transferService.js';
import { ensureInventoryBootstrap, bootstrapWarehouse } from './bootstrap.js';
import { InventoryValidationError } from './errors.js';

async function ensureWh(tenantId, userId, warehouseId) {
  let wh = await Warehouse.findOne({ _id: warehouseId, tenantId: toObjectId(tenantId) });
  if (!wh) throw new InventoryValidationError('Warehouse not found', 'WAREHOUSE_NOT_FOUND');
  if (!wh.stockLocationId) {
    await ensureInventoryBootstrap(tenantId, userId);
    await bootstrapWarehouse(tenantId, wh, null, userId);
    wh = await Warehouse.findById(wh._id);
  }
  return wh;
}

/**
 * PoS consume: create + confirm + validate outgoing/pos picking in one transaction chain.
 * Body: { orderRef, warehouseId, lines: [{ productId, qty }], partnerId? }
 */
export async function posConsume(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const wh = await ensureWh(tid, userId, body.warehouseId);
  const opType = await InvOperationType.findOne({
    tenantId: tid,
    warehouseId: wh._id,
    code: 'pos',
    active: true,
  });
  if (!opType) {
    throw new InventoryValidationError(
      'PoS operation type missing — bootstrap warehouse',
      'OP_TYPE_NOT_FOUND',
    );
  }

  const lines = (body.lines || []).map((l) => ({
    productId: l.productId,
    demandQty: l.qty ?? l.quantity ?? l.demandQty,
  }));
  if (!lines.length) throw new InventoryValidationError('Lines required', 'LINES_REQUIRED');

  const transfer = await createTransfer(tid, {
    operationTypeId: opType._id,
    sourceLocationId: opType.defaultSourceLocationId || wh.stockLocationId,
    destLocationId: opType.defaultDestLocationId,
    partnerId: body.partnerId || null,
    origin: body.orderRef || body.origin || undefined,
    note: body.note,
    lines,
  }, userId);

  await confirmTransfer(tid, transfer._id, userId);
  const done = await validateTransfer(tid, transfer._id, {
    userId,
    immediate: true,
    createBackorder: false,
  });
  return done;
}

/**
 * Manual MO: components leave stock → Production; finished goods Production → stock.
 * Body: { warehouseId, finishedProductId, finishedQty, components: [{ productId, qty }], origin? }
 */
export async function manufactureConsumeProduce(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const wh = await ensureWh(tid, userId, body.warehouseId);
  const production = await InvLocation.findOne({
    tenantId: tid,
    usage: 'production',
    active: { $ne: false },
  }).sort({ completePath: 1 });
  if (!production) {
    throw new InventoryValidationError('Production location missing — bootstrap inventory', 'LOCATIONS_REQUIRED');
  }

  const opType = await InvOperationType.findOne({
    tenantId: tid,
    warehouseId: wh._id,
    code: 'manufacturing',
    active: true,
  });
  if (!opType) {
    throw new InventoryValidationError(
      'Manufacturing operation type missing — bootstrap warehouse',
      'OP_TYPE_NOT_FOUND',
    );
  }

  const components = body.components || [];
  if (!components.length) {
    throw new InventoryValidationError('Component lines required', 'LINES_REQUIRED');
  }
  if (!body.finishedProductId || !(body.finishedQty > 0 || body.finishedQty === '0')) {
    // allow string decimals
    if (!body.finishedProductId || body.finishedQty == null || body.finishedQty === '') {
      throw new InventoryValidationError('Finished product and qty required', 'LINES_REQUIRED');
    }
  }

  // 1) Consume components: Stock → Production
  const consume = await createTransfer(tid, {
    operationTypeId: opType._id,
    sourceLocationId: wh.stockLocationId,
    destLocationId: production._id,
    origin: body.origin || 'MO-consume',
    note: body.note,
    lines: components.map((l) => ({
      productId: l.productId,
      demandQty: l.qty ?? l.quantity ?? l.demandQty,
    })),
  }, userId);
  await confirmTransfer(tid, consume._id, userId);
  const consumeDone = await validateTransfer(tid, consume._id, {
    userId,
    immediate: true,
    createBackorder: false,
  });

  // 2) Produce finished: Production → Stock
  const produce = await createTransfer(tid, {
    operationTypeId: opType._id,
    sourceLocationId: production._id,
    destLocationId: wh.stockLocationId,
    origin: body.origin || 'MO-produce',
    note: body.note,
    lines: [{
      productId: body.finishedProductId,
      demandQty: body.finishedQty,
    }],
  }, userId);
  await confirmTransfer(tid, produce._id, userId);
  const produceDone = await validateTransfer(tid, produce._id, {
    userId,
    immediate: true,
    createBackorder: false,
  });

  return { consume: consumeDone, produce: produceDone };
}
