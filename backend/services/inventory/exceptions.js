import { D, decStr } from '../../utils/decimal.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvLot from '../../models/inventory/InvLot.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvSchedulerRun from '../../models/inventory/InvSchedulerRun.js';
import InvReorderRule from '../../models/inventory/InvReorderRule.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { computeForecast } from './forecast.js';
import { latestIntegrityFailures } from './jobRunner.js';

/**
 * Activity / exception queue — stuck moves, failed procurements, no-rule,
 * negative forecast, expired lots still on hand, last integrity failures.
 */
export async function listInventoryExceptions(tenantId, { limit = 100 } = {}) {
  const tid = toObjectId(tenantId);
  const now = new Date();
  const items = [];
  const cap = Math.min(Number(limit) || 100, 300);

  // 1) Moves waiting/confirmed past deadline
  const lateMoves = await InvMove.find({
    tenantId: tid,
    state: { $in: ['waiting', 'confirmed', 'partiallyAvailable'] },
    deadlineDate: { $lt: now },
  })
    .sort({ deadlineDate: 1 })
    .limit(cap)
    .populate('productId', 'nameEn sku')
    .populate('locationId', 'completePath name')
    .populate('locationDestId', 'completePath name')
    .lean();

  for (const m of lateMoves) {
    items.push({
      type: 'waiting_past_deadline',
      severity: 'warning',
      at: m.deadlineDate,
      message: `Move ${m.reference || m._id} waiting past deadline`,
      messageAr: `حركة متأخرة عن الموعد`,
      productId: m.productId?._id || m.productId,
      productName: m.productId?.nameEn || m.productId?.sku,
      locationName: m.locationDestId?.completePath || m.locationDestId?.name
        || m.locationId?.completePath || m.locationId?.name,
      ref: { moveId: m._id, transferId: m.transferId },
    });
  }

  // 2) Last scheduler errors (NO_RULE / procure failures)
  const lastRun = await InvSchedulerRun.findOne({ tenantId: tid }).sort({ startedAt: -1 }).lean();
  for (const err of (lastRun?.errorLog || []).slice(0, 40)) {
    items.push({
      type: err.code === 'NO_RULE_FOUND' ? 'no_rule' : 'procurement_failed',
      severity: 'error',
      at: err.at || lastRun.startedAt,
      message: err.message,
      messageAr: err.message,
      code: err.code,
      ref: { schedulerRunId: lastRun._id },
    });
  }

  // 3) Negative forecast (sample products with reorder coverage)
  const rules = await InvReorderRule.find({ tenantId: tid, active: true }).limit(80).lean();
  const seen = new Set();
  for (const op of rules) {
    const key = `${op.productId}:${op.warehouseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const fc = await computeForecast(tid, op.productId, { warehouseId: op.warehouseId });
      if (D(fc.forecasted ?? fc.forecast).lt(0)) {
        const p = await Product.findById(op.productId).select('nameEn sku').lean();
        items.push({
          type: 'negative_forecast',
          severity: 'warning',
          at: now,
          message: `${p?.sku || op.productId} forecast ${fc.forecasted ?? fc.forecast}`,
          messageAr: `توقع سالب للمخزون`,
          productId: op.productId,
          productName: p?.nameEn,
          qty: fc.forecasted ?? fc.forecast,
          ref: { warehouseId: op.warehouseId, reorderRuleId: op._id },
        });
      }
    } catch {
      /* skip */
    }
  }

  // 4) Expired lots still on hand
  const expiredLots = await InvLot.find({
    tenantId: tid,
    expirationDate: { $lt: now },
  }).limit(80).select('name productId expirationDate').lean();

  const internalLocs = await InvLocation.find({
    tenantId: tid,
    usage: 'internal',
    active: true,
  }).select('_id').lean();
  const locIds = internalLocs.map((l) => l._id);

  for (const lot of expiredLots) {
    const q = await InvQuant.aggregate([
      {
        $match: {
          tenantId: tid,
          lotId: lot._id,
          locationId: { $in: locIds },
        },
      },
      { $group: { _id: null, qty: { $sum: '$quantityNum' } } },
    ]);
    const qty = D(q[0]?.qty?.toString?.() || '0');
    if (qty.lte(0)) continue;
    const p = await Product.findById(lot.productId).select('nameEn sku').lean();
    items.push({
      type: 'expired_lot_on_hand',
      severity: 'error',
      at: lot.expirationDate,
      message: `Expired lot ${lot.name} still on hand (${decStr(qty)})`,
      messageAr: `دفعة منتهية لا تزال بالمخزن`,
      productId: lot.productId,
      productName: p?.nameEn,
      qty: decStr(qty),
      ref: { lotId: lot._id, lotName: lot.name },
    });
  }

  // 4b) Reorder rules missing preferred vendor (and product has no suppliers)
  const vendorlessRules = await InvReorderRule.find({
    tenantId: tid,
    active: true,
    $or: [{ preferredVendorId: null }, { preferredVendorId: { $exists: false } }],
  })
    .limit(60)
    .populate('productId', 'nameEn sku suppliers')
    .populate('locationId', 'completePath name')
    .lean();

  for (const op of vendorlessRules) {
    const product = op.productId;
    const hasVendors = Array.isArray(product?.suppliers) && product.suppliers.some((s) => s.supplierId);
    if (hasVendors) continue;
    items.push({
      type: 'no_vendor',
      severity: 'error',
      at: op.updatedAt || op.createdAt || now,
      message: 'No Vendor defined on product',
      messageAr: 'لا يوجد مورد معرّف على المنتج',
      productId: product?._id || op.productId,
      productName: product?.nameEn || product?.sku,
      locationName: op.locationId?.completePath || op.locationId?.name,
      ref: {
        reorderRuleId: op._id,
        productId: product?._id || op.productId,
        locationId: op.locationId?._id || op.locationId,
        warehouseId: op.warehouseId,
      },
    });
  }

  // 5) Latest integrity job failures
  try {
    const { items: integrityItems } = await latestIntegrityFailures(tid, { limit: 40 });
    items.push(...integrityItems);
  } catch {
    /* non-blocking */
  }

  items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  return {
    items: items.slice(0, cap),
    total: items.length,
    generatedAt: now,
  };
}
