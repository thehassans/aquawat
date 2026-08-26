import { D, decStr, decIsZero } from '../../utils/decimal.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvMoveLine from '../../models/inventory/InvMoveLine.js';
import Product from '../../models/Product.js';
import InvSettings from '../../models/inventory/InvSettings.js';
import { toObjectId, setDecimalPair } from '../../models/inventory/common.js';
import { applyQuantDelta } from './quantDelta.js';
import { runWithTransaction } from './reserve.js';
import { getDefaultUom } from './bootstrap.js';
import { InventoryValidationError } from './errors.js';
import { withTenant } from '../../utils/tenantScope.js';
import { computeMoveDoneChecksum, computeMoveLineDoneChecksum } from './doneChecksum.js';

export const COUNT_REASON_CODES = [
  { code: 'damage', label: 'Damage', labelAr: 'تلف' },
  { code: 'theft_loss', label: 'Theft/Loss', labelAr: 'سرقة/فقدان' },
  { code: 'expiry', label: 'Expiry', labelAr: 'انتهاء صلاحية' },
  { code: 'found', label: 'Found', labelAr: 'عثر عليه' },
  { code: 'supplier_shortage', label: 'Supplier shortage', labelAr: 'نقص مورد' },
  { code: 'data_entry_error', label: 'Data entry error', labelAr: 'خطأ إدخال' },
];

/**
 * List quants for physical inventory (editable count fields).
 */
export async function listInventoryQuants(tenantId, {
  locationId,
  warehouseId,
  productId,
  filter: filterName,
  search,
  page = 1,
  limit = 100,
} = {}) {
  const tid = toObjectId(tenantId);
  const locFilter = withTenant(tid, { usage: 'internal', active: true });
  if (warehouseId) locFilter.warehouseId = warehouseId;
  if (locationId) locFilter._id = locationId;

  const locs = await InvLocation.find(locFilter).select('_id').lean();
  const locIds = locs.map((l) => l._id);
  if (!locIds.length) {
    return {
      data: [],
      _meta: {
        total: 0,
        page: 1,
        pageSize: limit,
        totals: emptyCountTotals(),
        appliedFilters: { filter: filterName || null },
      },
    };
  }

  const filter = withTenant(tid, { locationId: { $in: locIds } });
  if (productId) filter.productId = productId;

  if (filterName === 'toCount') {
    filter.$or = [
      { lastCountDate: { $exists: false } },
      { lastCountDate: null },
      { countScheduledDate: { $lte: new Date() } },
      { isCountSet: false, countedQuantity: null },
    ];
  } else if (filterName === 'toApply') {
    filter.isCountSet = true;
  } else if (filterName === 'negative') {
    filter.$expr = { $lt: [{ $toDouble: '$quantity' }, 0] };
  } else if (filterName === 'scheduledMonth') {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    filter.countScheduledDate = { $gte: start, $lt: end };
  }

  if (search?.trim()) {
    const products = await Product.find({
      tenantId: tid,
      $or: [
        { nameEn: new RegExp(search.trim(), 'i') },
        { nameAr: new RegExp(search.trim(), 'i') },
        { sku: new RegExp(search.trim(), 'i') },
        { barcode: new RegExp(search.trim(), 'i') },
      ],
    }).select('_id').limit(200).lean();
    filter.productId = { $in: products.map((p) => p._id) };
  }

  const pageN = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(limit) || 100));
  const skip = (pageN - 1) * pageSize;

  const [rows, total, totals] = await Promise.all([
    InvQuant.find(filter)
      .populate({
        path: 'productId',
        select: 'nameEn nameAr sku barcode unitOfMeasure uomId tracking costPrice',
        populate: { path: 'uomId', select: 'name' },
      })
      .populate({
        path: 'locationId',
        select: 'name completePath usage warehouseId barcode',
        populate: { path: 'warehouseId', select: 'nameEn nameAr code' },
      })
      .populate('lotId', 'name expirationDate removalDate')
      .populate('packageId', 'name')
      .populate('countUserId', 'name email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    InvQuant.countDocuments(filter),
    computeListTotals(tid, filter),
  ]);

  const data = rows.map((q) => {
    const snapshot = q.countSnapshotQty != null ? D(q.countSnapshotQty) : null;
    const onHand = D(q.quantity);
    const isStale = q.isCountSet && snapshot != null && !snapshot.eq(onHand);
    const uom = q.productId?.uomId?.name || q.productId?.unitOfMeasure || 'PCE';
    return {
      ...q,
      uom,
      isStale,
      differenceValue: decStr(D(q.countDifference || 0).times(D(q.productId?.costPrice || 0))),
    };
  });

  return {
    data,
    _meta: {
      total,
      page: pageN,
      pageSize,
      totals,
      appliedFilters: {
        warehouseId: warehouseId || null,
        locationId: locationId || null,
        filter: filterName || null,
        search: search || null,
      },
    },
  };
}

