import mongoose from 'mongoose';
import StockMoveLine from '../../models/stock/StockMoveLine.js';
import StockLot from '../../models/stock/StockLot.js';
import StockLocation from '../../models/stock/StockLocation.js';
import StockPicking from '../../models/stock/StockPicking.js';

/**
 * Done move-line history with filters.
 */
export async function movesHistory(tenantId, {
  productId,
  lotId,
  locationId,
  partnerId,
  dateFrom,
  dateTo,
  page = 1,
  limit = 80,
} = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const filter = { tenantId: tid, state: 'done' };
  if (productId) filter.productId = productId;
  if (lotId) filter.lotId = lotId;
  if (locationId) {
    filter.$or = [{ locationId }, { locationDestId: locationId }];
  }
  if (dateFrom || dateTo) {
    filter.updatedAt = {};
    if (dateFrom) filter.updatedAt.$gte = new Date(dateFrom);
    if (dateTo) filter.updatedAt.$lte = new Date(dateTo);
  }

  const items = await StockMoveLine.find(filter)
    .populate('productId')
    .populate({ path: 'lotId', select: 'name', model: 'StockLot' })
    .populate('locationId', 'completeName')
    .populate('locationDestId', 'completeName')
    .populate('pickingId', 'name partnerId')
    .sort({ updatedAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  const total = await StockMoveLine.countDocuments(filter);
  return { items, total, page: Number(page), limit: Number(limit) };
}

/**
 * Upstream / downstream tree for a lot or serial.
 */
export async function lotTraceability(tenantId, lotId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const lot = await StockLot.findOne({ _id: lotId, tenantId: tid }).lean();
  if (!lot) return null;

  const lines = await StockMoveLine.find({
    tenantId: tid,
    lotId,
    state: 'done',
  })
    .populate('locationId', 'completeName usage')
    .populate('locationDestId', 'completeName usage')
    .populate('pickingId', 'name partnerId origin')
    .populate('productId')
    .sort({ updatedAt: 1 })
    .lean();

  const upstream = [];
  const downstream = [];

  for (const line of lines) {
    const node = {
      moveLineId: line._id,
      date: line.updatedAt,
      quantity: line.quantityProduct || line.quantity,
      from: line.locationId?.completeName,
      to: line.locationDestId?.completeName,
      fromUsage: line.locationId?.usage,
      toUsage: line.locationDestId?.usage,
      reference: line.reference,
      picking: line.pickingId?.name,
      partnerId: line.pickingId?.partnerId,
      origin: line.pickingId?.origin,
    };

    // Incoming into internal = upstream supply; leaving internal = downstream
    if (line.locationDestId?.usage === 'internal' && line.locationId?.usage !== 'internal') {
      upstream.push(node);
    } else if (line.locationId?.usage === 'internal' && line.locationDestId?.usage !== 'internal') {
      downstream.push(node);
    } else {
      // internal transfers appear in both timelines chronologically
      upstream.push({ ...node, kind: 'transfer' });
      downstream.push({ ...node, kind: 'transfer' });
    }
  }

  return { lot, upstream, downstream, lines };
}

/**
 * Product-level move-line history.
 */
export async function productTraceability(tenantId, productId, query = {}) {
  return movesHistory(tenantId, { ...query, productId });
}
