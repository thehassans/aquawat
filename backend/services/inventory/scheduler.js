import { randomUUID } from 'crypto';
import { D, decStr } from '../../utils/decimal.js';
import {
  InvReorderRule,
  InvSchedulerRun,
  InvSettings,
  InvMove,
} from '../../models/inventory/index.js';
import Warehouse from '../../models/Warehouse.js';
import Product from '../../models/Product.js';
import { toObjectId } from '../../models/inventory/common.js';
import { computeForecast } from './forecast.js';
import { runProcurement, roundToMultiple } from './procurement.js';
import { reserveMove, runWithTransaction } from './reserve.js';
import { InventoryValidationError, InventoryConflictError } from './errors.js';

/**
 * List permanent reorder rules + virtual rows for negative forecast.
 */
export async function listReplenishment(tenantId, { warehouseId, permanentOnly } = {}) {
  const tid = toObjectId(tenantId);
  const filter = { tenantId: tid, active: true };
  if (warehouseId) filter.warehouseId = toObjectId(warehouseId);

  const orderpoints = await InvReorderRule.find(filter)
    .populate('productId', 'nameEn nameAr sku')
    .populate('locationId', 'completePath name')
    .populate('warehouseId', 'name code')
    .populate('routeId', 'name')
    .lean();

  const rows = [];
  for (const op of orderpoints) {
    const pid = op.productId?._id || op.productId;
    const fc = await computeForecast(tid, pid, { warehouseId: op.warehouseId?._id || op.warehouseId });
    const toOrder = D(fc.forecasted).lt(D(op.minQty))
      ? roundToMultiple(D(op.maxQty).minus(D(fc.forecasted)), op.qtyMultiple)
      : '0';
    rows.push({
      ...op,
      kind: 'permanent',
      qtyOnHand: fc.onHand,
      qtyForecast: fc.forecasted,
      qtyToOrder: toOrder,
      snoozed: op.snoozedUntil && new Date(op.snoozedUntil) > new Date(),
    });
  }

  if (permanentOnly === true || permanentOnly === '1' || permanentOnly === 'true') {
    return rows;
  }

  const covered = new Set(orderpoints.map((o) => `${o.productId?._id || o.productId}:${o.warehouseId?._id || o.warehouseId}`));
  const warehouses = warehouseId
    ? [await Warehouse.findOne({ _id: warehouseId, tenantId: tid }).lean()]
    : await Warehouse.find({ tenantId: tid, isActive: true }).lean();

  const products = await Product.find({
    tenantId: tid,
    isActive: { $ne: false },
    trackInventory: { $ne: false },
  }).limit(300).select('nameEn nameAr sku').lean();

  for (const wh of warehouses.filter(Boolean)) {
    for (const p of products) {
      const key = `${p._id}:${wh._id}`;
      if (covered.has(key)) continue;
      const fc = await computeForecast(tid, p._id, { warehouseId: wh._id });
      if (D(fc.forecasted).gte(0)) continue;
      rows.push({
        _id: `virtual:${p._id}:${wh._id}`,
        kind: 'virtual',
        productId: p,
        warehouseId: wh,
        locationId: wh.stockLocationId,
        minQty: '0',
        maxQty: decStr(D(fc.forecasted).abs()),
        qtyMultiple: '1',
        qtyOnHand: fc.onHand,
        qtyForecast: fc.forecasted,
        qtyToOrder: decStr(D(fc.forecasted).abs()),
        trigger: 'manual',
      });
    }
  }

  return rows;
}

export async function upsertReorderRule(tenantId, userId, body) {
  const tid = toObjectId(tenantId);
  if (!body.productId || !body.locationId || !body.warehouseId) {
    throw new InventoryValidationError('productId, locationId, warehouseId required', 'MISSING_FIELDS');
  }

  const variantId = body.variantId ? toObjectId(body.variantId) : null;
  const existingQuery = {
    tenantId: tid,
    productId: body.productId,
    locationId: body.locationId,
  };
  if (variantId) {
    existingQuery.variantId = variantId;
  } else {
    existingQuery.$or = [{ variantId: null }, { variantId: { $exists: false } }];
  }

  const existing = await InvReorderRule.findOne(existingQuery);

  if (existing) {
    existing.minQty = String(body.minQty ?? existing.minQty);
    existing.maxQty = String(body.maxQty ?? existing.maxQty);
    existing.qtyMultiple = String(body.qtyMultiple ?? existing.qtyMultiple);
    existing.trigger = body.trigger || existing.trigger;
    existing.routeId = body.routeId !== undefined ? (body.routeId || null) : existing.routeId;
    existing.preferredVendorId = body.preferredVendorId ?? existing.preferredVendorId;
    existing.leadDays = body.leadDays ?? existing.leadDays;
    existing.warehouseId = body.warehouseId;
    existing.variantId = variantId;
    existing.active = body.active !== false;
    if (userId) existing.updatedBy = userId;
    await existing.save();
    return existing;
  }

  return InvReorderRule.create({
    tenantId: tid,
    productId: body.productId,
    variantId,
    locationId: body.locationId,
    warehouseId: body.warehouseId,
    minQty: String(body.minQty ?? 0),
    maxQty: String(body.maxQty ?? 0),
    qtyMultiple: String(body.qtyMultiple ?? 1),
    trigger: body.trigger || 'auto',
    routeId: body.routeId || null,
    preferredVendorId: body.preferredVendorId || null,
    leadDays: body.leadDays || 0,
    createdBy: userId,
  });
}

