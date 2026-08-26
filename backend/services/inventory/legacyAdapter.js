import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import BakalaProduct from '../../models/BakalaProduct.js';
import Warehouse from '../../models/Warehouse.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import { toObjectId } from '../../models/inventory/common.js';
import { ensureInventoryBootstrap, bootstrapWarehouse, getDefaultUom } from './bootstrap.js';
import { createTransfer } from './createTransfer.js';
import { confirmTransfer, validateTransfer, cancelTransfer } from './transferService.js';
import { createReturnTransfer } from './returns.js';
import { adjustProductStock } from '../inventoryAdjust.js';
import { InventoryValidationError } from './errors.js';
import { normalizeProductType } from '../../utils/productType.js';
import { decStr } from '../../utils/decimal.js';

export async function isInvEngineEnabled(tenantId) {
  if (!tenantId) return false;
  const settings = await InvSettings.findOne({ tenantId: toObjectId(tenantId) }).lean();
  return settings?.engineEnabled === true;
}

async function ensureWarehouseReady(tenantId, userId, warehouseId) {
  const tid = toObjectId(tenantId);
  await ensureInventoryBootstrap(tid, userId);
  let wh = await Warehouse.findOne({ _id: warehouseId, tenantId: tid });
  if (!wh) throw new InventoryValidationError('Warehouse not found', 'NO_WAREHOUSE');
  if (!wh.stockLocationId || !wh.engineBootstrappedAt) {
    await bootstrapWarehouse(tid, wh, null, userId);
    wh = await Warehouse.findById(wh._id);
  }
  return wh;
}

async function resolveOpType(tenantId, warehouseId, code) {
  const tid = toObjectId(tenantId);
  const filter = {
    tenantId: tid,
    warehouseId: toObjectId(warehouseId),
    code,
    active: true,
    sequenceCode: { $not: /\/ADJ$/ },
  };
  const ot = await InvOperationType.findOne(filter);
  if (!ot) {
    throw new InventoryValidationError(`No ${code} operation type — bootstrap warehouse`, 'NO_OP_TYPE');
  }
  return ot;
}

async function classifyLineProduct(tenantId, productId) {
  const bakala = await BakalaProduct.findOne({ _id: productId, tenantId }).select('_id').lean();
  if (bakala) return { kind: 'bakala' };
  const product = await Product.findOne({ _id: productId, tenantId }).select('_id uomId trackInventory productType').lean();
  if (product) return { kind: 'trading', product };
  return { kind: 'missing' };
}

