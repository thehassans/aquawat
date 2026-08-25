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

/**
 * Activity / exception queue — stuck moves, failed procurements, no-rule,
 * negative forecast, expired lots still on hand.
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
    dateDeadline: { $lt: now },
  })
    .sort({ dateDeadline: 1 })
    .limit(cap)
    .populate('productId', 'nameEn sku')
    .lean();

  for (const m of lateMoves) {
    items.push({
      type: 'waiting_past_deadline',
      severity: 'warning',
      at: m.dateDeadline,
      message: `Move ${m.name || m._id} waiting past deadline`,
      messageAr: `حركة متأخرة عن الموعد`,
      productId: m.productId?._id || m.productId,
      productName: m.productId?.nameEn || m.productId?.sku,
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

  // 3) Negative forecast (sample products with reorder coverage or top trackable)
  const rules = await InvReorderRule.find({ tenantId: tid, active: true }).limit(80).lean();
  const seen = new Set();
  for (const op of rules) {
    const key = `${op.productId}:${op.warehouseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const fc = await computeForecast(tid, op.productId, { warehouseId: op.warehouseId });
      if (D(fc.forecasted).lt(0)) {
        const p = await Product.findById(op.productId).select('nameEn sku').lean();
        items.push({
          type: 'negative_forecast',
          severity: 'warning',
          at: now,
          message: `${p?.sku || op.productId} forecast ${fc.forecasted}`,
          messageAr: `توقع سالب للمخزون`,
          productId: op.productId,
          productName: p?.nameEn,
          qty: fc.forecasted,
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

  items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  return {
    items: items.slice(0, cap),
    total: items.length,
    generatedAt: now,
  };
}