function emptyCountTotals() {
  return {
    linesToCount: 0,
    linesCounted: 0,
    positiveDiff: '0',
    negativeDiff: '0',
    netValueImpact: '0',
  };
}

async function computeListTotals(tid, filter) {
  const countedFilter = { ...filter, isCountSet: true };
  const [linesToCount, countedRows] = await Promise.all([
    InvQuant.countDocuments(filter),
    InvQuant.find(countedFilter)
      .populate('productId', 'costPrice')
      .select('countDifference productId isCountSet')
      .lean(),
  ]);
  let positiveDiff = D(0);
  let negativeDiff = D(0);
  let netValue = D(0);
  for (const q of countedRows) {
    const diff = D(q.countDifference || 0);
    if (diff.gt(0)) positiveDiff = positiveDiff.plus(diff);
    if (diff.lt(0)) negativeDiff = negativeDiff.plus(diff);
    netValue = netValue.plus(diff.times(D(q.productId?.costPrice || 0)));
  }
  return {
    linesToCount,
    linesCounted: countedRows.length,
    positiveDiff: decStr(positiveDiff),
    negativeDiff: decStr(negativeDiff),
    netValueImpact: decStr(netValue),
  };
}

/**
 * Set counted quantity on a quant (survives reload). Also updates schedule/user when provided.
 */
export async function setCountedQuantity(tenantId, {
  quantId,
  productId,
  locationId,
  lotId,
  packageId,
  countedQty,
  countScheduledDate,
  countUserId,
  userId,
  reason,
  reasonCode,
}) {
  const tid = toObjectId(tenantId);

  let quant;
  if (quantId) {
    quant = await InvQuant.findOne({ _id: quantId, tenantId: tid });
  } else {
    if (!productId || !locationId) {
      throw new InventoryValidationError('productId and locationId required', 'MISSING_FIELDS');
    }
    const dims = {
      tenantId: tid,
      productId,
      locationId,
      variantId: null,
      lotId: lotId || null,
      packageId: packageId || null,
      ownerId: null,
    };
    quant = await InvQuant.findOne(dims);
    if (!quant) {
      const doc = { ...dims, createdBy: userId };
      setDecimalPair(doc, 'quantity', '0');
      setDecimalPair(doc, 'reservedQuantity', '0');
      setDecimalPair(doc, 'value', '0');
      quant = await InvQuant.create(doc);
    }
  }

  if (!quant) throw new InventoryValidationError('Quant not found', 'QUANT_NOT_FOUND');

  if (countedQty != null && countedQty !== '') {
    const counted = decStr(countedQty);
    const onHand = D(quant.quantity);
    quant.countedQuantity = counted;
    quant.isCountSet = true;
    quant.countDifference = decStr(D(counted).minus(onHand));
    quant.countSnapshotQty = decStr(onHand);
  }

  if (countScheduledDate != null) {
    quant.countScheduledDate = countScheduledDate ? new Date(countScheduledDate) : null;
  } else if (quant.isCountSet && !quant.countScheduledDate) {
    quant.countScheduledDate = new Date();
  }

  if (countUserId !== undefined) {
    quant.countUserId = countUserId || null;
  } else if (userId && quant.isCountSet && !quant.countUserId) {
    quant.countUserId = userId;
  }

  if (reason) quant.countReason = reason;
  if (reasonCode) quant.reasonCode = reasonCode;

  // Variance approval flag when |diff| × cost exceeds tenant threshold
  if (quant.isCountSet) {
    const settings = await InvSettings.findOne({ tenantId: tid }).select('varianceApprovalThreshold').lean();
    const threshold = Number(settings?.varianceApprovalThreshold) || 0;
    if (threshold > 0) {
      const product = await Product.findById(quant.productId).select('costPrice').lean();
      const impact = D(quant.countDifference || 0).abs().times(D(product?.costPrice || 0));
      if (impact.gt(threshold)) {
        quant.varianceApprovalRequired = true;
        quant.varianceApprovedAt = null;
        quant.varianceApprovedBy = null;
      } else {
        quant.varianceApprovalRequired = false;
      }
    } else {
      quant.varianceApprovalRequired = false;
    }
  }

  await quant.save();
  return quant;
}

