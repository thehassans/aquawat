import InvLot from '../../models/inventory/InvLot.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError } from './errors.js';

function addDays(from, days) {
  const x = new Date(from);
  x.setDate(x.getDate() + (Number(days) || 0));
  return x;
}

/**
 * Resolve existing lot or create from typed name (useCreateLots).
 */
export async function resolveOrCreateLot(session, tenantId, product, lotId, lotName, createdBy) {
  if (lotId) {
    const existing = await InvLot.findOne({
      _id: lotId,
      tenantId,
      productId: product._id,
    }).session(session);
    if (!existing) throw new InventoryValidationError('Lot not found', 'LOT_NOT_FOUND');
    return existing;
  }
  if (!lotName) return null;

  let lot = await InvLot.findOne({
    tenantId,
    productId: product._id,
    name: lotName,
  }).session(session);
  if (lot) return lot;

  const now = new Date();
  const dates = {};
  if (product.useExpirationDate) {
    if (product.expirationDays) dates.expirationDate = addDays(now, product.expirationDays);
    if (product.useByDays) dates.useByDate = addDays(now, product.useByDays);
    if (product.removalDays) dates.removalDate = addDays(now, product.removalDays);
    if (product.alertDays) dates.alertDate = addDays(now, product.alertDays);
  }

  [lot] = await InvLot.create([{
    tenantId,
    productId: product._id,
    name: lotName,
    ...dates,
    createdBy,
  }], { session });
  return lot;
}

/** Exclude expired lots unless settings allow (Phase 2: exclude by default). */
export function isLotExpired(lot, asOf = new Date()) {
  if (!lot) return false;
  const exp = lot.expirationDate || lot.removalDate;
  if (!exp) return false;
  return new Date(exp) < asOf;
}

export async function assertLotAllowedOnLine({
  product,
  lot,
  lotName,
  opType,
  direction, // 'in' | 'out'
  session,
  tenantId,
}) {
  if (!product || product.tracking === 'none') return;

  if (!lot && !lotName) {
    throw new InventoryValidationError(
      `Lot/serial required for ${product.nameEn || product.sku}`,
      'LOT_REQUIRED',
    );
  }

  if (opType?.useExistingLots && !lot && lotName) {
    const found = await InvLot.findOne({
      tenantId,
      productId: product._id,
      name: lotName,
    }).session(session);
    if (!found) {
      throw new InventoryValidationError(`Lot "${lotName}" does not exist`, 'LOT_NOT_FOUND');
    }
  }

  if (product.tracking === 'serial' && direction === 'in' && lot) {
    // serial must not already exist in an internal quant with qty > 0 — checked at validate
  }
}

export async function findLotById(tenantId, lotId) {
  return InvLot.findOne({ _id: toObjectId(lotId), tenantId: toObjectId(tenantId) });
}

export async function listLots(tenantId, { productId, q, page = 1, limit = 80 } = {}) {
  const filter = { tenantId: toObjectId(tenantId) };
  if (productId) filter.productId = productId;
  if (q) filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    InvLot.find(filter)
      .populate('productId', 'nameEn nameAr sku tracking')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    InvLot.countDocuments(filter),
  ]);
  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function createLot(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  const product = await Product.findOne({ _id: body.productId, tenantId: tid });
  if (!product) throw new InventoryValidationError('Product not found', 'PRODUCT_NOT_FOUND');
  if (!body.name) throw new InventoryValidationError('Lot name required', 'LOT_NAME_REQUIRED');

  try {
    return await InvLot.create({
      tenantId: tid,
      productId: product._id,
      name: body.name,
      ref: body.ref,
      expirationDate: body.expirationDate,
      useByDate: body.useByDate,
      removalDate: body.removalDate,
      alertDate: body.alertDate,
      note: body.note,
      createdBy: userId,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new InventoryValidationError('Lot name already exists for this product', 'LOT_DUPLICATE');
    }
    throw err;
  }
}

export async function lotsFeatureEnabled(tenantId) {
  const settings = await InvSettings.findOne({ tenantId: toObjectId(tenantId) }).lean();
  return settings?.groupStockTrackingLot === true;
}
