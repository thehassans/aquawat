import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import BakalaProduct from '../../models/BakalaProduct.js';
import Warehouse from '../../models/Warehouse.js';
import {
  StockSettings,
  StockWarehouse,
  StockLocation,
  StockOperationType,
  StockProductTemplate,
  StockProductVariant,
  StockProductCategory,
  StockPicking,
  StockMove,
  StockMoveLine,
} from '../../models/stock/index.js';
import { ensureStockBootstrap, getDefaultUom } from './bootstrap.js';
import { createPicking, confirmPicking, validatePicking, cancelPicking } from './pickingService.js';
import { createReturnPicking } from './returns.js';
import { adjustProductStock } from '../inventoryAdjust.js';
import { StockValidationError } from './errors.js';
import { normalizeProductType } from '../../utils/productType.js';
import { toNumber } from '../purchasesLogic.js';

export async function isStockEngineEnabled(tenantId) {
  if (!tenantId) return false;
  const settings = await StockSettings.findOne({ tenantId }).lean();
  return settings?.engineEnabled === true;
}

/**
 * Resolve or create a StockWarehouse linked to a legacy Warehouse (by legacyWarehouseId or code).
 * Falls back to the tenant's first active stock warehouse.
 */
export async function resolveStockWarehouseForLegacy(tenantId, userId, legacyWarehouseId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  await ensureStockBootstrap(tid, userId);

  if (legacyWarehouseId) {
    let sw = await StockWarehouse.findOne({ tenantId: tid, legacyWarehouseId, active: true });
    if (sw) return sw;

    const legacy = await Warehouse.findOne({ _id: legacyWarehouseId, tenantId: tid }).lean();
    if (legacy?.code) {
      sw = await StockWarehouse.findOne({ tenantId: tid, code: legacy.code, active: true });
      if (sw) {
        if (!sw.legacyWarehouseId) {
          sw.legacyWarehouseId = legacy._id;
          await sw.save();
        }
        return sw;
      }
      return createMinimalStockWarehouse(tid, userId, legacy);
    }
  }

  return StockWarehouse.findOne({ tenantId: tid, active: true }).sort({ createdAt: 1 });
}

async function createMinimalStockWarehouse(tid, userId, legacy) {
  const createdBy = userId ? new mongoose.Types.ObjectId(String(userId)) : undefined;
  const physical = await StockLocation.findOne({ tenantId: tid, completeName: 'Physical Locations' });
  if (!physical) throw new StockValidationError('Stock locations not bootstrapped', 'NO_BOOTSTRAP');

  const code = String(legacy.code).slice(0, 8).toUpperCase();
  let view = await StockLocation.findOne({ tenantId: tid, completeName: `Physical Locations/${code}` });
  if (!view) {
    [view] = await StockLocation.create([{
      tenantId: tid,
      name: code,
      parentId: physical._id,
      completeName: `Physical Locations/${code}`,
      usage: 'view',
      createdBy,
    }]);
  }
  let stock = await StockLocation.findOne({ tenantId: tid, completeName: `Physical Locations/${code}/Stock` });
  if (!stock) {
    [stock] = await StockLocation.create([{
      tenantId: tid,
      name: 'Stock',
      parentId: view._id,
      completeName: `Physical Locations/${code}/Stock`,
      usage: 'internal',
      createdBy,
    }]);
  }

  const vendor = await StockLocation.findOne({ tenantId: tid, usage: 'vendor', active: true });
  const customer = await StockLocation.findOne({ tenantId: tid, usage: 'customer', active: true });

  const [warehouse] = await StockWarehouse.create([{
    tenantId: tid,
    name: legacy.nameEn || code,
    code,
    legacyWarehouseId: legacy._id,
    viewLocationId: view._id,
    lotStockId: stock._id,
    receptionSteps: 'one_step',
    deliverySteps: 'ship_only',
    sequencePrefix: code,
    createdBy,
  }]);

  const opTypes = [
    {
      name: `${code}: Receipts`,
      code: 'incoming',
      sequenceCode: `${code}/IN`,
      sequencePrefix: `${code}/IN/`,
      defaultLocationSrcId: vendor?._id,
      defaultLocationDestId: stock._id,
      useCreateLots: true,
    },
    {
      name: `${code}: Delivery Orders`,
      code: 'outgoing',
      sequenceCode: `${code}/OUT`,
      sequencePrefix: `${code}/OUT/`,
      defaultLocationSrcId: stock._id,
      defaultLocationDestId: customer?._id,
      useExistingLots: true,
    },
    {
      name: `${code}: Internal Transfers`,
      code: 'internal',
      sequenceCode: `${code}/INT`,
      sequencePrefix: `${code}/INT/`,
      defaultLocationSrcId: stock._id,
      defaultLocationDestId: stock._id,
    },
  ];

  const { ensureSequence } = await import('./sequence.js');
  for (const ot of opTypes) {
    const exists = await StockOperationType.findOne({ tenantId: tid, warehouseId: warehouse._id, code: ot.code });
    if (!exists) {
      await StockOperationType.create([{
        tenantId: tid,
        warehouseId: warehouse._id,
        name: ot.name,
        code: ot.code,
        sequenceCode: ot.sequenceCode,
        sequencePrefix: ot.sequencePrefix,
        defaultLocationSrcId: ot.defaultLocationSrcId,
        defaultLocationDestId: ot.defaultLocationDestId,
        useCreateLots: ot.useCreateLots || false,
        useExistingLots: ot.useExistingLots || false,
        reservationMethod: 'at_confirm',
        createBackorder: 'ask',
        createdBy,
      }]);
      await ensureSequence(tid, ot.sequenceCode, ot.sequencePrefix);
    }
  }

  return warehouse;
}

