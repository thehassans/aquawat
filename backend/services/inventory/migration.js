import { D, decStr } from '../../utils/decimal.js';
import Product from '../../models/Product.js';
import Warehouse from '../../models/Warehouse.js';
import {
  InvMigrationCursor,
  InvOperationType,
  InvLocation,
  InvSettings,
} from '../../models/inventory/index.js';
import { toObjectId } from '../../models/inventory/common.js';
import { ensureInventoryBootstrap, getDefaultUom, enableEngine } from './bootstrap.js';
import { createTransfer } from './createTransfer.js';
import { confirmTransfer, validateTransfer } from './transferService.js';
import { InventoryValidationError } from './errors.js';

/**
 * Migrate Product.stocks[] balances into opening-balance Transfers.
 * Idempotent via InvMigrationCursor. Does not write quants directly.
 */
export async function migrateOpeningBalances(tenantId, {
  userId = null,
  batchSize = 50,
  enableEngineAfter = false,
} = {}) {
  const tid = toObjectId(tenantId);
  await ensureInventoryBootstrap(tid, userId);

  const defaultUom = await getDefaultUom(tid);
  if (!defaultUom) throw new InventoryValidationError('Default UoM missing', 'UOM_REQUIRED');

  const warehouses = await Warehouse.find({ tenantId: tid, isActive: true });
  const whById = new Map(warehouses.map((w) => [String(w._id), w]));

  // Resolve inventory adjustment location + adj op type per warehouse
  const adjLoc = await InvLocation.findOne({
    tenantId: tid,
    usage: 'inventoryLoss',
    completePath: /Inventory adjustment$/,
  });
  if (!adjLoc) throw new InventoryValidationError('Inventory adjustment location missing — bootstrap first', 'ADJ_LOC_MISSING');

  const products = await Product.find({
    tenantId: tid,
    productType: 'goods',
    isActive: { $ne: false },
  }).select('_id sku nameEn stocks uomId unitOfMeasure costPrice trackInventory');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  const details = [];

  for (const product of products) {
    if (product.trackInventory === false) {
      skipped += 1;
      continue;
    }

    const stocks = Array.isArray(product.stocks) ? product.stocks : [];
    for (const stock of stocks) {
      const qty = D(stock.quantity || 0);
      if (qty.isZero()) {
        skipped += 1;
        continue;
      }

      const warehouseId = stock.warehouseId;
      if (!warehouseId || !whById.has(String(warehouseId))) {
        skipped += 1;
        continue;
      }

      const existing = await InvMigrationCursor.findOne({
        tenantId: tid,
        productId: product._id,
        warehouseId,
      });
      if (existing?.status === 'done') {
        skipped += 1;
        continue;
      }

      const wh = whById.get(String(warehouseId));
      if (!wh.stockLocationId) {
        errors += 1;
        details.push({ productId: product._id, warehouseId, error: 'Warehouse not bootstrapped' });
        continue;
      }

      const opType = await InvOperationType.findOne({
        tenantId: tid,
        warehouseId: wh._id,
        sequenceCode: `${(wh.code || 'WH').toUpperCase()}/ADJ`,
      });
      if (!opType) {
        errors += 1;
        details.push({ productId: product._id, warehouseId, error: 'Adjustment op type missing' });
        continue;
      }

      const cursorDoc = {
        tenantId: tid,
        productId: product._id,
        warehouseId,
        legacyQuantity: decStr(qty),
        status: 'pending',
        createdBy: userId,
      };

      try {
        const isPositive = qty.gt(0);
        const transfer = await createTransfer(tid, {
          operationTypeId: opType._id,
          sourceLocationId: isPositive ? adjLoc._id : wh.stockLocationId,
          destLocationId: isPositive ? wh.stockLocationId : adjLoc._id,
          origin: `Opening balance ${product.sku || product._id}`,
          note: 'Migrated from Product.stocks[]',
          sourceModel: 'migration',
          sourceDocId: product._id,
          lines: [{
            productId: product._id,
            demandQty: decStr(qty.abs()),
            uomId: product.uomId || defaultUom._id,
          }],
        }, userId);

        await confirmTransfer(tid, transfer._id, userId);
        // Immediate validate — creates move lines for full demand if none reserved
        await validateTransfer(tid, transfer._id, {
          userId,
          immediate: true,
          createBackorder: false,
        });

        await InvMigrationCursor.findOneAndUpdate(
          { tenantId: tid, productId: product._id, warehouseId },
          {
            $set: {
              ...cursorDoc,
              status: 'done',
              transferId: transfer._id,
              errorMessage: null,
            },
          },
          { upsert: true },
        );

        // Link product uom if missing
        if (!product.uomId) {
          await Product.updateOne({ _id: product._id }, { $set: { uomId: defaultUom._id } });
        }

        migrated += 1;
        if (migrated >= batchSize) {
          break;
        }
      } catch (err) {
        errors += 1;
        await InvMigrationCursor.findOneAndUpdate(
          { tenantId: tid, productId: product._id, warehouseId },
          {
            $set: {
              ...cursorDoc,
              status: 'error',
              errorMessage: err.message,
            },
          },
          { upsert: true },
        );
        details.push({ productId: product._id, warehouseId, error: err.message });
      }
    }
    if (migrated >= batchSize) break;
  }

  let settings = await InvSettings.findOne({ tenantId: tid });
  if (enableEngineAfter) {
    settings = await enableEngine(tid, userId);
  }

  return {
    migrated,
    skipped,
    errors,
    details: details.slice(0, 50),
    engineEnabled: settings?.engineEnabled === true,
    hasMore: migrated >= batchSize,
  };
}