export async function clearCountedQuantity(tenantId, quantId) {
  const quant = await InvQuant.findOne({ _id: quantId, tenantId: toObjectId(tenantId) });
  if (!quant) throw new InventoryValidationError('Quant not found', 'QUANT_NOT_FOUND');
  quant.countedQuantity = null;
  quant.isCountSet = false;
  quant.countDifference = '0';
  quant.countSnapshotQty = null;
  await quant.save();
  return quant;
}

export async function previewApplyCounts(tenantId, ids) {
  const tid = toObjectId(tenantId);
  const quants = await InvQuant.find({
    _id: { $in: ids },
    tenantId: tid,
    isCountSet: true,
  })
    .populate('productId', 'costPrice nameEn sku')
    .lean();

  let positiveDiff = D(0);
  let negativeDiff = D(0);
  let valuationImpact = D(0);
  for (const q of quants) {
    const diff = D(q.countDifference || 0);
    if (diff.gt(0)) positiveDiff = positiveDiff.plus(diff);
    if (diff.lt(0)) negativeDiff = negativeDiff.plus(diff);
    const cost = D(q.productId?.costPrice || 0);
    valuationImpact = valuationImpact.plus(diff.times(cost));
  }
  return {
    lines: quants.length,
    positiveDiff: decStr(positiveDiff),
    negativeDiff: decStr(negativeDiff),
    valuationImpact: decStr(valuationImpact),
  };
}

async function applyOneCount(session, tid, quant, invAdj, defaultUom, now, reason, userId, reasonCode) {
  if (quant.countSnapshotQty != null && !D(quant.countSnapshotQty).eq(D(quant.quantity))) {
    throw new InventoryValidationError(
      'Stock changed since count — recount required',
      'STALE_COUNT',
    );
  }

  const diff = D(quant.countDifference || 0);
  if (decIsZero(diff)) {
    quant.isCountSet = false;
    quant.countedQuantity = null;
    quant.countDifference = '0';
    quant.countSnapshotQty = null;
    quant.lastCountDate = now;
    await quant.save({ session });
    return { quantId: quant._id, skipped: true };
  }

  const product = await Product.findById(quant.productId).session(session);
  const uomId = product?.uomId || defaultUom?._id;
  if (!uomId) {
    throw new InventoryValidationError(`UoM missing for product ${quant.productId}`, 'NO_UOM');
  }

  const absDiff = decStr(diff.abs());
  const isGain = diff.gt(0);
  const sourceLocationId = isGain ? invAdj._id : quant.locationId;
  const destLocationId = isGain ? quant.locationId : invAdj._id;
  const codeLabel = COUNT_REASON_CODES.find((c) => c.code === (reasonCode || quant.reasonCode))?.label;
  const ref = [
    reason || quant.countReason || `INV/${now.toISOString().slice(0, 10)}`,
    codeLabel || reasonCode || quant.reasonCode,
  ].filter(Boolean).join(' · ');

  const [move] = await InvMove.create([{
    tenantId: tid,
    reference: ref,
    origin: ref,
    productId: quant.productId,
    variantId: quant.variantId,
    uomId,
    demandQty: absDiff,
    doneQty: absDiff,
    sourceLocationId,
    destLocationId,
    state: 'done',
    date: now,
    doneAt: now,
    doneChecksum: computeMoveDoneChecksum({
      productId: quant.productId,
      variantId: quant.variantId,
      demandQty: absDiff,
      doneQty: absDiff,
      sourceLocationId,
      destLocationId,
      uomId,
    }),
    isScrapped: false,
    createdBy: userId,
  }], { session });

  await InvMoveLine.create([{
    tenantId: tid,
    moveId: move._id,
    productId: quant.productId,
    variantId: quant.variantId,
    uomId,
    quantity: absDiff,
    quantityInProductUom: absDiff,
    sourceLocationId,
    destLocationId,
    lotId: quant.lotId || null,
    packageId: quant.packageId || null,
    ownerId: quant.ownerId || null,
    state: 'done',
    doneAt: now,
    doneChecksum: computeMoveLineDoneChecksum({
      moveId: move._id,
      productId: quant.productId,
      variantId: quant.variantId,
      quantity: absDiff,
      quantityInProductUom: absDiff,
      sourceLocationId,
      destLocationId,
      lotId: quant.lotId || null,
      packageId: quant.packageId || null,
    }),
    reference: ref,
    createdBy: userId,
  }], { session });

  const dims = {
    variantId: quant.variantId,
    lotId: quant.lotId,
    packageId: quant.packageId,
    ownerId: quant.ownerId,
    tracking: product?.tracking,
  };

  if (isGain) {
    await applyQuantDelta(session, tid, quant.productId, quant.locationId, absDiff, '0', now, dims);
  } else {
    await applyQuantDelta(
      session,
      tid,
      quant.productId,
      quant.locationId,
      decStr(D(0).minus(D(absDiff))),
      '0',
      now,
      dims,
    );
  }

  quant.isCountSet = false;
  quant.countedQuantity = null;
  quant.countDifference = '0';
  quant.countSnapshotQty = null;
  quant.varianceApprovalRequired = false;
  quant.varianceApprovedAt = null;
  quant.varianceApprovedBy = null;
  quant.lastCountDate = now;
  if (reason) quant.countReason = reason;
  if (reasonCode) quant.reasonCode = reasonCode;
  await quant.save({ session });

  return { quantId: quant._id, moveId: move._id, diff: absDiff, isGain };
}