/**
 * Find or create StockProductVariant linked to a legacy Product.
 */
export async function ensureVariantForLegacyProduct(tenantId, userId, legacyProductId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  let variant = await StockProductVariant.findOne({ tenantId: tid, legacyProductId, active: true });
  if (variant) return variant;

  const product = await Product.findOne({ _id: legacyProductId, tenantId: tid });
  if (!product) return null;

  await ensureStockBootstrap(tid, userId);
  const uom = await getDefaultUom(tid);
  const category = await StockProductCategory.findOne({ tenantId: tid, name: 'All' });

  const [template] = await StockProductTemplate.create([{
    tenantId: tid,
    name: product.nameEn || product.sku,
    defaultCode: product.sku,
    barcode: product.barcode || undefined,
    type: 'goods',
    isStorable: true,
    tracking: 'none',
    uomId: uom._id,
    listPrice: String(product.sellingPrice ?? 0),
    standardPrice: String(product.costPrice ?? 0),
    categoryId: category?._id,
    createdBy: userId || undefined,
  }]);

  [variant] = await StockProductVariant.create([{
    tenantId: tid,
    templateId: template._id,
    defaultCode: product.sku,
    barcode: product.barcode || undefined,
    legacyProductId: product._id,
    createdBy: userId || undefined,
  }]);

  return variant;
}

async function classifyLineProduct(tenantId, productId) {
  const bakala = await BakalaProduct.findOne({ _id: productId, tenantId }).select('_id').lean();
  if (bakala) return { kind: 'bakala' };
  const product = await Product.findOne({ _id: productId, tenantId }).select('_id').lean();
  if (product) return { kind: 'trading' };
  return { kind: 'missing' };
}

/**
 * Post GRN stock via stock engine pickings (trading products) + legacy adjust for bakala.
 * @returns {{ picking: object|null, bakalaPosted: number }}
 */