export async function snoozeReorderRule(tenantId, id, { until, preset } = {}) {
  const tid = toObjectId(tenantId);
  const op = await InvReorderRule.findOne({ _id: id, tenantId: tid });
  if (!op) throw new InventoryValidationError('Reorder rule not found', 'OP_NOT_FOUND');

  let date = until ? new Date(until) : new Date();
  if (!until && preset) {
    if (preset === '1d') date.setDate(date.getDate() + 1);
    else if (preset === '1w') date.setDate(date.getDate() + 7);
    else if (preset === '1m') date.setMonth(date.getMonth() + 1);
  }
  op.snoozedUntil = date;
  await op.save();
  return op;
}

export async function orderOnce(tenantId, userId, {
  productId, locationId, qty, routeId, warehouseId, preferredVendorId,
} = {}) {
  if (!productId || !locationId || !qty) {
    throw new InventoryValidationError('productId, locationId, qty required', 'MISSING_FIELDS');
  }
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return runProcurement({
    tenantId,
    productId,
    qty,
    locationId,
    dateDeadline: deadline,
    preferredRouteId: routeId,
    warehouseId,
    preferredVendorId,
    userId,
  });
}

/**
 * Run scheduler with per-tenant re-entrancy lock + rate limit (min interval).
 * Default: at most one successful run per tenant every 15 minutes (cron or manual).
 */