function toQty(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Post document lines through the inventory engine (trading) + legacy adjust (bakala).
 * direction: 'in' | 'out'
 */
export async function postLinesViaEngine({
  tenantId,
  userId,
  warehouseId,
  direction = 'in',
  lines,
  origin,
  note,
  partnerId,
  sourceModel,
  sourceDocId,
  idempotencyKey,
}) {
  const tid = toObjectId(tenantId);
  if (idempotencyKey) {
    const existing = await InvTransfer.findOne({
      tenantId: tid,
      origin: idempotencyKey,
      state: { $ne: 'cancelled' },
    }).lean();
    if (existing) {
      return { transfer: existing, bakalaPosted: 0, skipped: true };
    }
  }

  const wh = await ensureWarehouseReady(tid, userId, warehouseId);
  const opCode = direction === 'in' ? 'incoming' : 'outgoing';
  const opType = await resolveOpType(tid, wh._id, opCode);
  const defaultUom = await getDefaultUom(tid);

  const engineLines = [];
  let bakalaPosted = 0;

  for (const line of lines || []) {
    if (line.isDelayed) continue;
    const productType = normalizeProductType(line.productType);
    if (productType === 'service') continue;
    const qty = toQty(line.quantityReceived ?? line.quantityReturned ?? line.quantityDelivered ?? line.quantity ?? line.demandQty);
    if (qty <= 0 || !line.productId) continue;

    const kind = await classifyLineProduct(tid, line.productId);
    if (kind.kind === 'bakala') {
      await adjustProductStock({
        tenantId: tid,
        productId: line.productId,
        warehouseId,
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
    if (kind.kind !== 'trading') {
      throw new InventoryValidationError(
        `Product not found: ${line.productName || line.productId}`,
        'PRODUCT_NOT_FOUND',
      );
    }
    if (kind.product.trackInventory === false) continue;

    engineLines.push({
      productId: line.productId,
      variantId: line.variantId || undefined,
      demandQty: decStr(qty),
      uomId: kind.product.uomId || defaultUom?._id,
      sourceLineId: line._id ? String(line._id) : line.sourceLineId,
      unitCost: line.costPrice != null && line.costPrice !== ''
        ? String(line.costPrice)
        : (line.unitCost != null ? String(line.unitCost) : undefined),
    });
  }

  if (!engineLines.length) {
    return { transfer: null, bakalaPosted, skipped: !bakalaPosted };
  }

  // Ensure products have uomId for createTransfer
  for (const el of engineLines) {
    if (!el.uomId && defaultUom) {
      await Product.updateOne({ _id: el.productId, tenantId: tid, uomId: null }, { $set: { uomId: defaultUom._id } });
      el.uomId = defaultUom._id;
    }
  }

  const transfer = await createTransfer(tid, {
    operationTypeId: opType._id,
    partnerId: partnerId || null,
    origin: idempotencyKey || origin,
    note,
    sourceModel,
    sourceDocId: sourceDocId && mongoose.Types.ObjectId.isValid(String(sourceDocId))
      ? sourceDocId
      : undefined,
    lines: engineLines,
  }, userId);

  await confirmTransfer(tid, transfer._id, userId);
  const done = await validateTransfer(tid, transfer._id, {
    userId,
    immediate: true,
    createBackorder: false,
  });

  return { transfer: done, bakalaPosted, skipped: false };
}

/**
 * Reverse a previously posted engine transfer for a source document (GRN cancel).
 * Prefer cancelling if still open; otherwise create a return transfer and validate.
 */
export async function reverseDocumentViaEngine({
  tenantId,
  userId,
  sourceModel,
  sourceDocId,
  warehouseId,
  lines,
  origin,
  partnerId,
}) {
  const tid = toObjectId(tenantId);
  const existing = await InvTransfer.findOne({
    tenantId: tid,
    sourceModel,
    sourceDocId: toObjectId(sourceDocId),
    state: { $ne: 'cancelled' },
  }).sort({ createdAt: -1 });

  if (existing && existing.state !== 'done') {
    await cancelTransfer(tid, existing._id, userId);
    return { transfer: existing, mode: 'cancelled' };
  }

  if (existing && existing.state === 'done') {
    const wizardLines = (lines || []).map((line, idx) => {
      // map to move ids from existing transfer if possible — quantity-based return
      return {
        moveId: null,
        quantity: toQty(line.quantityReceived ?? line.quantityReturned ?? line.quantity),
        productId: line.productId,
      };
    }).filter((l) => l.quantity > 0);

    // Build return from done transfer
    const { getReturnWizard } = await import('./returns.js');
    const wiz = await getReturnWizard(tid, existing._id);
    const retLines = (wiz.lines || []).map((l) => {
      const match = wizardLines.find((w) => String(w.productId) === String(l.productId?._id || l.productId));
      return {
        moveId: l.moveId,
        quantity: match ? Math.min(match.quantity, toQty(l.quantityDone)) : l.quantityDone,
      };
    }).filter((l) => toQty(l.quantity) > 0);

    if (retLines.length) {
      const ret = await createReturnTransfer(tid, userId, existing._id, { lines: retLines });
      await confirmTransfer(tid, ret._id, userId);
      await validateTransfer(tid, ret._id, { userId, immediate: true, createBackorder: false });
      return { transfer: ret, mode: 'returned' };
    }
  }

  // Fallback: post opposite direction
  const direction = 'out';
  return postLinesViaEngine({
    tenantId: tid,
    userId,
    warehouseId,
    direction,
    lines,
    origin: origin || `Reverse ${sourceModel}`,
    partnerId,
    sourceModel: `${sourceModel}Reverse`,
    sourceDocId,
  });
}

/**
 * Idempotent PoS close → outgoing transfer.
 * offlineId / orderId used as idempotency key.
 */
export async function postPosSaleViaEngine({
  tenantId,
  userId,
  warehouseId,
  lines,
  orderId,
  offlineId,
  partnerId,
}) {
  const key = offlineId || orderId;
  if (!key) throw new InventoryValidationError('orderId or offlineId required', 'POS_ID_REQUIRED');

  return postLinesViaEngine({
    tenantId,
    userId,
    warehouseId,
    direction: 'out',
    lines: (lines || []).map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      productType: l.productType || 'goods',
    })),
    origin: `PoS ${key}`,
    note: 'Point of sale',
    partnerId,
    sourceModel: 'posOrder',
    sourceDocId: orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : undefined,
    idempotencyKey: `PoS ${key}`,
  });
}