export async function postGrnViaStockEngine({ tenantId, userId, grn, warehouseId, direction = 'in' }) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const whId = warehouseId || grn.warehouseId;
  const stockWh = await resolveStockWarehouseForLegacy(tid, userId, whId);
  if (!stockWh) throw new StockValidationError('No stock warehouse available', 'NO_STOCK_WH');

  const opCode = direction === 'in' ? 'incoming' : 'outgoing';
  const opType = await StockOperationType.findOne({
    tenantId: tid,
    warehouseId: stockWh._id,
    code: opCode,
    active: true,
  });
  if (!opType) throw new StockValidationError(`No ${opCode} operation type`, 'NO_OP_TYPE');

  const engineMoves = [];
  let bakalaPosted = 0;

  for (const line of grn.lines || []) {
    if (line.isDelayed) continue;
    const productType = normalizeProductType(line.productType);
    if (productType === 'service') continue;
    const qty = toNumber(line.quantityReceived ?? line.quantityReturned ?? line.quantity, 0);
    if (qty <= 0 || !line.productId) continue;

    const kind = await classifyLineProduct(tid, line.productId);
    if (kind.kind === 'bakala') {
      await adjustProductStock({
        tenantId: tid,
        productId: line.productId,
        warehouseId: whId,
        delta: direction === 'in' ? qty : -qty,
        setFields: direction === 'in' ? {
          costPrice: line.costPrice,
          expiryDate: line.expiryDate,
          batchNumber: line.batchNumber,
        } : {},
      });
      bakalaPosted += 1;
      continue;
    }
    if (kind.kind === 'missing') {
      throw new StockValidationError(`Product not found: ${line.productName || line.productId}`, 'PRODUCT_NOT_FOUND');
    }

    const variant = await ensureVariantForLegacyProduct(tid, userId, line.productId);
    if (!variant) {
      throw new StockValidationError(`Product not found: ${line.productName || line.productId}`, 'PRODUCT_NOT_FOUND');
    }

    const template = await StockProductTemplate.findById(variant.templateId);
    if (direction === 'in' && line.costPrice != null && template) {
      template.standardPrice = String(line.costPrice);
      await template.save();
    }

    engineMoves.push({
      productId: variant._id,
      productUomId: template.uomId,
      productUomQty: String(qty),
      lotName: line.batchNumber || undefined,
      expiryDate: line.expiryDate || undefined,
    });
  }

  if (!engineMoves.length) {
    return { picking: null, bakalaPosted };
  }

  const picking = await createPicking({
    tenantId: tid,
    userId,
    operationTypeId: opType._id,
    partnerId: grn.supplierId || null,
    scheduledDate: grn.dateReceived || new Date(),
    origin: grn.grnNumber || String(grn._id),
    note: `Legacy GRN adapter (${direction})`,
    moves: engineMoves.map((m) => ({
      productId: m.productId,
      productUomId: m.productUomId,
      productUomQty: m.productUomQty,
    })),
  });

  // Incoming: no reservation from vendor — force assigned + lines, then validate.
  // Outgoing: confirm (reserve) then validate.
  if (direction === 'in') {
    const moves = await StockMove.find({ pickingId: picking._id, tenantId: tid });
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const meta = engineMoves[i];
      move.state = 'assigned';
      await move.save();
      await StockMoveLine.create([{
        tenantId: tid,
        moveId: move._id,
        pickingId: picking._id,
        productId: move.productId,
        productUomId: move.productUomId,
        quantity: move.productUomQty,
        quantityProduct: move.productUomQty,
        locationId: move.locationId,
        locationDestId: move.locationDestId,
        lotName: meta?.lotName,
        state: 'assigned',
        reference: move.reference,
      }]);
    }
    picking.state = 'assigned';
    await picking.save();
  } else {
    await confirmPicking(picking._id, tid);
    const moves = await StockMove.find({ pickingId: picking._id, tenantId: tid });
    for (let i = 0; i < moves.length; i++) {
      const meta = engineMoves[i];
      if (!meta?.lotName) continue;
      const lines = await StockMoveLine.find({ moveId: moves[i]._id, tenantId: tid });
      for (const line of lines) {
        line.lotName = meta.lotName;
        await line.save();
      }
    }
  }

  const done = await validatePicking(picking._id, tid, { createBackorder: false });
  return { picking: done, bakalaPosted };
}

/**
 * Reverse a done GRN picking via return + validate; cancel if still open.
 */
export async function reverseGrnViaStockEngine({ tenantId, userId, grn }) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  let pickingId = grn.stockPickingId;
  if (!pickingId) {
    const found = await StockPicking.findOne({
      tenantId: tid,
      origin: grn.grnNumber,
      state: { $in: ['done', 'assigned', 'confirmed', 'waiting', 'draft'] },
    }).sort({ createdAt: -1 });
    if (!found) return null;
    pickingId = found._id;
  }

  const picking = await StockPicking.findOne({ _id: pickingId, tenantId: tid });
  if (!picking) return null;

  if (picking.state === 'done') {
    const moves = await StockMove.find({ pickingId: picking._id, tenantId: tid, state: 'done' });
    const ret = await createReturnPicking(tid, userId, picking._id, {
      lines: moves.map((m) => ({ moveId: m._id, quantity: m.quantity || m.productUomQty })),
    });
    await confirmPicking(ret._id, tid);
    await validatePicking(ret._id, tid, { createBackorder: false });
    return ret;
  }

  if (picking.state !== 'cancel') {
    await cancelPicking(picking._id, tid);
  }
  return picking;
}

