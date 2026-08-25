import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvLot from '../../models/inventory/InvLot.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Done move-line history with filters.
 */
export async function movesHistory(tenantId, {
  productId,
  lotId,
  locationId,
  transferId,
  dateFrom,
  dateTo,
  direction, // incoming | outgoing | internal
  page = 1,
  limit = 80,
} = {}) {
  const tid = toObjectId(tenantId);
  const filter = { tenantId: tid, state: 'done' };
  if (productId) filter.productId = productId;
  if (lotId) filter.lotId = lotId;
  if (transferId) filter.transferId = transferId;
  if (locationId) {
    filter.$or = [{ sourceLocationId: locationId }, { destLocationId: locationId }];
  }
  if (dateFrom || dateTo) {
    filter.updatedAt = {};
    if (dateFrom) filter.updatedAt.$gte = new Date(dateFrom);
    if (dateTo) filter.updatedAt.$lte = new Date(dateTo);
  }

  let items = await InvMoveLine.find(filter)
    .populate('productId', 'nameEn nameAr sku')
    .populate('lotId', 'name expirationDate')
    .populate('sourceLocationId', 'name completePath usage')
    .populate('destLocationId', 'name completePath usage')
    .populate('transferId', 'name partnerId origin state')
    .sort({ updatedAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Math.min(10000, Number(limit) * (direction ? 3 : 1)))
    .lean();

  if (direction === 'incoming') {
    items = items.filter(
      (l) => l.destLocationId?.usage === 'internal' && l.sourceLocationId?.usage !== 'internal',
    );
  } else if (direction === 'outgoing') {
    items = items.filter(
      (l) => l.sourceLocationId?.usage === 'internal' && l.destLocationId?.usage !== 'internal',
    );
  } else if (direction === 'internal') {
    items = items.filter(
      (l) => l.sourceLocationId?.usage === 'internal' && l.destLocationId?.usage === 'internal',
    );
  }

  if (direction) items = items.slice(0, Number(limit));

  const total = await InvMoveLine.countDocuments(filter);
  return { items, total, page: Number(page), limit: Number(limit) };
}

/**
 * Upstream / downstream tree for a lot or serial.
 */
export async function lotTraceability(tenantId, lotId) {
  const tid = toObjectId(tenantId);
  const lot = await InvLot.findOne({ _id: lotId, tenantId: tid })
    .populate('productId', 'nameEn nameAr sku tracking')
    .lean();
  if (!lot) return null;

  const lines = await InvMoveLine.find({
    tenantId: tid,
    lotId,
    state: 'done',
  })
    .populate('sourceLocationId', 'name completePath usage')
    .populate('destLocationId', 'name completePath usage')
    .populate('transferId', 'name partnerId origin')
    .populate('productId', 'nameEn nameAr sku')
    .sort({ updatedAt: 1 })
    .lean();

  const upstream = [];
  const downstream = [];

  for (const line of lines) {
    const node = {
      moveLineId: line._id,
      date: line.updatedAt,
      quantity: line.quantityInProductUom || line.quantity,
      from: line.sourceLocationId?.completePath || line.sourceLocationId?.name,
      to: line.destLocationId?.completePath || line.destLocationId?.name,
      fromUsage: line.sourceLocationId?.usage,
      toUsage: line.destLocationId?.usage,
      reference: line.reference,
      transfer: line.transferId?.name,
      partnerId: line.transferId?.partnerId,
      origin: line.transferId?.origin,
    };

    if (line.destLocationId?.usage === 'internal' && line.sourceLocationId?.usage !== 'internal') {
      upstream.push(node);
    } else if (line.sourceLocationId?.usage === 'internal' && line.destLocationId?.usage !== 'internal') {
      downstream.push(node);
    } else {
      upstream.push({ ...node, kind: 'transfer' });
      downstream.push({ ...node, kind: 'transfer' });
    }
  }

  return { lot, upstream, downstream, lines };
}

export async function productMoveHistory(tenantId, productId, opts = {}) {
  return movesHistory(tenantId, { ...opts, productId });
}