/**
 * Apply inventory counts — one transaction per line; partial success reported.
 * Never writes quant qty except via applyQuantDelta (same path as validate).
 */
export async function applyInventoryCounts(tenantId, {
  ids,
  accountingDate,
  reason,
  reasonCode,
  userId,
  forceApprove = false,
}) {
  if (!ids?.length) throw new InventoryValidationError('No quant ids provided', 'NO_IDS');
  if (!reasonCode) {
    throw new InventoryValidationError('reasonCode is required', 'REASON_REQUIRED');
  }

  const tid = toObjectId(tenantId);
  const settings = await InvSettings.findOne({ tenantId: tid })
    .select('inventoryPeriodLockDate varianceApprovalThreshold')
    .lean();
  const now = accountingDate ? new Date(accountingDate) : new Date();
  if (settings?.inventoryPeriodLockDate) {
    const lock = new Date(settings.inventoryPeriodLockDate);
    lock.setHours(23, 59, 59, 999);
    if (now <= lock) {
      throw new InventoryValidationError(
        `Accounting date is locked (period lock ${lock.toISOString().slice(0, 10)})`,
        'PERIOD_LOCKED',
      );
    }
  }

  const invAdj = await InvLocation.findOne({ tenantId: tid, usage: 'inventoryLoss' });
  if (!invAdj) {
    throw new InventoryValidationError(
      'Inventory adjustment location not found — run bootstrap',
      'NO_INV_ADJ',
    );
  }
  const defaultUom = await getDefaultUom(tid);
  const preview = await previewApplyCounts(tid, ids);

  const results = [];
  let applied = 0;
  let failed = 0;
  let skipped = 0;
  let needsApproval = 0;

  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const row = await runWithTransaction(async (session) => {
        const quant = await InvQuant.findOne({
          _id: id,
          tenantId: tid,
          isCountSet: true,
        }).session(session);
        if (!quant) {
          return { quantId: id, error: 'Not found or not set', failed: true };
        }
        if (quant.varianceApprovalRequired && !quant.varianceApprovedAt && !forceApprove) {
          return {
            quantId: id,
            error: 'Variance over threshold — approval required',
            failed: true,
            needsApproval: true,
            code: 'VARIANCE_APPROVAL',
          };
        }
        if (reasonCode) quant.reasonCode = reasonCode;
        return applyOneCount(session, tid, quant, invAdj, defaultUom, now, reason, userId, reasonCode);
      });
      if (row?.needsApproval) {
        needsApproval += 1;
        failed += 1;
        results.push(row);
      } else if (row?.failed) {
        failed += 1;
        results.push(row);
      } else if (row?.skipped) {
        skipped += 1;
        results.push(row);
        applied += 1;
      } else {
        applied += 1;
        results.push(row);
      }
    } catch (err) {
      failed += 1;
      results.push({ quantId: id, error: err.message || String(err), failed: true, code: err.code });
    }
  }

  return {
    applied,
    failed,
    skipped,
    needsApproval,
    results,
    preview,
  };
}

