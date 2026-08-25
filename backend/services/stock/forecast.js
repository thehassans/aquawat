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

/**
 * Pure timeline runner for tests / forecast report.
 */
export function buildRunningBalanceTimeline(onHand, events) {
  let balance = D(onHand);
  const timeline = [{
    date: null,
    direction: 'start',
    qty: decStr(balance),
    balance: decStr(balance),
    reference: 'On Hand',
    negative: balance.lt(0),
  }];
  let firstNegativeDate = balance.lt(0) ? timeline[0].date : null;

  for (const ev of events) {
    if (ev.direction === 'in') balance = balance.plus(D(ev.qty));
    else balance = balance.minus(D(ev.qty));
    const negative = balance.lt(0);
    if (negative && firstNegativeDate == null) firstNegativeDate = ev.date;
    timeline.push({
      ...ev,
      balance: decStr(balance),
      negative,
    });
  }
  return { timeline, firstNegativeDate, finalBalance: decStr(balance) };
}

/**
 * Forecast timeline: current on-hand then pending in/out moves by date with running balance.
 */
export async function computeForecastTimeline(tenantId, productId, { warehouseId } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const summary = await computeForecast(tenantId, productId, { warehouseId });

  const internalLocs = await StockLocation.find({ tenantId: tid, usage: 'internal', active: true }).select('_id').lean();
  const internalIds = new Set(internalLocs.map((l) => String(l._id)));

  const pendingMoves = await StockMove.find({
    tenantId: tid,
    productId,
    state: { $in: ['waiting', 'confirmed', 'partially_available', 'assigned'] },
  })
    .populate('pickingId', 'name')
    .sort({ date: 1, dateDeadline: 1, createdAt: 1 })
    .lean();

  const events = [];
  for (const m of pendingMoves) {
    const srcInternal = internalIds.has(String(m.locationId));
    const destInternal = internalIds.has(String(m.locationDestId));
    const qty = D(m.productUomQty).minus(D(m.quantity || 0));
    if (qty.lte(0)) continue;

    let direction = null;
    if (destInternal && !srcInternal) direction = 'in';
    else if (srcInternal && !destInternal) direction = 'out';
    else continue;

    events.push({
      date: m.dateDeadline || m.date || m.createdAt,
      direction,
      qty: decStr(qty),
      reference: m.pickingId?.name || m.reference || m.origin || String(m._id),
      moveId: m._id,
      pickingId: m.pickingId?._id || m.pickingId || null,
      state: m.state,
    });
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  const { timeline, firstNegativeDate } = buildRunningBalanceTimeline(summary.onHand, events);
  if (timeline[0]) timeline[0].date = new Date();

  return {
    ...summary,
    timeline,
    firstNegativeDate,
  };
}

/**
 * Locations report: quants grouped by location (lot/package breakdown).
 */
export async function locationsReportRows(tenantId, { search, usage = 'internal' } = {}) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const locFilter = { tenantId: tid, active: true };
  if (usage) locFilter.usage = usage;
  if (search) locFilter.completeName = new RegExp(search, 'i');

  const locations = await StockLocation.find(locFilter).sort({ completeName: 1 }).lean();
  const locIds = locations.map((l) => l._id);
  if (!locIds.length) return { groups: [] };

  const quants = await StockQuant.find({
    tenantId: tid,
    locationId: { $in: locIds },
  })
    .populate({ path: 'productId', populate: { path: 'templateId', select: 'name defaultCode' } })
    .populate('lotId', 'name')
    .populate('packageId', 'name')
    .lean();

  const byLoc = new Map(locations.map((l) => [String(l._id), {
    locationId: l._id,
    completeName: l.completeName,
    usage: l.usage,
    lines: [],
    onHand: D(0),
    reserved: D(0),
  }]));

  for (const q of quants) {
    const g = byLoc.get(String(q.locationId));
    if (!g) continue;
    const qty = D(q.quantity);
    const reserved = D(q.reservedQuantity);
    if (qty.isZero() && reserved.isZero()) continue;
    g.onHand = g.onHand.plus(qty);
    g.reserved = g.reserved.plus(reserved);
    const product = q.productId;
    g.lines.push({
      quantId: q._id,
      productId: product?._id,
      productName: product?.templateId?.name || product?.defaultCode || '—',
      defaultCode: product?.defaultCode || product?.templateId?.defaultCode,
      lotName: q.lotId?.name || null,
      packageName: q.packageId?.name || null,
      quantity: decStr(qty),
      reservedQuantity: decStr(reserved),
    });
  }

  const groups = [...byLoc.values()]
    .filter((g) => g.lines.length > 0)
    .map((g) => ({
      locationId: g.locationId,
      completeName: g.completeName,
      usage: g.usage,
      onHand: decStr(g.onHand),
      reserved: decStr(g.reserved),
      lines: g.lines,
    }));

  return { groups };
}
