/**
 * Extracted quant delta so inventory/scrap services don't create circular imports
 * with the full picking service.
 */
import { D, decStr, decIsZero } from '../../utils/decimal.js';
import StockQuant from '../../models/stock/StockQuant.js';
import { StockValidationError, StockConflictError } from './errors.js';

export async function applyQuantDelta(session, tenantId, productId, locationId, qtyDelta, reservedDelta = '0', inDate = new Date(), dims = {}) {
  const filter = {
    tenantId,
    productId,
    locationId,
    lotId: dims.lotId || null,
    packageId: dims.packageId || null,
    ownerId: dims.ownerId || null,
  };

  let quant = await StockQuant.findOne(filter).session(session);

  if (!quant && D(qtyDelta).gt(0)) {
    if (dims.tracking === 'serial' && D(qtyDelta).gt(1)) {
      throw new StockValidationError('Serial-tracked quant cannot exceed quantity 1', 'SERIAL_QTY_EXCEEDED');
    }
    try {
      [quant] = await StockQuant.create([{
        ...filter,
        quantity: decStr(qtyDelta),
        reservedQuantity: decStr(reservedDelta),
        inDate,
        value: '0',
        version: 0,
      }], { session });
      return quant;
    } catch (err) {
      // Unique index race — reload and continue as update
      if (err?.code === 11000) {
        quant = await StockQuant.findOne(filter).session(session);
        if (!quant) throw err;
      } else {
        throw err;
      }
    }
  }

  if (!quant) {
    throw new StockValidationError(`No quant for product at location ${locationId}`, 'QUANT_NOT_FOUND');
  }

  if (dims.tracking === 'serial' && D(qtyDelta).gt(0)) {
    const after = D(quant.quantity).plus(D(qtyDelta));
    if (after.gt(1)) {
      throw new StockValidationError('Serial-tracked quant cannot exceed quantity 1', 'SERIAL_QTY_EXCEEDED');
    }
  }

  const newQty = D(quant.quantity).plus(D(qtyDelta));
  const newReserved = D(quant.reservedQuantity).plus(D(reservedDelta));

  if (newQty.lt(0)) {
    throw new StockValidationError('Insufficient stock', 'INSUFFICIENT_STOCK');
  }
  if (newReserved.lt(0)) {
    throw new StockValidationError('Reserved quantity underflow', 'RESERVED_UNDERFLOW');
  }
  if (newReserved.gt(newQty)) {
    throw new StockValidationError('Reserved exceeds on-hand', 'OVER_RESERVED');
  }

  const nextVersion = (quant.version || 0) + 1;
  const versionFilter = quant.version == null
    ? { $or: [{ version: { $exists: false } }, { version: 0 }] }
    : { version: quant.version };

  const updated = await StockQuant.findOneAndUpdate(
    { _id: quant._id, ...versionFilter },
    {
      $set: {
        quantity: decStr(newQty),
        reservedQuantity: decStr(newReserved),
        version: nextVersion,
        ...(D(qtyDelta).gt(0) ? { inDate } : {}),
      },
    },
    { session, new: true },
  );

  if (!updated) {
    throw new StockConflictError('Quant was modified concurrently', 'CONFLICT');
  }

  if (decIsZero(updated.quantity) && decIsZero(updated.reservedQuantity) && !updated.inventoryQuantitySet) {
    await StockQuant.deleteOne({ _id: updated._id }).session(session);
  }

  return updated;
}
