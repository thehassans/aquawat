import { D, decStr } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getInternalLocationIds } from './locationHelpers.js';

export async function computeOnHand(tenantId, productId, {
  warehouseId,
  locationId,
  variantId,
  excludeNullVariant = false,
  sumVariantsOnly = false,
} = {}) {
  const tid = toObjectId(tenantId);
  let locationFilter = {};

  if (locationId) {
    const ids = await getInternalLocationIds(tid, locationId);
    locationFilter = { locationId: { $in: ids } };
  } else if (warehouseId) {
    const whLocs = await InvLocation.find({
      tenantId: tid,
      warehouseId: toObjectId(warehouseId),
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    locationFilter = { locationId: { $in: whLocs.map((l) => l._id) } };
  } else {
    const internalLocs = await InvLocation.find({
      tenantId: tid,
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    locationFilter = { locationId: { $in: internalLocs.map((l) => l._id) } };
  }

  const quantFilter = {
    tenantId: tid,
    productId: toObjectId(productId),
    ...locationFilter,
  };
  if (variantId != null && variantId !== '') {
    quantFilter.variantId = toObjectId(variantId);
  } else if (excludeNullVariant || sumVariantsOnly) {
    quantFilter.variantId = { $ne: null };
  }

  const quants = await InvQuant.find(quantFilter).lean();

  let onHand = D(0);
  let reserved = D(0);
  for (const q of quants) {
    onHand = onHand.plus(D(q.quantity));
    reserved = reserved.plus(D(q.reservedQuantity));
  }

  return {
    onHand: decStr(onHand),
    reserved: decStr(reserved),
    freeToUse: decStr(onHand.minus(reserved)),
  };
}

export async function computeForecast(tenantId, productId, { warehouseId, variantId } = {}) {
  const tid = toObjectId(tenantId);
  const { onHand, reserved, freeToUse } = await computeOnHand(tenantId, productId, { warehouseId, variantId });

  const internalLocs = await InvLocation.find({
    tenantId: tid,
    usage: 'internal',
    active: true,
    ...(warehouseId ? { warehouseId: toObjectId(warehouseId) } : {}),
  }).select('_id').lean();
  const internalIds = new Set(internalLocs.map((l) => String(l._id)));

  const moveFilter = {
    tenantId: tid,
    productId: toObjectId(productId),
    state: { $in: ['waiting', 'confirmed', 'partiallyAvailable', 'assigned'] },
  };
  if (variantId != null && variantId !== '') {
    moveFilter.variantId = toObjectId(variantId);
  }
  const pendingMoves = await InvMove.find(moveFilter).lean();

  let incoming = D(0);
  let outgoing = D(0);

  for (const m of pendingMoves) {
    const srcInternal = internalIds.has(String(m.sourceLocationId));
    const destInternal = internalIds.has(String(m.destLocationId));
    const qty = D(m.demandQty).minus(D(m.doneQty || 0));
    if (qty.lte(0)) continue;
    if (destInternal && !srcInternal) incoming = incoming.plus(qty);
    if (srcInternal && !destInternal) outgoing = outgoing.plus(qty);
  }

  return {
    onHand,
    reserved,
    freeToUse,
    incoming: decStr(incoming),
    outgoing: decStr(outgoing),
    forecast: decStr(D(onHand).plus(incoming).minus(outgoing)),
  };
}
