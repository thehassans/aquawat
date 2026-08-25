import { D, decStr, decRoundUp, uomToReference, referenceToUom } from '../../utils/decimal.js';
import InvUom from '../../models/inventory/InvUom.js';
import { InventoryValidationError } from './errors.js';

/**
 * Convert quantity between two UoMs in the same category.
 * Consumption / demand uses round **up** to the target UoM rounding.
 *
 * Factor convention (see decimal.js): qty_ref = qty / factor;
 * qty_target = roundUp(qty_ref * targetFactor, target.rounding).
 */
export async function convertQty({
  qty,
  fromUomId,
  toUomId,
  session = null,
  round = 'up',
} = {}) {
  if (!fromUomId || !toUomId) {
    throw new InventoryValidationError('fromUomId and toUomId required', 'UOM_CONVERT');
  }
  if (String(fromUomId) === String(toUomId)) {
    const uom = await InvUom.findById(toUomId).session(session);
    if (!uom) throw new InventoryValidationError('UoM not found', 'UOM_NOT_FOUND');
    const rounding = uom.rounding || '0.01';
    const out = round === 'up' ? decRoundUp(qty, rounding) : D(qty);
    return {
      qty: decStr(out),
      fromUomId,
      toUomId,
      rounding,
    };
  }

  let q = InvUom.find({ _id: { $in: [fromUomId, toUomId] } });
  if (session) q = q.session(session);
  const uoms = await q;
  const from = uoms.find((u) => String(u._id) === String(fromUomId));
  const to = uoms.find((u) => String(u._id) === String(toUomId));
  if (!from || !to) throw new InventoryValidationError('UoM not found', 'UOM_NOT_FOUND');
  if (String(from.categoryId) !== String(to.categoryId)) {
    throw new InventoryValidationError('UoM category mismatch', 'UOM_CATEGORY');
  }

  const ref = uomToReference(qty, from.factor || '1');
  const rounding = to.rounding || '0.01';
  const converted = round === 'up'
    ? referenceToUom(ref, to.factor || '1', rounding)
    : D(ref).mul(D(to.factor || '1'));

  return {
    qty: decStr(converted),
    fromUomId: from._id,
    toUomId: to._id,
    rounding,
    referenceQty: decStr(ref),
  };
}

/**
 * Demand on a move expressed in the product's UoM (round up).
 */
export async function demandInProductUom(move, product, session) {
  const productUomId = product.uomId || move.uomId;
  const result = await convertQty({
    qty: move.demandQty,
    fromUomId: move.uomId,
    toUomId: productUomId,
    session,
    round: 'up',
  });
  return { need: result.qty, rounding: result.rounding };
}
