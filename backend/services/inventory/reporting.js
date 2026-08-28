import { D, decStr } from '../../utils/decimal.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvLot from '../../models/inventory/InvLot.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvProductVariant from '../../models/inventory/InvProductVariant.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { computeForecast } from './forecast.js';
import { productInventoryValue } from './valuation.js';
import { InventoryValidationError } from './errors.js';

/** Financial string rounded to 2 decimal places. */
function money2(v) {
  return decStr(D(v || 0).toDecimalPlaces(2));
}

function variantKey(productId, variantId) {
  return `${String(productId || '')}|${variantId ? String(variantId) : ''}`;
}

function buildReportProductName(product, variant) {
  const base = product?.nameEn || product?.nameAr || product?.sku || null;
  if (variant?.name) {
    return base ? `${base} - ${variant.name}` : variant.name;
  }
  return base || variant?.sku || null;
}

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
    .populate('variantId', 'name sku')
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
    let label;
    if (groupBy === 'day') {
      key = new Date(line.updatedAt).toISOString().slice(0, 10);
      label = key;
    } else if (groupBy === 'partner') {
      key = String(line.transferId?.partnerId || 'none');
      label = key;
    } else {
      const pid = line.productId?._id || line.productId;
      const vid = line.variantId?._id || line.variantId || null;
      key = variantKey(pid, vid);
      label = buildReportProductName(line.productId, line.variantId)
        || (pid ? `[Unknown/Deleted Product: ID ${pid}]` : '[Unknown/Deleted Product]');
    }

    const prev = buckets.get(key) || {
      key,
      label,
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
    return { asOf: at.toISOString(), data: [], total: 0, valueTotal: '0.00' };
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
    .select('productId variantId quantityInProductUom quantity sourceLocationId destLocationId')
    .lean();

  const qtyByKey = new Map();
  const metaByKey = new Map();
  for (const line of lines) {
    const key = variantKey(line.productId, line.variantId);
    const qty = D(line.quantityInProductUom || line.quantity || 0);
    let net = qtyByKey.get(key) || D(0);
    if (locSet.has(String(line.destLocationId))) net = net.plus(qty);
    if (locSet.has(String(line.sourceLocationId))) net = net.minus(qty);
    qtyByKey.set(key, net);
    if (!metaByKey.has(key)) {
      metaByKey.set(key, {
        productId: line.productId,
        variantId: line.variantId || null,
      });
    }
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

  const onHandByProduct = new Map();
  for (const [key, qty] of qtyByKey) {
    const meta = metaByKey.get(key);
    const pid = String(meta.productId);
    onHandByProduct.set(pid, (onHandByProduct.get(pid) || D(0)).plus(qty));
  }

  const keys = [...qtyByKey.keys()].filter((key) => {
    const q = qtyByKey.get(key) || D(0);
    const pid = String(metaByKey.get(key).productId);
    const v = valueByProduct.get(pid) || D(0);
    return !q.eq(0) || !v.eq(0);
  });

  const productIds = [...new Set(keys.map((k) => String(metaByKey.get(k).productId)))];
  const variantIds = [...new Set(
    keys.map((k) => metaByKey.get(k).variantId).filter(Boolean).map(String),
  )];
  const [products, variants] = await Promise.all([
    Product.find({ tenantId: tid, _id: { $in: productIds } })
      .select('nameEn nameAr sku barcode costPrice unitOfMeasure')
      .lean(),
    variantIds.length
      ? InvProductVariant.find({ tenantId: tid, _id: { $in: variantIds } })
        .select('name sku productId standardPrice')
        .lean()
      : Promise.resolve([]),
  ]);
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  const rows = [];
  let valueTotal = D(0);
  for (const key of keys) {
    const meta = metaByKey.get(key);
    const p = byId.get(String(meta.productId));
    const v = meta.variantId ? variantById.get(String(meta.variantId)) : null;
    const onHandD = qtyByKey.get(key) || D(0);
    if (onHandD.eq(0) && !(valueByProduct.get(String(meta.productId)) || D(0)).eq(0)) {
      // Skip zero-qty variants that only exist due to product-level valuation residual.
      continue;
    }
    const onHand = decStr(onHandD);
    const productOnHand = onHandByProduct.get(String(meta.productId)) || D(0);
    const layerValue = valueByProduct.get(String(meta.productId)) || D(0);
    const costBase = v?.standardPrice != null && v.standardPrice !== ''
      ? v.standardPrice
      : (p?.costPrice || 0);
    let valueD;
    if (!layerValue.eq(0) && productOnHand.gt(0)) {
      valueD = layerValue.mul(onHandD).div(productOnHand);
    } else {
      valueD = onHandD.mul(D(costBase || 0));
    }
    valueTotal = valueTotal.plus(valueD);
    const unitCost = onHandD.eq(0)
      ? money2(costBase || 0)
      : money2(valueD.div(onHandD));
    const productName = buildReportProductName(p, v)
      || (meta.productId
        ? `[Unknown/Deleted Product: ID ${meta.productId}]`
        : '[Unknown/Deleted Product]');

    rows.push({
      productId: meta.productId,
      variantId: meta.variantId,
      product: p || null,
      variant: v || null,
      productName,
      sku: v?.sku || p?.sku || '',
      onHand,
      reserved: '0',
      freeToUse: onHand,
      incoming: '0',
      outgoing: '0',
      forecast: onHand,
      unitCost,
      value: money2(valueD),
      asOf: true,
    });
  }

  rows.sort((a, b) => String(a.productName).localeCompare(String(b.productName)));
  return {
    asOf: at.toISOString(),
    data: rows,
    total: rows.length,
    valueTotal: money2(valueTotal),
  };
}

/**
 * Live stock report in a bounded number of queries (no per-product N+1).
 * Groups by productId + variantId so templates with variants are not aggregated.
 */
export async function stockReportLive(tenantId, { warehouseId, locIds, productId, includeZeroVariants = true } = {}) {
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
    return { data: [], total: 0, valueTotal: '0.00' };
  }

  const internalIds = new Set(locations.map(String));

  const [quants, pendingMoves, valueAgg] = await Promise.all([
    InvQuant.aggregate([
      { $match: { tenantId: tid, locationId: { $in: locations } } },
      {
        $group: {
          _id: {
            productId: '$productId',
            variantId: { $ifNull: ['$variantId', null] },
          },
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
    }).select('productId variantId sourceLocationId destLocationId demandQty doneQty').lean(),
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

  const productIds = [...new Set(quants.map((q) => String(q._id.productId)))];
  const variantIds = [...new Set(
    quants.map((q) => q._id.variantId).filter(Boolean).map(String),
  )];

  const [products, variants] = await Promise.all([
    Product.find({ tenantId: tid, _id: { $in: productIds } })
      .select('nameEn nameAr sku barcode costPrice unitOfMeasure uomId sellingPrice')
      .lean(),
    variantIds.length
      ? InvProductVariant.find({ tenantId: tid, _id: { $in: variantIds } })
        .select('name sku barcode productId standardPrice extraPrice')
        .lean()
      : Promise.resolve([]),
  ]);
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  const ioByKey = new Map();
  for (const m of pendingMoves) {
    const key = variantKey(m.productId, m.variantId);
    const qty = D(m.demandQty).minus(D(m.doneQty || 0));
    if (qty.lte(0)) continue;
    const srcInternal = internalIds.has(String(m.sourceLocationId));
    const destInternal = internalIds.has(String(m.destLocationId));
    const prev = ioByKey.get(key) || { incoming: D(0), outgoing: D(0) };
    if (destInternal && !srcInternal) prev.incoming = prev.incoming.plus(qty);
    if (srcInternal && !destInternal) prev.outgoing = prev.outgoing.plus(qty);
    ioByKey.set(key, prev);
  }

  const valueByProduct = new Map(
    valueAgg.map((r) => {
      const rem = D(r.remainingValueNum?.toString?.() || '0');
      const fallback = D(r.valueNum?.toString?.() || '0');
      return [String(r._id), rem.eq(0) ? fallback : rem];
    }),
  );

  const onHandByProduct = new Map();
  for (const q of quants) {
    const pid = String(q._id.productId);
    onHandByProduct.set(
      pid,
      (onHandByProduct.get(pid) || D(0)).plus(D(q.onHandNum?.toString?.() || '0')),
    );
  }

  const rows = [];
  let valueTotal = D(0);
  for (const q of quants) {
    const productId = q._id.productId;
    const variantId = q._id.variantId || null;
    const p = byId.get(String(productId));
    const v = variantId ? variantById.get(String(variantId)) : null;
    const key = variantKey(productId, variantId);
    const onHand = decStr(q.onHandNum?.toString?.() || '0');
    const reserved = decStr(q.reservedNum?.toString?.() || '0');
    const io = ioByKey.get(key) || { incoming: D(0), outgoing: D(0) };
    const incoming = decStr(io.incoming);
    const outgoing = decStr(io.outgoing);
    const forecast = decStr(D(onHand).plus(io.incoming).minus(io.outgoing));

    const costBase = v?.standardPrice != null && v.standardPrice !== ''
      ? v.standardPrice
      : (p?.costPrice || 0);

    const productOnHand = onHandByProduct.get(String(productId)) || D(0);
    const layerValue = valueByProduct.get(String(productId));
    let valueD;
    if (layerValue != null && !layerValue.eq(0) && productOnHand.gt(0)) {
      valueD = layerValue.mul(D(onHand)).div(productOnHand);
    } else {
      valueD = D(onHand).mul(D(costBase || 0));
    }
    valueTotal = valueTotal.plus(valueD);
    const unitCost = D(onHand).eq(0)
      ? money2(costBase || 0)
      : money2(valueD.div(D(onHand)));

    const productName = buildReportProductName(p, v)
      || (productId ? `[Unknown/Deleted Product: ID ${productId}]` : '[Unknown/Deleted Product]');

    rows.push({
      productId,
      variantId,
      product: p || null,
      variant: v || null,
      productName,
      sku: v?.sku || p?.sku || '',
      onHand,
      reserved,
      freeToUse: decStr(D(onHand).minus(D(reserved))),
      incoming,
      outgoing,
      forecast,
      unitCost,
      value: money2(valueD),
    });
  }

  if (includeZeroVariants !== false) {
    const keysInRows = new Set(rows.map((r) => variantKey(r.productId, r.variantId)));
    const variantMatch = { tenantId: tid, active: { $ne: false } };
    if (productId) {
      variantMatch.productId = toObjectId(productId);
    } else if (quants.length) {
      variantMatch.productId = { $in: [...new Set(quants.map((q) => q._id.productId))] };
    }

    if (productId || quants.length) {
      const zeroVariants = await InvProductVariant.find(variantMatch)
        .select('name sku barcode productId standardPrice extraPrice')
        .lean();

      const missingProductIds = [...new Set(
        zeroVariants.map((v) => String(v.productId)).filter((pid) => !byId.has(pid)),
      )];
      if (missingProductIds.length) {
        const extraProducts = await Product.find({ tenantId: tid, _id: { $in: missingProductIds } })
          .select('nameEn nameAr sku barcode costPrice unitOfMeasure uomId sellingPrice')
          .lean();
        for (const p of extraProducts) byId.set(String(p._id), p);
      }
      for (const v of zeroVariants) variantById.set(String(v._id), v);

      for (const v of zeroVariants) {
        const pid = v.productId;
        const vid = v._id;
        const key = variantKey(pid, vid);
        if (keysInRows.has(key)) continue;

        const p = byId.get(String(pid));
        const io = ioByKey.get(key) || { incoming: D(0), outgoing: D(0) };
        const incoming = decStr(io.incoming);
        const outgoing = decStr(io.outgoing);
        const onHand = '0';
        const reserved = '0';
        const forecast = decStr(D(onHand).plus(io.incoming).minus(io.outgoing));
        const costBase = v?.standardPrice != null && v.standardPrice !== ''
          ? v.standardPrice
          : (p?.costPrice || 0);
        const productName = buildReportProductName(p, v)
          || (pid ? `[Unknown/Deleted Product: ID ${pid}]` : '[Unknown/Deleted Product]');

        rows.push({
          productId: pid,
          variantId: vid,
          product: p || null,
          variant: v || null,
          productName,
          sku: v?.sku || p?.sku || '',
          onHand,
          reserved,
          freeToUse: '0',
          incoming,
          outgoing,
          forecast,
          unitCost: money2(costBase || 0),
          value: money2(0),
        });
        keysInRows.add(key);
      }
    }
  }

  rows.sort((a, b) => String(a.productName).localeCompare(String(b.productName)));
  return { data: rows, total: rows.length, valueTotal: money2(valueTotal) };
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
  const variantIds = [...new Set(quants.map((q) => q.variantId).filter(Boolean).map(String))];
  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('nameEn nameAr sku costPrice').lean(),
    variantIds.length
      ? InvProductVariant.find({ tenantId: tid, _id: { $in: variantIds } })
        .select('name sku productId standardPrice')
        .lean()
      : Promise.resolve([]),
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const variantMap = new Map(variants.map((v) => [String(v._id), v]));
  const buckets = { '0-30': D(0), '31-60': D(0), '61-90': D(0), '90+': D(0) };
  const bucketValue = { '0-30': D(0), '31-60': D(0), '61-90': D(0), '90+': D(0) };
  const now = Date.now();
  const byKey = new Map();

  for (const q of quants) {
    const qty = D(q.quantity || 0);
    if (qty.lte(0)) continue;
    const ageDays = q.inDate ? Math.floor((now - new Date(q.inDate)) / 86400000) : 0;
    const bucket = ageDays <= 30 ? '0-30' : ageDays <= 60 ? '31-60' : ageDays <= 90 ? '61-90' : '90+';
    const product = productMap.get(String(q.productId));
    const variant = q.variantId ? variantMap.get(String(q.variantId)) : null;
    const cost = D(
      variant?.standardPrice != null && variant.standardPrice !== ''
        ? variant.standardPrice
        : (product?.costPrice || 0),
    );
    const value = qty.mul(cost);
    buckets[bucket] = buckets[bucket].plus(qty);
    bucketValue[bucket] = bucketValue[bucket].plus(value);

    const key = variantKey(q.productId, q.variantId);
    let row = byKey.get(key);
    if (!row) {
      row = {
        productId: q.productId,
        variantId: q.variantId || null,
        productName: buildReportProductName(product, variant)
          || (q.productId ? `[Unknown/Deleted Product: ID ${q.productId}]` : '[Unknown/Deleted Product]'),
        sku: variant?.sku || product?.sku || '',
        qty: D(0),
        value: D(0),
        maxAgeDays: 0,
        bucketQty: { '0-30': D(0), '31-60': D(0), '61-90': D(0), '90+': D(0) },
        bucketValue: { '0-30': D(0), '31-60': D(0), '61-90': D(0), '90+': D(0) },
      };
      byKey.set(key, row);
    }
    row.qty = row.qty.plus(qty);
    row.value = row.value.plus(value);
    row.maxAgeDays = Math.max(row.maxAgeDays, ageDays);
    row.bucketQty[bucket] = row.bucketQty[bucket].plus(qty);
    row.bucketValue[bucket] = row.bucketValue[bucket].plus(value);
  }

  const lines = [...byKey.values()].map((row) => ({
    productId: row.productId,
    variantId: row.variantId,
    productName: row.productName,
    sku: row.sku,
    qty: decStr(row.qty),
    value: money2(row.value),
    ageDays: row.maxAgeDays,
    bucket: row.maxAgeDays <= 30 ? '0-30' : row.maxAgeDays <= 60 ? '31-60' : row.maxAgeDays <= 90 ? '61-90' : '90+',
    qty0_30: decStr(row.bucketQty['0-30']),
    qty31_60: decStr(row.bucketQty['31-60']),
    qty61_90: decStr(row.bucketQty['61-90']),
    qty90plus: decStr(row.bucketQty['90+']),
    value0_30: money2(row.bucketValue['0-30']),
    value31_60: money2(row.bucketValue['31-60']),
    value61_90: money2(row.bucketValue['61-90']),
    value90plus: money2(row.bucketValue['90+']),
  })).sort((a, b) => b.ageDays - a.ageDays);

  return {
    buckets: Object.keys(buckets).map((k) => ({
      bucket: k,
      qty: decStr(buckets[k]),
      value: money2(bucketValue[k]),
    })),
    lines,
  };
}

/** B.10 — dead / slow stock (no outbound in N days) */
export async function deadStockReport(tenantId, { warehouseId, inactiveDays = 90 } = {}) {
  const tid = toObjectId(tenantId);
  const days = Number(inactiveDays) || 90;
  const since = new Date();
  since.setDate(since.getDate() - days);
  let locFilter = { tenantId: tid, usage: 'internal', active: true };
  if (warehouseId) locFilter.warehouseId = warehouseId;
  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);

  const [lastMovedAgg, quants] = await Promise.all([
    InvMoveLine.aggregate([
      {
        $match: {
          tenantId: tid,
          state: 'done',
          sourceLocationId: { $in: locIds },
        },
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            variantId: { $ifNull: ['$variantId', null] },
          },
          lastMovedAt: { $max: '$updatedAt' },
        },
      },
    ]),
    InvQuant.find({
      tenantId: tid,
      locationId: { $in: locIds },
      quantity: { $ne: '0' },
    }).lean(),
  ]);

  const lastMovedByKey = new Map(
    lastMovedAgg.map((r) => [variantKey(r._id.productId, r._id.variantId), r.lastMovedAt]),
  );

  const productIds = [...new Set(quants.map((q) => String(q.productId)))];
  const variantIds = [...new Set(quants.map((q) => q.variantId).filter(Boolean).map(String))];
  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('nameEn nameAr sku costPrice').lean(),
    variantIds.length
      ? InvProductVariant.find({ tenantId: tid, _id: { $in: variantIds } })
        .select('name sku productId standardPrice')
        .lean()
      : Promise.resolve([]),
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const variantMap = new Map(variants.map((v) => [String(v._id), v]));

  const byKey = new Map();
  for (const q of quants) {
    const qty = D(q.quantity || 0);
    if (qty.lte(0)) continue;
    const key = variantKey(q.productId, q.variantId);
    const prev = byKey.get(key) || {
      productId: q.productId,
      variantId: q.variantId || null,
      qty: D(0),
      oldestInDate: q.inDate || null,
    };
    prev.qty = prev.qty.plus(qty);
    if (q.inDate && (!prev.oldestInDate || new Date(q.inDate) < new Date(prev.oldestInDate))) {
      prev.oldestInDate = q.inDate;
    }
    byKey.set(key, prev);
  }

  const now = Date.now();
  const lines = [];
  let totalValue = D(0);
  for (const [key, row] of byKey) {
    const lastMovedAt = lastMovedByKey.get(key) || null;
    const activityAt = lastMovedAt || row.oldestInDate || null;
    if (activityAt && new Date(activityAt) >= since) continue;

    const product = productMap.get(String(row.productId));
    const variant = row.variantId ? variantMap.get(String(row.variantId)) : null;
    const cost = D(
      variant?.standardPrice != null && variant.standardPrice !== ''
        ? variant.standardPrice
        : (product?.costPrice || 0),
    );
    const value = row.qty.mul(cost);
    totalValue = totalValue.plus(value);
    const daysSinceMove = activityAt
      ? Math.floor((now - new Date(activityAt).getTime()) / 86400000)
      : null;

    lines.push({
      productId: row.productId,
      variantId: row.variantId,
      productName: buildReportProductName(product, variant)
        || (row.productId ? `[Unknown/Deleted Product: ID ${row.productId}]` : '[Unknown/Deleted Product]'),
      sku: variant?.sku || product?.sku || '',
      qty: decStr(row.qty),
      value: money2(value),
      lastMovedAt: lastMovedAt || null,
      lastMovedDate: lastMovedAt || row.oldestInDate || null,
      daysSinceMove,
      inactiveDays: days,
    });
  }
  lines.sort((a, b) => Number(b.value) - Number(a.value));
  return { lines, totals: { value: money2(totalValue), count: lines.length }, inactiveDays: days };
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
  }).select('productId variantId quantityInProductUom quantity').lean();

  const cogsByKey = new Map();
  for (const line of outbound) {
    const key = variantKey(line.productId, line.variantId);
    const qty = D(line.quantityInProductUom || line.quantity || 0);
    cogsByKey.set(key, (cogsByKey.get(key) || D(0)).plus(qty));
  }

  const quants = await InvQuant.find({
    tenantId: tid,
    locationId: { $in: locIds },
    quantity: { $ne: '0' },
  }).select('productId variantId quantity').lean();

  const onHandByKey = new Map();
  const metaByKey = new Map();
  for (const q of quants) {
    const key = variantKey(q.productId, q.variantId);
    onHandByKey.set(key, (onHandByKey.get(key) || D(0)).plus(D(q.quantity || 0)));
    if (!metaByKey.has(key)) {
      metaByKey.set(key, { productId: q.productId, variantId: q.variantId || null });
    }
  }
  for (const line of outbound) {
    const key = variantKey(line.productId, line.variantId);
    if (!metaByKey.has(key)) {
      metaByKey.set(key, { productId: line.productId, variantId: line.variantId || null });
    }
  }

  const productIds = [...new Set([...metaByKey.values()].map((m) => String(m.productId)))];
  const variantIds = [...new Set(
    [...metaByKey.values()].map((m) => m.variantId).filter(Boolean).map(String),
  )];
  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds }, tenantId: tid })
      .select('nameEn nameAr sku costPrice')
      .lean(),
    variantIds.length
      ? InvProductVariant.find({ tenantId: tid, _id: { $in: variantIds } })
        .select('name sku productId standardPrice')
        .lean()
      : Promise.resolve([]),
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const variantMap = new Map(variants.map((v) => [String(v._id), v]));

  const lines = [];
  let totalCogs = D(0);
  let totalAvgInv = D(0);

  for (const [key, meta] of metaByKey) {
    const product = productMap.get(String(meta.productId));
    const variant = meta.variantId ? variantMap.get(String(meta.variantId)) : null;
    const cost = D(
      variant?.standardPrice != null && variant.standardPrice !== ''
        ? variant.standardPrice
        : (product?.costPrice || 0),
    );
    const unitsOut = cogsByKey.get(key) || D(0);
    const cogs = unitsOut.mul(cost);
    const onHand = onHandByKey.get(key) || D(0);
    const avgInvValue = onHand.mul(cost);
    const turns = avgInvValue.gt(0) ? cogs.div(avgInvValue) : D(0);
    const dsi = turns.gt(0) ? D(days).div(turns) : null;

    totalCogs = totalCogs.plus(cogs);
    totalAvgInv = totalAvgInv.plus(avgInvValue);

    if (cogs.lte(0) && onHand.lte(0)) continue;
    const productName = buildReportProductName(product, variant)
      || (meta.productId
        ? `[Unknown/Deleted Product: ID ${meta.productId}]`
        : '[Unknown/Deleted Product]');

    lines.push({
      productId: meta.productId,
      variantId: meta.variantId,
      productName,
      sku: variant?.sku || product?.sku || '',
      unitsOut: decStr(unitsOut),
      cogs: money2(cogs),
      onHand: decStr(onHand),
      avgInventoryValue: money2(avgInvValue),
      turns: money2(turns),
      dsiDays: dsi != null ? String(Math.round(Number(decStr(dsi)))) : null,
    });
  }

  lines.sort((a, b) => Number(b.cogs) - Number(a.cogs));
  const portfolioTurns = totalAvgInv.gt(0) ? totalCogs.div(totalAvgInv) : D(0);
  const portfolioDsi = portfolioTurns.gt(0) ? D(days).div(portfolioTurns) : null;

  return {
    windowDays: days,
    totals: {
      cogs: money2(totalCogs),
      avgInventoryValue: money2(totalAvgInv),
      turns: money2(portfolioTurns),
      dsiDays: portfolioDsi != null ? String(Math.round(Number(decStr(portfolioDsi)))) : null,
    },
    lines,
  };
}