/** Manager approval for over-threshold variance lines. */
export async function approveVarianceCounts(tenantId, { ids, userId }) {
  if (!ids?.length) throw new InventoryValidationError('No quant ids provided', 'NO_IDS');
  const tid = toObjectId(tenantId);
  const res = await InvQuant.updateMany(
    { _id: { $in: ids }, tenantId: tid, isCountSet: true, varianceApprovalRequired: true },
    {
      $set: {
        varianceApprovedAt: new Date(),
        varianceApprovedBy: userId,
      },
    },
  );
  return { approved: res.modifiedCount || 0 };
}

/**
 * Request a count: stamp schedule on existing quants; optionally create zero-qty lines
 * for products in scope that have no quant (catches shrinkage).
 */
export async function requestCount(tenantId, {
  warehouseId,
  locationId,
  categoryId,
  productIds,
  scheduledDate,
  userId,
  countUserId,
  includeZero = true,
}) {
  const tid = toObjectId(tenantId);
  if (!locationId && !warehouseId) {
    throw new InventoryValidationError('locationId or warehouseId required', 'MISSING_FIELDS');
  }

  let locIds = [];
  if (locationId) {
    locIds = [toObjectId(locationId)];
  } else {
    const locs = await InvLocation.find({
      tenantId: tid,
      warehouseId,
      usage: 'internal',
      active: true,
    }).select('_id').lean();
    locIds = locs.map((l) => l._id);
  }
  if (!locIds.length) {
    throw new InventoryValidationError('No internal locations in scope', 'NO_LOCATION');
  }

  const when = scheduledDate ? new Date(scheduledDate) : new Date();
  const assignee = countUserId || userId || undefined;
  const quantFilter = withTenant(tid, { locationId: { $in: locIds } });
  if (productIds?.length) quantFilter.productId = { $in: productIds.map(toObjectId) };

  const res = await InvQuant.updateMany(quantFilter, {
    $set: {
      countScheduledDate: when,
      ...(assignee ? { countUserId: toObjectId(assignee) } : {}),
    },
  });

  let zeroCreated = 0;
  if (includeZero) {
    const productFilter = {
      tenantId: tid,
      trackInventory: { $ne: false },
      productType: { $ne: 'service' },
    };
    if (categoryId) productFilter.categoryId = categoryId;
    if (productIds?.length) productFilter._id = { $in: productIds.map(toObjectId) };

    const products = await Product.find(productFilter).select('_id').limit(5000).lean();
    const existing = await InvQuant.find({
      tenantId: tid,
      locationId: { $in: locIds },
      productId: { $in: products.map((p) => p._id) },
    }).select('productId locationId').lean();

    const have = new Set(existing.map((q) => `${q.productId}:${q.locationId}`));
    const docs = [];
    for (const loc of locIds) {
      for (const p of products) {
        const key = `${p._id}:${loc}`;
        if (have.has(key)) continue;
        const doc = {
          tenantId: tid,
          productId: p._id,
          locationId: loc,
          variantId: null,
          lotId: null,
          packageId: null,
          ownerId: null,
          countScheduledDate: when,
          countUserId: assignee ? toObjectId(assignee) : undefined,
          createdBy: userId,
        };
        setDecimalPair(doc, 'quantity', '0');
        setDecimalPair(doc, 'reservedQuantity', '0');
        setDecimalPair(doc, 'value', '0');
        docs.push(doc);
      }
    }
    if (docs.length) {
      try {
        const inserted = await InvQuant.insertMany(docs, { ordered: false });
        zeroCreated = inserted.length;
      } catch (err) {
        zeroCreated = err?.insertedDocs?.length || err?.result?.nInserted || 0;
      }
    }
  }

  return {
    matched: res.matchedCount,
    modified: res.modifiedCount,
    zeroCreated,
    scheduledDate: when,
  };
}

