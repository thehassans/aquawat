import { D, decStr } from '../../utils/decimal.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvLot from '../../models/inventory/InvLot.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { computeForecast } from './forecast.js';
import { productInventoryValue } from './valuation.js';
import { InventoryValidationError } from './errors.js';

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
 * Reception report — done incoming receipts in a period (read-only ledger view).
 * Gated in UI by receptionReportEnabled; API always readable when engine on.
 */
export async function receptionReport(tenantId, {
  dateFrom,
  dateTo,
  warehouseId,
  partnerId,
  limit = 200,
} = {}) {
  const tid = toObjectId(tenantId);
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 86400000);
  const to = dateTo ? new Date(dateTo) : new Date();

  const InvOperationType = (await import('../../models/inventory/InvOperationType.js')).default;
  const otFilter = { tenantId: tid, code: 'incoming', active: true };
  if (warehouseId) otFilter.warehouseId = toObjectId(warehouseId);
  const opTypes = await InvOperationType.find(otFilter).select('_id').lean();
  const otIds = opTypes.map((o) => o._id);
  if (!otIds.length) {
    return { period: { from, to }, items: [], totals: { receipts: 0, qty: '0', late: 0 } };
  }

  const transferFilter = {
    tenantId: tid,
    operationTypeId: { $in: otIds },
    state: 'done',
    doneDate: { $gte: from, $lte: to },
  };
  if (partnerId) transferFilter.partnerId = toObjectId(partnerId);

  const transfers = await InvTransfer.find(transferFilter)
    .sort({ doneDate: -1 })
    .limit(Math.min(500, Number(limit) || 200))
    .lean();

  const transferIds = transfers.map((t) => t._id);
  const moves = await InvMove.find({
    tenantId: tid,
    transferId: { $in: transferIds },
    state: 'done',
  })
    .populate('productId', 'nameEn nameAr sku')
    .lean();

  const byTransfer = new Map(transfers.map((t) => [String(t._id), t]));
  let qtyTotal = D(0);
  let late = 0;
  const items = [];

  for (const t of transfers) {
    if (t.deadlineDate && t.doneDate && new Date(t.doneDate) > new Date(t.deadlineDate)) late += 1;
  }

  for (const m of moves) {
    const t = byTransfer.get(String(m.transferId));
    if (!t) continue;
    const qty = D(m.doneQty || m.demandQty || 0);
    qtyTotal = qtyTotal.plus(qty);
    const isLate = !!(t.deadlineDate && t.doneDate && new Date(t.doneDate) > new Date(t.deadlineDate));
    items.push({
      transferId: t._id,
      transferName: t.name,
      origin: t.origin || '',
      partnerId: t.partnerId || null,
      doneDate: t.doneDate,
      scheduledDate: t.scheduledDate,
      deadlineDate: t.deadlineDate || null,
      late: isLate,
      productId: m.productId?._id || m.productId,
      productName: m.productId?.nameEn || m.productId?.sku || '—',
      productNameAr: m.productId?.nameAr || '',
      sku: m.productId?.sku || '',
      qty: decStr(qty),
      demandQty: m.demandQty,
      doneQty: m.doneQty,
      variantId: m.variantId || null,
    });
  }

  // Prefer partner names when available
  const partnerIds = [...new Set(items.map((i) => i.partnerId).filter(Boolean).map(String))];
  let partnerMap = {};
  if (partnerIds.length) {
    try {
      const Customer = (await import('../../models/Customer.js')).default;
      const partners = await Customer.find({
        tenantId: tid,
        _id: { $in: partnerIds },
      }).select('name nameAr').lean();
      partnerMap = Object.fromEntries(partners.map((p) => [String(p._id), p]));
    } catch {
      partnerMap = {};
    }
  }

  for (const row of items) {
    const p = row.partnerId ? partnerMap[String(row.partnerId)] : null;
    row.partnerName = p?.name || null;
    row.partnerNameAr = p?.nameAr || null;
  }

  return {
    period: { from, to },
    items,
    totals: {
      receipts: transfers.length,
      lines: items.length,
      qty: decStr(qtyTotal),
      late,
    },
  };
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

/**
 * Inventory at Date — replay done move lines + valuation layers up to `asOf`.
 * On-hand = net qty into internal locations; value = Σ layer.value with createdAt ≤ asOf.
 * Forecast columns are blank (point-in-time snapshot, not live forecast).
 */
