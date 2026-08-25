import { D, decStr } from '../../utils/decimal.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvLocation from '../../models/inventory/InvLocation.js';
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
