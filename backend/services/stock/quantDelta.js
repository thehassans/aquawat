/**
 * Extracted quant delta so inventory/scrap services don't create circular imports
 * with the full picking service.
 */
import { D, decStr, decIsZero } from '../../utils/decimal.js';
import StockQuant from '../../models/stock/StockQuant.js';
import { StockValidationError } from './errors.js';

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
    [quant] = await StockQuant.create([{
      ...filter,
      quantity: decStr(qtyDelta),
      reservedQuantity: decStr(reservedDelta),
      inDate,
      value: '0',
    }], { session });
    return quant;
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

  quant.quantity = decStr(newQty);
  quant.reservedQuantity = decStr(newReserved);
  if (D(qtyDelta).gt(0)) quant.inDate = inDate;
  quant.version = (quant.version || 0) + 1;
  await quant.save({ session });

  if (decIsZero(quant.quantity) && decIsZero(quant.reservedQuantity) && !quant.inventoryQuantitySet) {
    await StockQuant.deleteOne({ _id: quant._id }).session(session);
  }

  return quant;
}
