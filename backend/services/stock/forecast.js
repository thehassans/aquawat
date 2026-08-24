import mongoose from 'mongoose';
import { D, decStr } from '../../utils/decimal.js';
import StockQuant from '../../models/stock/StockQuant.js';
import StockMove from '../../models/stock/StockMove.js';
import StockLocation from '../../models/stock/StockLocation.js';
import { getInternalLocationIds } from './locationHelpers.js';

/**
 * On-hand for a product variant in internal locations (optional warehouse scope).
 */
export async function computeOnHand(tenantId, productId, { warehouseId, locationId } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  let locationFilter = {};

  if (locationId) {
    const ids = await getInternalLocationIds(tid, locationId);
    locationFilter = { locationId: { $in: ids } };
  } else if (warehouseId) {
    const whLocs = await StockLocation.find({
      tenantId: tid,
      warehouseId,
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    locationFilter = { locationId: { $in: whLocs.map((l) => l._id) } };
  } else {
    const internalLocs = await StockLocation.find({ tenantId: tid, usage: 'internal', active: true }).select('_id').lean();
    locationFilter = { locationId: { $in: internalLocs.map((l) => l._id) } };
  }

  const quants = await StockQuant.find({ tenantId: tid, productId, ...locationFilter }).lean();

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

/**
 * Forecast per spec §5.4
 */
export async function computeForecast(tenantId, productId, { warehouseId } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const { onHand, reserved, freeToUse } = await computeOnHand(tenantId, productId, { warehouseId });

  const internalLocs = await StockLocation.find({ tenantId: tid, usage: 'internal', active: true }).select('_id').lean();
  const internalIds = new Set(internalLocs.map((l) => String(l._id)));

  const pendingMoves = await StockMove.find({
    tenantId: tid,
    productId,
    state: { $in: ['waiting', 'confirmed', 'partially_available', 'assigned'] },
  }).lean();

  let incoming = D(0);
  let outgoing = D(0);

  for (const m of pendingMoves) {
    const srcInternal = internalIds.has(String(m.locationId));
    const destInternal = internalIds.has(String(m.locationDestId));
    const qty = D(m.productUomQty).minus(D(m.quantity || 0));
    if (qty.lte(0)) continue;
    if (destInternal && !srcInternal) incoming = incoming.plus(qty);
    if (srcInternal && !destInternal) outgoing = outgoing.plus(qty);
  }

  const forecasted = D(onHand).plus(incoming).minus(outgoing);

  return {
    onHand,
    reserved,
    freeToUse,
    incoming: decStr(incoming),
    outgoing: decStr(outgoing),
    forecasted: decStr(forecasted),
  };
}

/**
 * Stock report rows for all variants with quants or moves.
 */
export async function stockReportRows(tenantId, { search, categoryId, page = 1, limit = 80 } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const StockProductVariant = mongoose.model('StockProductVariant');
  const StockProductTemplate = mongoose.model('StockProductTemplate');

  const filter = { tenantId: tid, active: true };
  if (search) {
    filter.$or = [
      { defaultCode: new RegExp(search, 'i') },
    ];
  }

  const variants = await StockProductVariant.find(filter)
    .populate({ path: 'templateId', select: 'name defaultCode categoryId' })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await StockProductVariant.countDocuments(filter);

  const rows = [];
  for (const v of variants) {
    const template = v.templateId;
    if (categoryId && String(template?.categoryId) !== String(categoryId)) continue;

    const fc = await computeForecast(tid, v._id);
    rows.push({
      productId: v._id,
      productName: template?.name || v.defaultCode || '—',
      defaultCode: v.defaultCode || template?.defaultCode,
      ...fc,
    });
  }

  return { rows, total, page, limit };
}