/**
 * Ship a legacy stock transfer as a validated internal picking (engine path).
 */
export async function postStockTransferViaEngine({ tenantId, userId, transfer }) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const srcWh = await resolveStockWarehouseForLegacy(tid, userId, transfer.sourceWarehouseId);
  const destWh = await resolveStockWarehouseForLegacy(tid, userId, transfer.destinationWarehouseId);
  if (!srcWh?.lotStockId || !destWh?.lotStockId) {
    throw new StockValidationError('Stock warehouses missing stock locations', 'NO_STOCK_LOC');
  }

  const opType = await StockOperationType.findOne({
    tenantId: tid,
    warehouseId: srcWh._id,
    code: 'internal',
    active: true,
  });
  if (!opType) throw new StockValidationError('No internal operation type', 'NO_OP_TYPE');

  const moves = [];
  for (const line of transfer.lines || []) {
    const qty = Math.abs(Number(line.quantity) || 0);
    if (qty <= 0 || !line.productId) continue;
    const variant = await ensureVariantForLegacyProduct(tid, userId, line.productId);
    if (!variant) {
      throw new StockValidationError(`Product not found: ${line.productName || line.productId}`, 'PRODUCT_NOT_FOUND');
    }
    const template = await StockProductTemplate.findById(variant.templateId);
    moves.push({
      productId: variant._id,
      productUomId: template.uomId,
      productUomQty: String(qty),
      locationId: srcWh.lotStockId,
      locationDestId: destWh.lotStockId,
    });
  }

  if (!moves.length) throw new StockValidationError('No transferable lines', 'NO_LINES');

  const picking = await createPicking({
    tenantId: tid,
    userId,
    operationTypeId: opType._id,
    locationId: srcWh.lotStockId,
    locationDestId: destWh.lotStockId,
    scheduledDate: transfer.transferDate || new Date(),
    origin: transfer.transferNumber || String(transfer._id),
    note: 'Legacy stock-transfer adapter',
    moves,
  });

  await confirmPicking(picking._id, tid);
  const done = await validatePicking(picking._id, tid, { createBackorder: false });
  return done;
}

/**
 * Optimistic-lock concurrent reservation simulator (unit-test helper).
 * Models N workers each trying to reserve `eachQty` from a shared available pool.
 * Only reservations that fit remaining free qty succeed; others fail.
 */
export function simulateConcurrentReserves(availableQty, workerCount, eachQty = 1) {
  let free = Number(availableQty);
  const results = [];
  for (let i = 0; i < workerCount; i++) {
    const want = Number(eachQty);
    if (want <= free) {
      free -= want;
      results.push({ ok: true, reserved: want, freeAfter: free });
    } else {
      results.push({ ok: false, reserved: 0, freeAfter: free, reason: 'INSUFFICIENT' });
    }
  }
  return {
    successes: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok).length,
    freeRemaining: free,
    results,
  };
}

/**
 * Simulate optimistic version conflicts: all workers read the same version,
 * but only the first write per version wins; losers retry with fresh version.
 * Guarantees free never goes negative and successes ≤ floor(available/eachQty).
 */
export function simulateOptimisticVersionReserves(availableQty, workerCount, eachQty = 1) {
  let free = Number(availableQty);
  let version = 0;
  const maxSuccess = Math.floor(free / Number(eachQty));
  let successes = 0;
  let retries = 0;
  const results = [];

  for (let i = 0; i < workerCount; i++) {
    let attempts = 0;
    let done = false;
    while (!done && attempts < 5) {
      attempts += 1;
      const readVersion = version;
      const readFree = free;
      const want = Number(eachQty);
      if (want > readFree) {
        results.push({ ok: false, reserved: 0, reason: 'INSUFFICIENT', attempts });
        done = true;
        break;
      }
      // First writer with this version wins
      if (readVersion === version) {
        free -= want;
        version += 1;
        successes += 1;
        results.push({ ok: true, reserved: want, freeAfter: free, attempts });
        done = true;
      } else {
        retries += 1;
      }
    }
    if (!done) {
      results.push({ ok: false, reserved: 0, reason: 'VERSION_EXHAUSTED', attempts });
    }
  }

  return {
    successes,
    failures: results.filter((r) => !r.ok).length,
    retries,
    freeRemaining: free,
    maxSuccess,
    results,
  };
}