/** Move-line history for inventory adjustments on a product+location. */
export async function countLineHistory(tenantId, { productId, locationId, limit = 50 }) {
  const tid = toObjectId(tenantId);
  const invAdj = await InvLocation.findOne({ tenantId: tid, usage: 'inventoryLoss' }).select('_id').lean();
  const filter = withTenant(tid, {
    productId,
    state: 'done',
    $or: [
      { sourceLocationId: locationId, destLocationId: invAdj?._id },
      { destLocationId: locationId, sourceLocationId: invAdj?._id },
      { reference: /^INV\// },
    ],
  });
  return InvMoveLine.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Number(limit) || 50))
    .populate('moveId', 'reference origin date')
    .lean();
}

/**
 * Import counted quantities — dry-run or commit.
 * Rows: { location, product_sku|sku, lot?, counted_qty }
 */
export async function importCountedQuantities(tenantId, rows, { dryRun = true, userId } = {}) {
  const tid = toObjectId(tenantId);
  const report = { ok: [], errors: [], wouldCreate: 0, wouldUpdate: 0 };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const rowNum = i + 2;
    const sku = String(row.product_sku || row.sku || row.SKU || '').trim();
    const locPath = String(row.location || row.location_path || row.completePath || '').trim();
    const counted = row.counted_qty ?? row.countedQty ?? row.counted;
    const lotName = String(row.lot || row.lot_name || '').trim();

    if (!sku || !locPath || counted == null || counted === '') {
      report.errors.push({
        row: rowNum,
        field: 'sku/location/counted_qty',
        reason: 'Missing required field',
      });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findOne({ tenantId: tid, sku }).select('_id').lean();
    if (!product) {
      report.errors.push({ row: rowNum, field: 'product_sku', reason: `No product with sku ${sku}` });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const location = await InvLocation.findOne({
      tenantId: tid,
      $or: [{ completePath: locPath }, { name: locPath }],
    }).select('_id').lean();
    if (!location) {
      report.errors.push({ row: rowNum, field: 'location', reason: `Location not found: ${locPath}` });
      continue;
    }

    let lotId = null;
    if (lotName) {
      const { default: InvLot } = await import('../../models/inventory/InvLot.js');
      // eslint-disable-next-line no-await-in-loop
      const lot = await InvLot.findOne({
        tenantId: tid,
        productId: product._id,
        name: lotName,
      }).select('_id').lean();
      if (!lot) {
        report.errors.push({ row: rowNum, field: 'lot', reason: `Lot not found: ${lotName}` });
        continue;
      }
      lotId = lot._id;
    }

    // eslint-disable-next-line no-await-in-loop
    const existing = await InvQuant.findOne({
      tenantId: tid,
      productId: product._id,
      locationId: location._id,
      lotId: lotId || null,
      packageId: null,
      ownerId: null,
      variantId: null,
    }).select('_id').lean();

    if (existing) report.wouldUpdate += 1;
    else report.wouldCreate += 1;

    report.ok.push({
      row: rowNum,
      productId: product._id,
      locationId: location._id,
      lotId,
      countedQty: String(counted),
      action: existing ? 'update' : 'create',
    });
  }

  if (dryRun) {
    return {
      dryRun: true,
      ...report,
      matched: report.ok.length,
      unmatched: report.errors.length,
    };
  }

  const committed = [];
  for (const row of report.ok) {
    // eslint-disable-next-line no-await-in-loop
    const quant = await setCountedQuantity(tid, {
      productId: row.productId,
      locationId: row.locationId,
      lotId: row.lotId,
      countedQty: row.countedQty,
      userId,
    });
    committed.push({ quantId: quant._id, row: row.row });
  }
  return {
    dryRun: false,
    committed: committed.length,
    errors: report.errors,
    items: committed,
  };
}
