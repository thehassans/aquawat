import mongoose from 'mongoose';
import { D, decStr, decIsZero } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import { setDecimalPair, toObjectId } from '../../models/inventory/common.js';
import { InventoryValidationError, InventoryConflictError } from './errors.js';

/**
 * Apply quantity / reserved deltas to a quant dimension key.
 * Uses optimistic version + Decimal128-aware sets.
 */
export async function applyQuantDelta(
  session,
  tenantId,
  productId,
  locationId,
  qtyDelta,
  reservedDelta = '0',
  inDate = new Date(),
  dims = {},
) {
  const tid = toObjectId(tenantId);
  const filter = {
    tenantId: tid,
    productId: toObjectId(productId),
    locationId: toObjectId(locationId),
    variantId: dims.variantId || null,
    lotId: dims.lotId || null,
    packageId: dims.packageId || null,
    ownerId: dims.ownerId || null,
  };

  let quant = await InvQuant.findOne(filter).session(session);

  if (!quant && D(qtyDelta).gt(0)) {
    if (dims.tracking === 'serial' && D(qtyDelta).gt(1)) {
      throw new InventoryValidationError('Serial-tracked quant cannot exceed quantity 1', 'SERIAL_QTY_EXCEEDED');
    }
    const doc = { ...filter, inDate, version: 0 };
    setDecimalPair(doc, 'quantity', qtyDelta);
    setDecimalPair(doc, 'reservedQuantity', reservedDelta);
    setDecimalPair(doc, 'value', '0');
    try {
      [quant] = await InvQuant.create([doc], { session });
      return quant;
    } catch (err) {
      if (err?.code === 11000) {
        quant = await InvQuant.findOne(filter).session(session);
        if (!quant) throw err;
      } else {
        throw err;
      }
    }
  }

  if (!quant) {
    throw new InventoryValidationError(`No quant for product at location ${locationId}`, 'QUANT_NOT_FOUND');
  }

  if (dims.tracking === 'serial' && D(qtyDelta).gt(0)) {
    if (D(quant.quantity).plus(D(qtyDelta)).gt(1)) {
      throw new InventoryValidationError('Serial-tracked quant cannot exceed quantity 1', 'SERIAL_QTY_EXCEEDED');
    }
  }

  const newQty = D(quant.quantity).plus(D(qtyDelta));
  // Clamp reserved reductions so immediate validate (no prior reservation) does not underflow
  let reservedApplied = D(reservedDelta || 0);
  let newReserved = D(quant.reservedQuantity).plus(reservedApplied);
  if (newReserved.lt(0) && reservedApplied.lt(0)) {
    reservedApplied = D(quant.reservedQuantity).neg();
    newReserved = D(0);
  }

  if (newQty.lt(0) && !dims.allowNegative) {
    const available = decStr(quant.quantity);
    throw new InventoryValidationError(
      `Insufficient stock — only ${available} available in inventory`,
      'INSUFFICIENT_STOCK',
      {
        messageAr: `المخزون غير كافٍ — المتاح في المخزون ${available} فقط`,
        details: { available, onHand: available },
      },
    );
  }
  if (newReserved.lt(0)) {
    throw new InventoryValidationError('Reserved quantity underflow', 'RESERVED_UNDERFLOW');
  }
  if (newReserved.gt(newQty) && !dims.allowNegative) {
    throw new InventoryValidationError('Reserved exceeds on-hand', 'OVER_RESERVED');
  }

  const nextVersion = (quant.version || 0) + 1;
  const versionFilter = quant.version == null
    ? { $or: [{ version: { $exists: false } }, { version: 0 }] }
    : { version: quant.version };

  const $set = {
    quantity: decStr(newQty),
    quantityNum: mongoose.Types.Decimal128.fromString(decStr(newQty)),
    reservedQuantity: decStr(newReserved),
    reservedQuantityNum: mongoose.Types.Decimal128.fromString(decStr(newReserved)),
    version: nextVersion,
  };
  if (D(qtyDelta).gt(0)) $set.inDate = inDate;

  const updated = await InvQuant.findOneAndUpdate(
    { _id: quant._id, ...versionFilter },
    { $set },
    { session, new: true },
  );

  if (!updated) {
    throw new InventoryConflictError('Quant was modified concurrently', 'CONFLICT');
  }

  if (decIsZero(updated.quantity) && decIsZero(updated.reservedQuantity) && !updated.isCountSet) {
    await InvQuant.deleteOne({ _id: updated._id }).session(session);
  }

  return updated;
}

/**
 * Atomic conditional reservation on a single quant.
 * Returns updated quant or null if insufficient available qty (race).
 */
export async function atomicReserveQuant(session, quantId, tenantId, takeStr, uomRounding = '0.000001') {
  const take = D(takeStr);
  if (take.lte(0)) return null;

  const takeNum = mongoose.Types.Decimal128.fromString(decStr(take));

  const updated = await InvQuant.findOneAndUpdate(
    {
      _id: toObjectId(quantId),
      tenantId: toObjectId(tenantId),
      $expr: {
        $gte: [
          { $subtract: ['$quantityNum', '$reservedQuantityNum'] },
          takeNum,
        ],
      },
    },
    [
      {
        $set: {
          reservedQuantityNum: { $add: ['$reservedQuantityNum', takeNum] },
          version: { $add: [{ $ifNull: ['$version', 0] }, 1] },
        },
      },
      {
        $set: {
          reservedQuantity: { $toString: '$reservedQuantityNum' },
        },
      },
    ],
    { session, new: true },
  );

  return updated;
}