export async function inventoryAtDate(tenantId, { asOf, warehouseId } = {}) {
  if (!asOf) throw new InventoryValidationError('asOf is required', 'ASOF_REQUIRED');
  const tid = toObjectId(tenantId);
  const at = new Date(asOf);
  if (Number.isNaN(at.getTime())) throw new InventoryValidationError('Invalid asOf datetime', 'ASOF_INVALID');

  const locFilter = { tenantId: tid, usage: 'internal', active: { $ne: false } };
  if (warehouseId) locFilter.warehouseId = toObjectId(warehouseId);
  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);
  const locSet = new Set(locIds.map(String));
  if (!locIds.length) {
    return { asOf: at.toISOString(), data: [], total: 0, valueTotal: '0' };
  }

  const lines = await InvMoveLine.find({
    tenantId: tid,
    state: 'done',
    updatedAt: { $lte: at },
    $or: [
      { sourceLocationId: { $in: locIds } },
      { destLocationId: { $in: locIds } },
    ],
  })
    .select('productId quantityInProductUom quantity sourceLocationId destLocationId')
    .lean();

  const qtyByProduct = new Map();
  for (const line of lines) {
    const pid = String(line.productId);
    const qty = D(line.quantityInProductUom || line.quantity || 0);
    let net = qtyByProduct.get(pid) || D(0);
    if (locSet.has(String(line.destLocationId))) net = net.plus(qty);
    if (locSet.has(String(line.sourceLocationId))) net = net.minus(qty);
    qtyByProduct.set(pid, net);
  }

  const InvValuationLayer = (await import('../../models/inventory/InvValuationLayer.js')).default;
  const valueAgg = await InvValuationLayer.aggregate([
    {
      $match: {
        tenantId: tid,
        createdAt: { $lte: at },
      },
    },
    {
      $group: {
        _id: '$productId',
        valueNum: { $sum: '$valueNum' },
      },
    },
  ]);
  const valueByProduct = new Map(
    valueAgg.map((r) => [String(r._id), D(r.valueNum?.toString?.() || '0')]),
  );

  const productIds = [...new Set([...qtyByProduct.keys(), ...valueByProduct.keys()])]
    .filter((id) => {
      const q = qtyByProduct.get(id) || D(0);
      return !q.eq(0) || !(valueByProduct.get(id) || D(0)).eq(0);
    });

  const products = await Product.find({
    tenantId: tid,
    _id: { $in: productIds },
  }).select('nameEn nameAr sku barcode costPrice unitOfMeasure').lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const rows = [];
  let valueTotal = D(0);
  for (const pid of productIds) {
    const p = byId.get(pid);
    if (!p) continue;
    const onHand = decStr(qtyByProduct.get(pid) || D(0));
    const valueD = valueByProduct.get(pid) || D(0);
    const value = decStr(valueD);
    valueTotal = valueTotal.plus(valueD);
    const unitCost = D(onHand).eq(0)
      ? (p.costPrice || '0')
      : decStr(valueD.div(D(onHand)));
    rows.push({
      productId: p._id,
      product: p,
      onHand,
      reserved: '0',
      freeToUse: onHand,
      incoming: '0',
      outgoing: '0',
      forecast: onHand,
      unitCost,
      value,
      asOf: true,
    });
  }

  rows.sort((a, b) => String(a.product?.sku || '').localeCompare(String(b.product?.sku || '')));
  return {
    asOf: at.toISOString(),
    data: rows,
    total: rows.length,
    valueTotal: decStr(valueTotal),
  };
}

/**
 * Live stock report in a bounded number of queries (no per-product N+1).
 */
