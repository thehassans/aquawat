/**
 * Manufacturing ↔ Inv* stock bridge.
 * Issue materials: Stock → Production
 * Receive FG: Production → Stock
 */
import Warehouse from '../../models/Warehouse.js';
import Product from '../../models/Product.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { ensureInventoryBootstrap, bootstrapWarehouse } from './bootstrap.js';
import { createTransfer } from './createTransfer.js';
import { confirmTransfer, validateTransfer } from './transferService.js';
import { isInvEngineEnabled } from './legacyAdapter.js';
import { syncProductStockCache } from './syncProductCache.js';
import { InventoryValidationError } from './errors.js';
import { adjustProductStock } from '../inventoryAdjust.js';
import { decStr } from '../../utils/decimal.js';

async function resolveWarehouse(tenantId, warehouseId, userId) {
  const tid = toObjectId(tenantId);
  await ensureInventoryBootstrap(tid, userId);

  let wh = null;
  if (warehouseId) {
    wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid });
  }
  if (!wh) {
    wh = await Warehouse.findOne({ tenantId: tid, isPrimary: true })
      || await Warehouse.findOne({ tenantId: tid }).sort({ createdAt: 1 });
  }
  if (!wh) {
    throw new InventoryValidationError(
      'No warehouse — create a warehouse before manufacturing stock moves',
      'NO_WAREHOUSE',
    );
  }
  if (!wh.stockLocationId || !wh.engineBootstrappedAt) {
    await bootstrapWarehouse(tid, wh, null, userId);
    wh = await Warehouse.findById(wh._id);
  }
  return wh;
}

async function getProductionLocation(tenantId) {
  const loc = await InvLocation.findOne({
    tenantId: toObjectId(tenantId),
    usage: 'production',
    active: { $ne: false },
  });
  if (!loc) {
    throw new InventoryValidationError(
      'Production location missing — enable inventory engine / run bootstrap',
      'NO_PRODUCTION',
    );
  }
  return loc;
}

async function getInternalOpType(tenantId, warehouse) {
  const code = (warehouse.code || 'WH').toUpperCase();
  const opType = await InvOperationType.findOne({
    tenantId: toObjectId(tenantId),
    sequenceCode: `${code}/INT`,
    active: { $ne: false },
  });
  if (!opType) {
    throw new InventoryValidationError(
      'Internal transfer operation type missing — bootstrap warehouse',
      'NO_OP_TYPE',
    );
  }
  return opType;
}

function materialLines(workOrder) {
  return (workOrder.issuedMaterials || [])
    .filter((m) => m.productId && Number(m.requiredQty || m.issuedQty || 0) > 0)
    .map((m) => ({
      productId: m.productId,
      demandQty: decStr(m.requiredQty || m.issuedQty || 0),
    }));
}

/**
 * Consume components from warehouse stock into Production (WIP).
 */
export async function issueWorkOrderMaterials(tenantId, workOrder, userId) {
  const lines = materialLines(workOrder);
  if (!lines.length) {
    throw new InventoryValidationError('No materials to issue', 'NO_MATERIALS');
  }

  const productIds = [...new Set(lines.map((l) => String(l.productId)))];

  if (await isInvEngineEnabled(tenantId)) {
    const wh = await resolveWarehouse(tenantId, workOrder.warehouseId, userId);
    const production = await getProductionLocation(tenantId);
    const opType = await getInternalOpType(tenantId, wh);

    const transfer = await createTransfer(tenantId, {
      operationTypeId: opType._id,
      sourceLocationId: wh.stockLocationId,
      destLocationId: production._id,
      origin: workOrder.orderNumber,
      note: `Manufacturing issue ${workOrder.orderNumber}`,
      sourceModel: 'ManufacturingWorkOrder',
      sourceDocId: workOrder._id,
      lines,
    }, userId);

    await confirmTransfer(tenantId, transfer._id, userId);
    await validateTransfer(tenantId, transfer._id, {
      userId,
      immediate: true,
      createBackorder: false,
    });

    for (const id of productIds) {
      await syncProductStockCache(tenantId, id);
    }

    return {
      engine: true,
      transferId: transfer._id,
      warehouseId: wh._id,
      actualMaterialCost: await sumMaterialCost(lines),
    };
  }

  const wh = await resolveWarehouse(tenantId, workOrder.warehouseId, userId).catch(() => null);
  let actualMaterialCost = 0;
  for (const line of lines) {
    const qty = Number(line.demandQty);
    if (wh) {
      await adjustProductStock({
        tenantId,
        productId: line.productId,
        warehouseId: wh._id,
        delta: -qty,
        allowLegacy: true,
      });
    }
    const product = await Product.findById(line.productId).select('costPrice');
    actualMaterialCost += (product?.costPrice || 0) * qty;
  }

  return {
    engine: false,
    warehouseId: wh?._id || null,
    actualMaterialCost: Number(actualMaterialCost.toFixed(2)),
  };
}

/**
 * Receive finished goods from Production into warehouse stock.
 */
export async function receiveWorkOrderFinishedGoods(tenantId, workOrder, userId, {
  quantity = null,
} = {}) {
  const qty = Number(quantity ?? workOrder.quantityProduced ?? workOrder.quantityPlanned ?? 0);
  if (!workOrder.productId || qty <= 0) {
    throw new InventoryValidationError('Finished product quantity required', 'NO_FG_QTY');
  }

  const lines = [{ productId: workOrder.productId, demandQty: decStr(qty) }];

  if (await isInvEngineEnabled(tenantId)) {
    const wh = await resolveWarehouse(tenantId, workOrder.warehouseId, userId);
    const production = await getProductionLocation(tenantId);
    const opType = await getInternalOpType(tenantId, wh);

    const transfer = await createTransfer(tenantId, {
      operationTypeId: opType._id,
      sourceLocationId: production._id,
      destLocationId: wh.stockLocationId,
      origin: workOrder.orderNumber,
      note: `Manufacturing receipt ${workOrder.orderNumber}`,
      sourceModel: 'ManufacturingWorkOrder',
      sourceDocId: workOrder._id,
      lines,
    }, userId);

    await confirmTransfer(tenantId, transfer._id, userId);
    await validateTransfer(tenantId, transfer._id, {
      userId,
      immediate: true,
      createBackorder: false,
    });

    await syncProductStockCache(tenantId, workOrder.productId);

    return {
      engine: true,
      transferId: transfer._id,
      warehouseId: wh._id,
      quantity: qty,
    };
  }

  const wh = await resolveWarehouse(tenantId, workOrder.warehouseId, userId).catch(() => null);
  if (wh) {
    await adjustProductStock({
      tenantId,
      productId: workOrder.productId,
      warehouseId: wh._id,
      delta: qty,
      allowLegacy: true,
    });
  }

  return {
    engine: false,
    warehouseId: wh?._id || null,
    quantity: qty,
  };
}

async function sumMaterialCost(lines) {
  let total = 0;
  for (const line of lines) {
    const product = await Product.findById(line.productId).select('costPrice');
    total += (product?.costPrice || 0) * Number(line.demandQty);
  }
  return Number(total.toFixed(2));
}
