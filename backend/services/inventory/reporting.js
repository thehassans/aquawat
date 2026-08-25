import { D, decStr } from '../../utils/decimal.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { computeForecast } from './forecast.js';
import { productInventoryValue } from './valuation.js';

/**
 * Aggregate done moves by product / day / direction.
 */
export async function movesAnalysis(tenantId, {
  dateFrom,
  dateTo,
  warehouseId,
  groupBy = 'product', // product | day | partner
} = {}) {
  const tid = toObjectId(tenantId);
  const filter = { tenantId: tid, state: 'done' };
  if (dateFrom || dateTo) {
    filter.updatedAt = {};
    if (dateFrom) filter.updatedAt.$gte = new Date(dateFrom);
    if (dateTo) filter.updatedAt.$lte = new Date(dateTo);
  }

  let locationIds = null;
  if (warehouseId) {
    const locs = await InvLocation.find({
      tenantId: tid,
      warehouseId: toObjectId(warehouseId),
    }).select('_id').lean();
    locationIds = new Set(locs.map((l) => String(l._id)));
  }

  const lines = await InvMoveLine.find(filter)
    .populate('productId', 'nameEn sku category')
    .populate('sourceLocationId', 'usage warehouseId')
    .populate('destLocationId', 'usage warehouseId')
    .populate('transferId', 'partnerId name')
    .limit(5000)
    .lean();

  const buckets = new Map();

  for (const line of lines) {
    if (locationIds) {
      const src = String(line.sourceLocationId?._id || '');
      const dest = String(line.destLocationId?._id || '');
      if (!locationIds.has(src) && !locationIds.has(dest)) continue;
    }

    const srcInternal = line.sourceLocationId?.usage === 'internal';
    const destInternal = line.destLocationId?.usage === 'internal';
    let direction = 'internal';
    if (destInternal && !srcInternal) direction = 'incoming';
    else if (srcInternal && !destInternal) direction = 'outgoing';

    const qty = D(line.quantityInProductUom || line.quantity || 0);
    let key;
    if (groupBy === 'day') {
      key = new Date(line.updatedAt).toISOString().slice(0, 10);
    } else if (groupBy === 'partner') {
      key = String(line.transferId?.partnerId || 'none');
    } else {
      key = String(line.productId?._id || line.productId);
    }

    const prev = buckets.get(key) || {
      key,
      label: groupBy === 'product'
        ? (line.productId?.nameEn || line.productId?.sku || key)
        : key,
      incomingQty: D(0),
      outgoingQty: D(0),
      internalQty: D(0),
      lines: 0,
    };
    if (direction === 'incoming') prev.incomingQty = prev.incomingQty.plus(qty);
    else if (direction === 'outgoing') prev.outgoingQty = prev.outgoingQty.plus(qty);
    else prev.internalQty = prev.internalQty.plus(qty);
    prev.lines += 1;
    buckets.set(key, prev);
  }

  return [...buckets.values()]
    .map((b) => ({
      ...b,
      incomingQty: decStr(b.incomingQty),
      outgoingQty: decStr(b.outgoingQty),
      internalQty: decStr(b.internalQty),
      netQty: decStr(b.incomingQty.minus(b.outgoingQty)),
    }))
    .sort((a, b) => Number(b.outgoingQty) + Number(b.incomingQty) - (Number(a.outgoingQty) + Number(a.incomingQty)));
}

/**
 * Warehouse / ops performance KPIs over a period.
 */
export async function performanceKpis(tenantId, {
  dateFrom,
  dateTo,
  warehouseId,
} = {}) {
  const tid = toObjectId(tenantId);
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 86400000);
  const to = dateTo ? new Date(dateTo) : new Date();

  const filter = {
    tenantId: tid,
    state: 'done',
    doneDate: { $gte: from, $lte: to },
  };
  if (warehouseId) {
    // filter via op type warehouse — approximate via location on transfer
    const locs = await InvLocation.find({
      tenantId: tid,
      warehouseId: toObjectId(warehouseId),
    }).select('_id').lean();
    const ids = locs.map((l) => l._id);
    filter.$or = [
      { sourceLocationId: { $in: ids } },
      { destLocationId: { $in: ids } },
    ];
  }

  const transfers = await InvTransfer.find(filter).lean();
  let late = 0;
  let onTime = 0;
  let leadSumMs = 0;
  let leadCount = 0;
  let backorders = 0;

  for (const t of transfers) {
    if (t.deadlineDate && t.doneDate) {
      if (new Date(t.doneDate) > new Date(t.deadlineDate)) late += 1;
      else onTime += 1;
      leadSumMs += new Date(t.doneDate) - new Date(t.scheduledDate || t.createdAt);
      leadCount += 1;
    }
    if (t.backorderId || t.origin?.includes('backorder')) backorders += 1;
  }

  const totalTimed = onTime + late;
  const openLate = await InvTransfer.countDocuments({
    tenantId: tid,
    state: { $in: ['confirmed', 'assigned', 'waiting'] },
    deadlineDate: { $lt: new Date() },
  });

  return {
    period: { from, to },
    transfersDone: transfers.length,
    onTimeRate: totalTimed ? onTime / totalTimed : null,
    lateCount: late,
    openLateCount: openLate,
    avgLeadDays: leadCount ? leadSumMs / leadCount / 86400000 : null,
    backorderCount: backorders,
    backorderRate: transfers.length ? backorders / transfers.length : null,
  };
}

/**
 * Multi-product forecast snapshot for reporting.
 */
export async function forecastReport(tenantId, { warehouseId, limit = 100 } = {}) {
  const tid = toObjectId(tenantId);
  const products = await Product.find({
    tenantId: tid,
    isActive: { $ne: false },
    trackInventory: { $ne: false },
  }).select('nameEn nameAr sku').limit(Number(limit)).lean();

  const rows = [];
  for (const p of products) {
    const fc = await computeForecast(tid, p._id, { warehouseId });
    if (D(fc.onHand).eq(0) && D(fc.incoming).eq(0) && D(fc.outgoing).eq(0)) continue;
    rows.push({
      productId: p._id,
      name: p.nameEn || p.sku,
      sku: p.sku,
      ...fc,
    });
  }
  rows.sort((a, b) => Number(a.forecasted) - Number(b.forecasted));
  return rows;
}

/**
 * Combined stock + valuation export rows.
 */
export async function stockExportRows(tenantId, { warehouseId } = {}) {
  const tid = toObjectId(tenantId);
  const products = await Product.find({
    tenantId: tid,
    isActive: { $ne: false },
    trackInventory: { $ne: false },
  }).select('nameEn sku costPrice barcode externalId').limit(2000).lean();

  const rows = [];
  for (const p of products) {
    const fc = await computeForecast(tid, p._id, { warehouseId });
    const val = await productInventoryValue(tid, p._id);
    rows.push({
      externalId: p.externalId || String(p._id),
      sku: p.sku,
      barcode: p.barcode || '',
      nameEn: p.nameEn,
      onHand: fc.onHand,
      reserved: fc.reserved,
      forecast: fc.forecasted,
      incoming: fc.incoming,
      outgoing: fc.outgoing,
      unitCost: val.unitCost || p.costPrice,
      inventoryValue: val.value,
      costMethod: val.costMethod,
    });
  }
  return rows;
}