export async function stockReportLive(tenantId, { warehouseId, locIds } = {}) {
  const tid = toObjectId(tenantId);
  const InvQuant = (await import('../../models/inventory/InvQuant.js')).default;
  const InvValuationLayer = (await import('../../models/inventory/InvValuationLayer.js')).default;

  let locations = locIds;
  if (!locations?.length) {
    const locFilter = { tenantId: tid, usage: 'internal', active: { $ne: false } };
    if (warehouseId) locFilter.warehouseId = toObjectId(warehouseId);
    const locs = await InvLocation.find(locFilter).select('_id').lean();
    locations = locs.map((l) => l._id);
  }
  if (!locations.length) {
    return { data: [], total: 0, valueTotal: '0' };
  }

  const internalIds = new Set(locations.map(String));

  const [quants, pendingMoves, valueAgg] = await Promise.all([
    InvQuant.aggregate([
      { $match: { tenantId: tid, locationId: { $in: locations } } },
      {
        $group: {
          _id: '$productId',
          onHandNum: { $sum: '$quantityNum' },
          reservedNum: { $sum: '$reservedQuantityNum' },
        },
      },
    ]),
    InvMove.find({
      tenantId: tid,
      state: { $in: ['waiting', 'confirmed', 'partiallyAvailable', 'assigned'] },
      $or: [
        { sourceLocationId: { $in: locations } },
        { destLocationId: { $in: locations } },
      ],
    }).select('productId sourceLocationId destLocationId demandQty doneQty').lean(),
    InvValuationLayer.aggregate([
      { $match: { tenantId: tid } },
      {
        $group: {
          _id: '$productId',
          remainingValueNum: { $sum: '$remainingValueNum' },
          valueNum: { $sum: '$valueNum' },
        },
      },
    ]),
  ]);

  const productIds = quants.map((q) => q._id);
  const products = await Product.find({
    tenantId: tid,
    _id: { $in: productIds },
  }).select('nameEn nameAr sku barcode costPrice unitOfMeasure uomId sellingPrice').lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const ioByProduct = new Map();
  for (const m of pendingMoves) {
    const pid = String(m.productId);
    const qty = D(m.demandQty).minus(D(m.doneQty || 0));
    if (qty.lte(0)) continue;
    const srcInternal = internalIds.has(String(m.sourceLocationId));
    const destInternal = internalIds.has(String(m.destLocationId));
    const prev = ioByProduct.get(pid) || { incoming: D(0), outgoing: D(0) };
    if (destInternal && !srcInternal) prev.incoming = prev.incoming.plus(qty);
    if (srcInternal && !destInternal) prev.outgoing = prev.outgoing.plus(qty);
    ioByProduct.set(pid, prev);
  }

  const valueByProduct = new Map(
    valueAgg.map((r) => {
      const rem = D(r.remainingValueNum?.toString?.() || '0');
      // Prefer FIFO remaining; fall back to signed journal sum when remaining is zero
      const fallback = D(r.valueNum?.toString?.() || '0');
      return [String(r._id), rem.eq(0) ? fallback : rem];
    }),
  );

  const rows = [];
  let valueTotal = D(0);
  for (const q of quants) {
    const p = byId.get(String(q._id));
    if (!p) continue;
    const onHand = decStr(q.onHandNum?.toString?.() || '0');
    const reserved = decStr(q.reservedNum?.toString?.() || '0');
    const io = ioByProduct.get(String(q._id)) || { incoming: D(0), outgoing: D(0) };
    const incoming = decStr(io.incoming);
    const outgoing = decStr(io.outgoing);
    const forecast = decStr(D(onHand).plus(io.incoming).minus(io.outgoing));

    let valueD = valueByProduct.get(String(q._id));
    if (valueD == null || valueD.eq(0)) {
      valueD = D(onHand).mul(D(p.costPrice || 0));
    }
    const value = decStr(valueD);
    valueTotal = valueTotal.plus(valueD);
    const unitCost = D(onHand).eq(0)
      ? (p.costPrice || '0')
      : decStr(valueD.div(D(onHand)));

    rows.push({
      productId: q._id,
      product: p,
      onHand,
      reserved,
      freeToUse: decStr(D(onHand).minus(D(reserved))),
      incoming,
      outgoing,
      forecast,
      unitCost,
      value,
    });
  }

  return { data: rows, total: rows.length, valueTotal: decStr(valueTotal) };
}

/**
 * B.2 — expiry at risk: lots with on-hand qty grouped by days-to-expiry buckets.
 */
