/**
 * Minimal tenant bootstrap for v4 A.3 integration tests.
 * Requires replica-set Mongo (STOCK_TEST_MONGODB_URI or MONGODB_URI).
 */
import mongoose from 'mongoose';
import Warehouse from '../../models/Warehouse.js';
import Product from '../../models/Product.js';
import Customer from '../../models/Customer.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import InvScrap from '../../models/inventory/InvScrap.js';
import InvLot from '../../models/inventory/InvLot.js';
import InvLandedCost from '../../models/inventory/InvLandedCost.js';
import InvValuationLayer from '../../models/inventory/InvValuationLayer.js';
import InvProductCategory from '../../models/inventory/InvProductCategory.js';
import InvSequence from '../../models/inventory/InvSequence.js';
import {
  ensureInventoryBootstrap,
  bootstrapWarehouse,
  enableEngine,
  getDefaultUom,
} from '../../services/inventory/bootstrap.js';
import { recomputeWarehouseRoutes } from '../../services/inventory/warehouseSteps.js';
import { createTransfer } from '../../services/inventory/createTransfer.js';
import { confirmTransfer, validateTransfer } from '../../services/inventory/transferService.js';
import { nextProductId } from '../../services/inventory/productIdentity.js';
import { setDecimalPair } from '../../models/inventory/common.js';
import { decStr } from '../../utils/decimal.js';

export const uri = process.env.STOCK_TEST_MONGODB_URI || process.env.MONGODB_URI;

export async function mongoSupportsTransactions() {
  if (!uri) return false;
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection('_inv_test_txn_probe').insertOne({ probe: true }, { session });
      });
      await db.collection('_inv_test_txn_probe').deleteMany({ probe: true });
      return true;
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes('replica set') || msg.includes('mongos')) return false;
      throw err;
    } finally {
      session.endSession();
    }
  } finally {
    await mongoose.disconnect();
  }
}

export async function resolveIntegrationSkip() {
  if (!uri) return 'Set STOCK_TEST_MONGODB_URI to run A.3 integration tests';
  try {
    const ok = await mongoSupportsTransactions();
    if (!ok) return 'MongoDB replica set required for A.3 integration tests';
    return false;
  } catch (err) {
    return `Mongo unavailable: ${err.message}`;
  }
}

async function loadOpTypes(tenantId, warehouseId) {
  const incoming = await InvOperationType.findOne({
    tenantId,
    warehouseId,
    code: 'incoming',
  }).lean();
  const outgoing = await InvOperationType.findOne({
    tenantId,
    warehouseId,
    code: 'outgoing',
  }).lean();
  const code = (await Warehouse.findById(warehouseId).select('code').lean())?.code?.toUpperCase() || 'WH';
  const storeOt = await InvOperationType.findOne({
    tenantId,
    warehouseId,
    sequenceCode: `${code}/STORE`,
    active: true,
  }).lean();
  return { incoming, outgoing, storeOt };
}

export async function bootstrapTestTenant(tag = 'a3', { receptionSteps = 'one' } = {}) {
  const tenantId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  await ensureInventoryBootstrap(tenantId, userId);
  await enableEngine(tenantId, userId);

  const wh = await Warehouse.create({
    tenantId,
    code: tag.toUpperCase().slice(0, 8),
    nameEn: 'Integration Test WH',
    nameAr: 'مستودع اختبار',
    isPrimary: true,
    isActive: true,
    receptionSteps,
    deliverySteps: 'ship',
  });
  await bootstrapWarehouse(tenantId, wh, null, userId);

  if (receptionSteps !== 'one') {
    try {
      await recomputeWarehouseRoutes(wh._id, tenantId, userId);
    } catch (err) {
      const msg = String(err?.message || err);
      if (!msg.includes('replica set') && !msg.includes('Transaction')) throw err;
    }
  }

  const warehouse = await Warehouse.findById(wh._id).lean();

  const uom = await getDefaultUom(tenantId);
  const fifoCat = await InvProductCategory.create({
    tenantId,
    name: `${tag} FIFO`,
    completePath: `${tag}/FIFO`,
    costingMethod: 'fifo',
    valuationMode: 'automated',
  });

  const products = [];
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    products.push(await Product.create({
      tenantId,
      productId: await nextProductId(tenantId),
      sku: `${tag}-SKU-${i + 1}`,
      nameEn: `Test Product ${i + 1}`,
      nameAr: `منتج ${i + 1}`,
      tracking: 'none',
      uomId: uom._id,
      categoryId: i === 0 ? fifoCat._id : undefined,
      trackInventory: true,
      productType: 'goods',
      status: 'active',
      sellingPrice: 10,
      costPrice: 5,
    }));
  }

  const lotProduct = await Product.create({
    tenantId,
    productId: await nextProductId(tenantId),
    sku: `${tag}-LOT-1`,
    nameEn: 'Lot Tracked Product',
    tracking: 'lot',
    uomId: uom._id,
    trackInventory: true,
    productType: 'goods',
    status: 'active',
  });

  const expiryProduct = await Product.create({
    tenantId,
    productId: await nextProductId(tenantId),
    sku: `${tag}-EXP-1`,
    nameEn: 'Expiry Product',
    tracking: 'lot',
    useExpirationDate: true,
    expirationDays: 14,
    removalDays: 12,
    uomId: uom._id,
    trackInventory: true,
    productType: 'goods',
    status: 'active',
  });

  await InvSettings.findOneAndUpdate(
    { tenantId },
    {
      $set: {
        groupProductionLot: true,
        groupStockTrackingLot: true,
        moduleQuality: false,
        groupLandedCosts: true,
      },
    },
  );

  const { incoming, outgoing, storeOt } = await loadOpTypes(tenantId, warehouse._id);

  const customer = await Customer.create({
    tenantId,
    customerCode: `${tag}-C1`,
    name: 'Test Customer',
    type: 'business',
    isActive: true,
  });

  return {
    tenantId,
    userId,
    warehouse,
    products,
    lotProduct,
    expiryProduct,
    fifoCat,
    incoming,
    outgoing,
    storeOt,
    customer,
    stockLocationId: warehouse.stockLocationId,
    inputLocationId: warehouse.inputLocationId || incoming?.defaultDestLocationId,
    vendorLocationId: incoming?.defaultSourceLocationId,
    customerLocationId: outgoing?.defaultDestLocationId,
  };
}