export async function runScheduler(tenantId, {
  trigger = 'manual',
  userId = null,
  minIntervalMs = 15 * 60 * 1000,
  force = false,
} = {}) {
  const tid = toObjectId(tenantId);
  const lockKey = randomUUID();
  const settings = await InvSettings.findOne({ tenantId: tid }).lean();

  if (settings && settings.schedulerEnabled === false && trigger === 'cron') {
    throw new InventoryValidationError('Scheduler disabled for tenant', 'SCHEDULER_DISABLED');
  }

  const running = await InvSchedulerRun.findOne({
    tenantId: tid,
    status: 'running',
    startedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
  });
  if (running) {
    throw new InventoryConflictError('Scheduler already running for this tenant', 'SCHEDULER_LOCKED');
  }

  if (!force) {
    const recent = await InvSchedulerRun.findOne({
      tenantId: tid,
      status: 'done',
      startedAt: { $gte: new Date(Date.now() - minIntervalMs) },
    }).lean();
    if (recent) {
      const [skipped] = await InvSchedulerRun.create([{
        tenantId: tid,
        startedAt: new Date(),
        endedAt: new Date(),
        trigger,
        status: 'skipped',
        rateLimited: true,
        lockKey,
        errorLog: [{
          message: `Rate limited — last run ${recent._id} within ${minIntervalMs}ms`,
          code: 'RATE_LIMIT',
          at: new Date(),
        }],
      }]);
      return skipped;
    }
  }

  const [run] = await InvSchedulerRun.create([{
    tenantId: tid,
    startedAt: new Date(),
    trigger,
    status: 'running',
    lockKey,
  }]);

  let rulesEvaluated = 0;
  let procurementsCreated = 0;
  let reservationsRetried = 0;
  let cacheAssertChecked = 0;
  let cacheAssertMismatches = 0;
  const errorLog = [];

  try {
    const orderpoints = await InvReorderRule.find({
      tenantId: tid,
      active: true,
      trigger: 'auto',
      $or: [
        { snoozedUntil: null },
        { snoozedUntil: { $lte: new Date() } },
      ],
    }).lean();

    for (const op of orderpoints) {
      rulesEvaluated += 1;
      try {
        const fc = await computeForecast(tid, op.productId, { warehouseId: op.warehouseId });
        if (!D(fc.forecasted).lt(D(op.minQty))) continue;
        const qty = roundToMultiple(D(op.maxQty).minus(D(fc.forecasted)), op.qtyMultiple);
        if (!D(qty).gt(0)) continue;

        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (Number(op.leadDays) || 0) + 7);

        await runProcurement({
          tenantId: tid,
          productId: op.productId,
          qty,
          locationId: op.locationId,
          dateDeadline: deadline,
          preferredRouteId: op.routeId,
          warehouseId: op.warehouseId,
          preferredVendorId: op.preferredVendorId,
          userId,
        });
        procurementsCreated += 1;
      } catch (err) {
        errorLog.push({ message: err.message, code: err.code || 'PROCURE', at: new Date() });
      }
    }

    const candidates = await InvMove.find({
      tenantId: tid,
      state: { $in: ['confirmed', 'partiallyAvailable'] },
    }).limit(100).lean();

    for (const m of candidates) {
      try {
        await runWithTransaction(async (session) => {
          const fresh = await InvMove.findById(m._id).session(session);
          if (fresh) await reserveMove(fresh, session);
        });
        reservationsRetried += 1;
      } catch {
        // skip — insufficient stock is expected
      }
    }

    try {
      const { assertProductStockCache } = await import('./syncProductCache.js');
      const assert = await assertProductStockCache(tid, { limit: 500 });
      cacheAssertChecked = assert.checked;
      cacheAssertMismatches = assert.mismatchCount;
      if (!assert.ok) {
        errorLog.push({
          message: `ProductStockCache drift: ${assert.mismatchCount} mismatch(es)`,
          code: 'CACHE_DRIFT',
          at: new Date(),
        });
      }
    } catch (err) {
      errorLog.push({ message: err.message, code: 'CACHE_ASSERT', at: new Date() });
    }

    run.rulesEvaluated = rulesEvaluated;
    run.procurementsCreated = procurementsCreated;
    run.reservationsRetried = reservationsRetried;
    run.cacheAssertChecked = cacheAssertChecked;
    run.cacheAssertMismatches = cacheAssertMismatches;
    run.errorLog = errorLog;
    run.status = 'done';
    run.endedAt = new Date();
    await run.save();

    try {
      const { startJobRun, finishJobRun } = await import('./jobRunner.js');
      const job = await startJobRun(tid, { jobType: 'scheduler', trigger, userId });
      await finishJobRun(job, {
        status: errorLog.length ? 'partial' : 'ok',
        counts: {
          rulesEvaluated,
          procurementsCreated,
          reservationsRetried,
          cacheAssertChecked,
          cacheAssertMismatches,
        },
        errors: errorLog.slice(0, 50).map((e) => ({
          code: e.code,
          message: e.message,
          at: e.at,
        })),
        result: { schedulerRunId: run._id },
      });
    } catch {
      /* JobRun mirror is non-blocking */
    }

    try {
      const day = Number(settings?.annualInventoryDay) || 31;
      const month = Number(settings?.annualInventoryMonth) || 12;
      const now = new Date();
      let next = new Date(now.getFullYear(), month - 1, day);
      if (next <= now) next = new Date(now.getFullYear() + 1, month - 1, day);
      const { default: InvLocation } = await import('../../models/inventory/InvLocation.js');
      await InvLocation.updateMany(
        {
          tenantId: tid,
          usage: 'internal',
          active: true,
          $or: [
            { cyclicCountFrequencyDays: 0 },
            { cyclicCountFrequencyDays: null },
            { cyclicCountFrequencyDays: { $exists: false } },
          ],
        },
        { $set: { nextCountDate: next } },
      );
    } catch {
      // non-fatal
    }

    return run;
  } catch (err) {
    run.rulesEvaluated = rulesEvaluated;
    run.procurementsCreated = procurementsCreated;
    run.reservationsRetried = reservationsRetried;
    run.cacheAssertChecked = cacheAssertChecked;
    run.cacheAssertMismatches = cacheAssertMismatches;
    run.errorLog = [...errorLog, { message: err.message, code: err.code || 'FATAL', at: new Date() }];
    run.status = 'failed';
    run.endedAt = new Date();
    await run.save();
    try {
      const { startJobRun, finishJobRun } = await import('./jobRunner.js');
      const job = await startJobRun(tid, { jobType: 'scheduler', trigger, userId });
      await finishJobRun(job, {
        status: 'failed',
        counts: { rulesEvaluated, procurementsCreated, reservationsRetried },
        errors: run.errorLog.slice(0, 50).map((e) => ({
          code: e.code,
          message: e.message,
          at: e.at,
        })),
        result: { schedulerRunId: run._id },
      });
    } catch {
      /* non-blocking */
    }
    throw err;
  }
}

export async function getSchedulerStatus(tenantId) {
  const tid = toObjectId(tenantId);
  const settings = await InvSettings.findOne({ tenantId: tid }).lean();
  const last = await InvSchedulerRun.findOne({ tenantId: tid }).sort({ startedAt: -1 }).lean();
  return {
    schedulerEnabled: !!settings?.schedulerEnabled,
    lastRun: last,
  };
}