export async function expiryAtRiskReport(tenantId, {
  warehouseId,
  buckets = [7, 30, 60, 90],
} = {}) {
  const tid = toObjectId(tenantId);
  const now = new Date();
  const maxDays = Math.max(...buckets.map(Number), 90);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + maxDays);

  let locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = warehouseId;
  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);
  if (!locIds.length) {
    return { buckets: [], lines: [], totals: { qty: '0', valueAtRisk: '0' } };
  }

  const lots = await InvLot.find({
    tenantId: tid,
    expirationDate: { $gte: now, $lte: horizon },
  }).select('name productId expirationDate removalDate').lean();

  const lotIds = lots.map((l) => l._id);
  if (!lotIds.length) {
    return { buckets: [], lines: [], totals: { qty: '0', valueAtRisk: '0' } };
  }

  const quants = await InvQuant.find({
    tenantId: tid,
    locationId: { $in: locIds },
    lotId: { $in: lotIds },
    quantity: { $ne: '0' },
  }).lean();

  const productIds = [...new Set(quants.map((q) => String(q.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).select('nameEn sku costPrice').lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const lotMap = new Map(lots.map((l) => [String(l._id), l]));

  const bucketDefs = buckets.map(Number).sort((a, b) => a - b);
  const bucketTotals = Object.fromEntries(bucketDefs.map((d) => [String(d), { qty: D(0), value: D(0), lines: 0 }]));
  const lines = [];

  for (const q of quants) {
    const qty = D(q.quantity || 0);
    if (qty.lte(0)) continue;
    const lot = lotMap.get(String(q.lotId));
    if (!lot?.expirationDate) continue;
    const days = Math.ceil((new Date(lot.expirationDate) - now) / 86400000);
    const bucket = bucketDefs.find((b) => days <= b) ?? bucketDefs[bucketDefs.length - 1];
    const product = productMap.get(String(q.productId));
    const cost = D(product?.costPrice || 0);
    const value = qty.mul(cost);
    bucketTotals[String(bucket)].qty = bucketTotals[String(bucket)].qty.plus(qty);
    bucketTotals[String(bucket)].value = bucketTotals[String(bucket)].value.plus(value);
    bucketTotals[String(bucket)].lines += 1;
    lines.push({
      lotId: lot._id,
      lotName: lot.name,
      productId: q.productId,
      productName: product?.nameEn || product?.sku,
      sku: product?.sku,
      locationId: q.locationId,
      qty: decStr(qty),
      expirationDate: lot.expirationDate,
      daysToExpiry: days,
      bucketDays: bucket,
      valueAtRisk: decStr(value),
      inventoryStatus: q.inventoryStatus || 'available',
      quantId: q._id,
    });
  }

  lines.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  let totalQty = D(0);
  let totalValue = D(0);
  const bucketRows = bucketDefs.map((d) => {
    const row = bucketTotals[String(d)];
    totalQty = totalQty.plus(row.qty);
    totalValue = totalValue.plus(row.value);
    return {
      withinDays: d,
      lineCount: row.lines,
      qty: decStr(row.qty),
      valueAtRisk: decStr(row.value),
    };
  });

  return {
    buckets: bucketRows,
    lines,
    totals: { qty: decStr(totalQty), valueAtRisk: decStr(totalValue) },
  };
}

/** B.10 — stock ageing by receipt date buckets */
export async function stockAgeingReport(tenantId, { warehouseId } = {}) {
  const tid = toObjectId(tenantId);
  let locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = warehouseId;
  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);
  const quants = await InvQuant.find({
    tenantId: tid,
    locationId: { $in: locIds },
    quantity: { $ne: '0' },
  }).lean();
  const productIds = [...new Set(quants.map((q) => String(q.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).select('nameEn sku costPrice').lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const buckets = { '0-30': D(0), '31-60': D(0), '61-90': D(0), '90+': D(0) };
  const bucketValue = { '0-30': D(0), '31-60': D(0), '61-90': D(0), '90+': D(0) };
  const now = Date.now();
  const lines = [];
  for (const q of quants) {
    const qty = D(q.quantity || 0);
    if (qty.lte(0)) continue;
    const ageDays = q.inDate ? Math.floor((now - new Date(q.inDate)) / 86400000) : 0;
    const bucket = ageDays <= 30 ? '0-30' : ageDays <= 60 ? '31-60' : ageDays <= 90 ? '61-90' : '90+';
    const product = productMap.get(String(q.productId));
    const cost = D(product?.costPrice || 0);
    const value = qty.mul(cost);
    buckets[bucket] = buckets[bucket].plus(qty);
    bucketValue[bucket] = bucketValue[bucket].plus(value);
    lines.push({
      productId: q.productId,
      productName: product?.nameEn || product?.sku,
      sku: product?.sku,
      qty: decStr(qty),
      ageDays,
      bucket,
      value: decStr(value),
      inDate: q.inDate,
    });
  }
  return {
    buckets: Object.keys(buckets).map((k) => ({
      bucket: k,
      qty: decStr(buckets[k]),
      value: decStr(bucketValue[k]),
    })),
    lines: lines.sort((a, b) => b.ageDays - a.ageDays),
  };
}

/** B.10 — dead / slow stock (no outbound in N days) */
export async function deadStockReport(tenantId, { warehouseId, inactiveDays = 90 } = {}) {
  const tid = toObjectId(tenantId);
  const since = new Date();
  since.setDate(since.getDate() - (Number(inactiveDays) || 90));
  let locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = warehouseId;
  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);

  const activeProducts = new Set();
  const outLines = await InvMoveLine.find({
    tenantId: tid,
    state: 'done',
    updatedAt: { $gte: since },
    sourceLocationId: { $in: locIds },
  }).select('productId').lean();
  for (const l of outLines) activeProducts.add(String(l.productId));

  const quants = await InvQuant.find({
    tenantId: tid,
    locationId: { $in: locIds },
    quantity: { $ne: '0' },
  }).lean();
  const productIds = [...new Set(quants.map((q) => String(q.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).select('nameEn sku costPrice').lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const byProduct = new Map();
  for (const q of quants) {
    const pid = String(q.productId);
    const qty = D(q.quantity || 0);
    if (qty.lte(0)) continue;
    const prev = byProduct.get(pid) || { qty: D(0), productId: q.productId };
    prev.qty = prev.qty.plus(qty);
    byProduct.set(pid, prev);
  }

  const lines = [];
  let totalValue = D(0);
  for (const [pid, row] of byProduct) {
    if (activeProducts.has(pid)) continue;
    const product = productMap.get(pid);
    const value = row.qty.mul(D(product?.costPrice || 0));
    totalValue = totalValue.plus(value);
    lines.push({
      productId: row.productId,
      productName: product?.nameEn || product?.sku,
      sku: product?.sku,
      qty: decStr(row.qty),
      value: decStr(value),
      inactiveDays: Number(inactiveDays) || 90,
    });
  }
  lines.sort((a, b) => Number(b.value) - Number(a.value));
  return { lines, totals: { value: decStr(totalValue), count: lines.length }, inactiveDays };
}

/** B.10 — mock recall: trace lot to customers/deliveries */
export async function mockRecallReport(tenantId, lotId) {
  const tid = toObjectId(tenantId);
  const lot = await InvLot.findOne({ _id: lotId, tenantId: tid }).lean();
  if (!lot) throw new InventoryValidationError('Lot not found', 'LOT_NOT_FOUND');

  const lines = await InvMoveLine.find({
    tenantId: tid,
    lotId: lot._id,
    state: 'done',
  })
    .populate('transferId', 'name partnerId state scheduledDate')
    .populate('destLocationId', 'usage name')
    .limit(500)
    .lean();

  const hits = [];
  for (const line of lines) {
    const destInternal = line.destLocationId?.usage !== 'internal';
    if (!destInternal) continue;
    hits.push({
      transferId: line.transferId?._id,
      transferName: line.transferId?.name,
      partnerId: line.transferId?.partnerId,
      qty: line.quantityInProductUom || line.quantity,
      date: line.transferId?.scheduledDate || line.updatedAt,
      lotName: lot.name,
      productId: lot.productId,
    });
  }
  return { lot, deliveries: hits, totalQty: decStr(hits.reduce((s, h) => s + Number(h.qty || 0), 0)) };
}

/** B.3/B.10 — count accuracy by location */
export async function countAccuracyReport(tenantId, { months = 6 } = {}) {
  const tid = toObjectId(tenantId);
  const since = new Date();
  since.setMonth(since.getMonth() - (Number(months) || 6));
  const quants = await InvQuant.find({
    tenantId: tid,
    lastCountDate: { $gte: since },
    countSnapshotQty: { $ne: null },
    countedQuantity: { $ne: null },
  }).populate('locationId', 'name completePath').limit(2000).lean();

  const byLoc = new Map();
  for (const q of quants) {
    const locKey = String(q.locationId?._id || 'unknown');
    const snap = D(q.countSnapshotQty || 0);
    const counted = D(q.countedQuantity || 0);
    const diff = counted.minus(snap).abs();
    const acc = snap.eq(0) ? (counted.eq(0) ? D(1) : D(0)) : D(1).minus(diff.div(snap));
    const row = byLoc.get(locKey) || {
      locationId: q.locationId?._id,
      locationName: q.locationId?.completePath || q.locationId?.name,
      lines: 0,
      accuracySum: D(0),
    };
    row.lines += 1;
    row.accuracySum = row.accuracySum.plus(acc);
    byLoc.set(locKey, row);
  }
  const locations = [...byLoc.values()].map((r) => ({
    locationId: r.locationId,
    locationName: r.locationName,
    lines: r.lines,
    accuracyPct: decStr(r.lines ? r.accuracySum.div(r.lines).mul(100) : D(0)),
  })).sort((a, b) => Number(b.accuracyPct) - Number(a.accuracyPct));
  return { locations, months: Number(months) || 6 };
}

/** B.10 — inventory turns + days sales of inventory (DSI) */
export async function inventoryTurnsReport(tenantId, { warehouseId, windowDays = 365 } = {}) {
  const tid = toObjectId(tenantId);
  const days = Math.max(30, Number(windowDays) || 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  let locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = warehouseId;
  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);

  const outbound = await InvMoveLine.find({
    tenantId: tid,
    state: 'done',
    updatedAt: { $gte: since },
    sourceLocationId: { $in: locIds },
  }).select('productId quantityInProductUom quantity').lean();

  const cogsByProduct = new Map();
  for (const line of outbound) {
    const pid = String(line.productId);
    const qty = D(line.quantityInProductUom || line.quantity || 0);
    cogsByProduct.set(pid, (cogsByProduct.get(pid) || D(0)).plus(qty));
  }

  const quants = await InvQuant.find({
    tenantId: tid,
    locationId: { $in: locIds },
    quantity: { $ne: '0' },
  }).select('productId quantity').lean();

  const onHandByProduct = new Map();
  for (const q of quants) {
    const pid = String(q.productId);
    onHandByProduct.set(pid, (onHandByProduct.get(pid) || D(0)).plus(D(q.quantity || 0)));
  }

  const allIds = [...new Set([...cogsByProduct.keys(), ...onHandByProduct.keys()])];
  const products = await Product.find({ _id: { $in: allIds }, tenantId: tid })
    .select('nameEn sku costPrice')
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const lines = [];
  let totalCogs = D(0);
  let totalAvgInv = D(0);

  for (const pid of allIds) {
    const product = productMap.get(pid);
    if (!product) continue;
    const cost = D(product.costPrice || 0);
    const unitsOut = cogsByProduct.get(pid) || D(0);
    const cogs = unitsOut.mul(cost);
    const onHand = onHandByProduct.get(pid) || D(0);
    const avgInvValue = onHand.mul(cost);
    const turns = avgInvValue.gt(0) ? cogs.div(avgInvValue) : D(0);
    const dsi = turns.gt(0) ? D(days).div(turns) : null;

    totalCogs = totalCogs.plus(cogs);
    totalAvgInv = totalAvgInv.plus(avgInvValue);

    if (cogs.lte(0) && onHand.lte(0)) continue;
    lines.push({
      productId: pid,
      productName: product.nameEn || product.sku,
      sku: product.sku,
      unitsOut: decStr(unitsOut),
      cogs: decStr(cogs),
      onHand: decStr(onHand),
      avgInventoryValue: decStr(avgInvValue),
      turns: decStr(turns),
      dsiDays: dsi != null ? decStr(dsi) : null,
    });
  }

  lines.sort((a, b) => Number(b.cogs) - Number(a.cogs));
  const portfolioTurns = totalAvgInv.gt(0) ? totalCogs.div(totalAvgInv) : D(0);
  const portfolioDsi = portfolioTurns.gt(0) ? D(days).div(portfolioTurns) : null;

  return {
    windowDays: days,
    totals: {
      cogs: decStr(totalCogs),
      avgInventoryValue: decStr(totalAvgInv),
      turns: decStr(portfolioTurns),
      dsiDays: portfolioDsi != null ? decStr(portfolioDsi) : null,
    },
    lines,
  };
}