export async function quantOnHand(tenantId, productId, locationId, { variantId = null, lotId = null } = {}) {
  const q = await InvQuant.findOne({
    tenantId,
    productId,
    locationId,
    variantId: variantId || null,
    lotId: lotId || null,
  }).lean();
  return q ? decStr(q.quantity) : '0';
}

/** Receipt stock into default WH location (one-step incoming). */
export async function seedStockViaReceipt(ctx, productId, qty, tag = 'seed') {
  const transfer = await createTransfer(ctx.tenantId, {
    operationTypeId: ctx.incoming._id,
    lines: [{ productId, demandQty: String(qty) }],
    origin: tag,
  }, ctx.userId);
  await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);
  await validateTransfer(ctx.tenantId, transfer._id, { userId: ctx.userId, immediate: true });
  return transfer;
}

/** Receipt lot-tracked stock with named lot (useCreateLots). */
export async function seedLotStockViaReceipt(ctx, productId, qty, lotName, tag = 'seed-lot') {
  await InvOperationType.updateOne(
    { _id: ctx.incoming._id },
    { $set: { useCreateLots: true } },
  );
  const transfer = await createTransfer(ctx.tenantId, {
    operationTypeId: ctx.incoming._id,
    lines: [{ productId, demandQty: String(qty) }],
    origin: tag,
  }, ctx.userId);
  await confirmTransfer(ctx.tenantId, transfer._id, ctx.userId);
  const move = await InvMove.findOne({ tenantId: ctx.tenantId, transferId: transfer._id });
  const defaultUom = await getDefaultUom(ctx.tenantId);
  const product = await Product.findById(productId).lean();
  await InvMoveLine.create([{
    tenantId: ctx.tenantId,
    moveId: move._id,
    transferId: transfer._id,
    productId,
    uomId: product?.uomId || defaultUom?._id,
    quantity: String(qty),
    quantityInProductUom: String(qty),
    sourceLocationId: move.sourceLocationId,
    destLocationId: move.destLocationId,
    lotName,
    state: 'assigned',
    reference: move.reference,
    createdBy: ctx.userId,
  }]);
  await validateTransfer(ctx.tenantId, transfer._id, { userId: ctx.userId, immediate: false });
  const lot = await InvLot.findOne({ tenantId: ctx.tenantId, productId, name: lotName }).lean();
  return { transfer, lot };
}

export async function seedLotQuant(tenantId, productId, locationId, lotId, qty) {
  const doc = {
    tenantId,
    productId,
    locationId,
    lotId,
    variantId: null,
    packageId: null,
    ownerId: null,
    version: 0,
  };
  setDecimalPair(doc, 'quantity', String(qty));
  setDecimalPair(doc, 'reservedQuantity', '0');
  setDecimalPair(doc, 'value', '0');
  await InvQuant.create([doc]);
}

export async function findQuantId(tenantId, productId, locationId, lotId = null) {
  const q = await InvQuant.findOne({
    tenantId,
    productId,
    locationId,
    variantId: null,
    lotId: lotId || null,
  }).select('_id').lean();
  return q?._id || null;
}

export async function cleanupTestTenant(tenantId) {
  const tid = tenantId;
  await InvValuationLayer.deleteMany({ tenantId: tid });
  await InvLandedCost.deleteMany({ tenantId: tid });
  await InvScrap.deleteMany({ tenantId: tid });
  await InvMoveLine.deleteMany({ tenantId: tid });
  await InvMove.deleteMany({ tenantId: tid });
  await InvTransfer.deleteMany({ tenantId: tid });
  await InvQuant.deleteMany({ tenantId: tid });
  await InvLot.deleteMany({ tenantId: tid });
  await InvSequence.deleteMany({ tenantId: tid });
  await InvOperationType.deleteMany({ tenantId: tid });
  await InvLocation.deleteMany({ tenantId: tid });
  await InvProductCategory.deleteMany({ tenantId: tid });
  await Product.deleteMany({ tenantId: tid });
  await Customer.deleteMany({ tenantId: tid });
  await Warehouse.deleteMany({ tenantId: tid });
  await InvSettings.deleteMany({ tenantId: tid });
}
