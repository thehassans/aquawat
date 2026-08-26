import InvLot from '../../models/inventory/InvLot.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import InvOperationType from '../../models/inventory/InvOperationType.js';
import { toObjectId } from '../../models/inventory/common.js';
import { startJobRun, finishJobRun } from './jobRunner.js';
import { runIntegrityJob } from './jobRunner.js';
import { runScheduler } from './scheduler.js';
import { reserveMove, runWithTransaction } from './reserve.js';
import { assertProductStockCache, repairProductStockCache } from './syncProductCache.js';

/**
 * Process a single inventory background job payload.
 * Always writes InvJobRun (except when nested helpers already do).
 */
export async function processInventoryJob(data = {}) {
  const {
    jobType,
    tenantId,
    userId = null,
    trigger = 'api',
    payload = {},
  } = data;

  if (!tenantId || !jobType) {
    throw new Error('jobType and tenantId required');
  }

  switch (jobType) {
    case 'integrity':
      return runIntegrityJob(tenantId, {
        trigger,
        userId,
        limit: payload.limit,
      });

    case 'scheduler':
      return runScheduler(tenantId, {
        trigger,
        userId,
        force: !!payload.force,
      });

    case 'cache_reconcile':
      return runCacheReconcile(tenantId, { trigger, userId, repair: !!payload.repair });

    case 'reservation_retry':
      return runReservationRetry(tenantId, { trigger, userId, limit: payload.limit });

    case 'expiry_alerts':
      return runExpiryAlerts(tenantId, { trigger, userId, withinDays: payload.withinDays });

    case 'cyclic_count_stamp':
    case 'cyclic_count':
      return runCyclicCountStamp(tenantId, { trigger, userId });

    case 'export':
      return runExportJob(tenantId, {
        trigger,
        userId,
        exportJobId: payload.exportJobId,
        exportOpts: payload.exportOpts,
      });

    case 'delivery_notify':
      return runDeliveryNotifyStub(tenantId, { trigger, userId, payload });

    case 'count_plan_due':
      return runDueCountPlansJob(tenantId, { trigger, userId });

    default:
      throw new Error(`Unknown inventory jobType: ${jobType}`);
  }
}

async function runCacheReconcile(tenantId, { trigger, userId, repair }) {
  const job = await startJobRun(tenantId, { jobType: 'cache_reconcile', trigger, userId });
  try {
    const assert = await assertProductStockCache(tenantId, { limit: 2000 });
    let repaired = 0;
    if (repair && assert.mismatchCount > 0) {
      const result = await repairProductStockCache(tenantId, { limit: 2000 });
      repaired = result?.repaired || result?.fixed || 0;
    }
    await finishJobRun(job, {
      status: assert.ok ? 'ok' : (repair ? 'partial' : 'failed'),
      counts: {
        checked: assert.checked,
        mismatchCount: assert.mismatchCount,
        repaired,
      },
      result: { ok: assert.ok },
    });
    return { job, assert, repaired };
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'CACHE_RECONCILE', message: err.message }],
    });
    throw err;
  }
}

async function runReservationRetry(tenantId, { trigger, userId, limit = 200 }) {
  const tid = toObjectId(tenantId);
  const job = await startJobRun(tenantId, { jobType: 'reservation_retry', trigger, userId });
  let retried = 0;
  let failed = 0;
  try {
    // Prefer by_date / reservation method op types when present
    const byDateOt = await InvOperationType.find({
      tenantId: tid,
      active: true,
      reservationMethod: { $in: ['byDate', 'manual'] },
    }).select('_id').lean();
    const otIds = byDateOt.map((o) => o._id);

    const filter = {
      tenantId: tid,
      state: { $in: ['confirmed', 'partiallyAvailable'] },
    };
    if (otIds.length) {
      const transfers = await (await import('../../models/inventory/InvTransfer.js')).default
        .find({ tenantId: tid, operationTypeId: { $in: otIds }, state: { $nin: ['done', 'cancelled'] } })
        .select('_id')
        .lean();
      if (transfers.length) {
        filter.transferId = { $in: transfers.map((t) => t._id) };
      }
    }

    const candidates = await InvMove.find(filter).limit(Math.min(500, Number(limit) || 200)).lean();
    for (const m of candidates) {
      try {
        await runWithTransaction(async (session) => {
          const fresh = await InvMove.findById(m._id).session(session);
          if (fresh) await reserveMove(fresh, session);
        });
        retried += 1;
      } catch {
        failed += 1;
      }
    }
    await finishJobRun(job, {
      status: 'ok',
      counts: { retried, failed, candidates: candidates.length },
      result: { kind: 'reservation_retry' },
    });
    return { retried, failed };
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'RESERVATION_RETRY', message: err.message }],
    });
    throw err;
  }
}

async function runExpiryAlerts(tenantId, { trigger, userId, withinDays = 30 }) {
  const tid = toObjectId(tenantId);
  const job = await startJobRun(tenantId, { jobType: 'expiry_alerts', trigger, userId });
  try {
    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + (Number(withinDays) || 30));
    const lots = await InvLot.find({
      tenantId: tid,
      expirationDate: { $gte: now, $lte: until },
    }).limit(500).select('name productId expirationDate').lean();

    const alerts = lots.map((l) => ({
      code: 'LOT_EXPIRING',
      message: `Lot ${l.name} expires ${l.expirationDate?.toISOString?.()?.slice(0, 10)}`,
      messageAr: `الدفعة ${l.name} تنتهي قريباً`,
      ref: { lotId: l._id, productId: l.productId },
      at: l.expirationDate,
    }));

    let expiredMarked = 0;
    let expiredSkipped = 0;
    try {
      const { updateQuantInventoryStatus } = await import('./quantStatus.js');
      const expiredLots = await InvLot.find({
        tenantId: tid,
        expirationDate: { $lt: now },
      }).select('_id name').limit(500).lean();
      if (expiredLots.length) {
        const expiredLotIds = expiredLots.map((l) => l._id);
        const quants = await InvQuant.find({
          tenantId: tid,
          lotId: { $in: expiredLotIds },
          quantity: { $ne: '0' },
          inventoryStatus: { $nin: ['expired'] },
        }).select('_id inventoryStatus reservedQuantity').limit(500).lean();
        for (const q of quants) {
          try {
            await updateQuantInventoryStatus(tid, q._id, {
              status: 'expired',
              reason: 'Auto-marked by expiry_alerts job',
              userId,
            });
            expiredMarked += 1;
          } catch {
            expiredSkipped += 1;
          }
        }
      }
    } catch (err) {
      alerts.push({
        code: 'EXPIRED_MARK',
        message: err.message,
        at: new Date(),
      });
    }

    await finishJobRun(job, {
      status: 'ok',
      counts: {
        expiringLots: lots.length,
        withinDays: Number(withinDays) || 30,
        expiredMarked,
        expiredSkipped,
      },
      errors: alerts.slice(0, 100),
      result: { kind: 'expiry_alerts' },
    });
    return { count: lots.length, expiredMarked, expiredSkipped };
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'EXPIRY_ALERTS', message: err.message }],
    });
    throw err;
  }
}

async function runCyclicCountStamp(tenantId, { trigger, userId }) {
  const tid = toObjectId(tenantId);
  const job = await startJobRun(tenantId, { jobType: 'cyclic_count', trigger, userId });
  try {
    const now = new Date();
    const locs = await InvLocation.find({
      tenantId: tid,
      usage: 'internal',
      active: true,
      cyclicCountFrequencyDays: { $gt: 0 },
    }).select('_id cyclicCountFrequencyDays nextCountDate lastCountDate').lean();

    let stamped = 0;
    for (const loc of locs) {
      const due = !loc.nextCountDate || loc.nextCountDate <= now;
      if (!due) continue;
      const next = new Date(now);
      next.setDate(next.getDate() + Number(loc.cyclicCountFrequencyDays));
      await InvLocation.updateOne(
        { _id: loc._id, tenantId: tid },
        { $set: { lastCountDate: now, nextCountDate: next } },
      );
      stamped += 1;
    }
    await finishJobRun(job, {
      status: 'ok',
      counts: { locations: locs.length, stamped },
      result: { kind: 'cyclic_count_stamp' },
    });
    return { stamped };
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'CYCLIC_COUNT', message: err.message }],
    });
    throw err;
  }
}

async function runExportJob(tenantId, { trigger, userId, exportJobId, exportOpts }) {
  const job = await startJobRun(tenantId, { jobType: 'export', trigger, userId });
  try {
    if (!exportJobId) {
      await finishJobRun(job, {
        status: 'ok',
        counts: {},
        result: { skipped: true, reason: 'no exportJobId' },
      });
      return { skipped: true };
    }
    const { runQueuedExport, getExportJob } = await import('./universalIe.js');
    if (exportOpts?.model) {
      await runQueuedExport(tenantId, exportJobId, exportOpts);
    }
    const exportJob = await getExportJob(tenantId, exportJobId);
    await finishJobRun(job, {
      status: exportJob.status === 'done' ? 'ok' : (exportJob.status === 'failed' ? 'failed' : 'partial'),
      counts: { rowCount: exportJob.rowCount || 0 },
      result: { exportJobId, status: exportJob.status },
      errors: exportJob.error ? [{ code: 'EXPORT', message: exportJob.error }] : [],
    });
    return { exportJob };
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'EXPORT', message: err.message }],
    });
    throw err;
  }
}

async function runDeliveryNotifyStub(tenantId, { trigger, userId, payload }) {
  const job = await startJobRun(tenantId, { jobType: 'delivery_notify', trigger, userId });
  await finishJobRun(job, {
    status: 'ok',
    counts: { notified: 0 },
    result: {
      kind: 'delivery_notify',
      skipped: true,
      reason: 'Email/SMS carrier delivery confirmations are stubbed — no live provider wired',
      transferId: payload?.transferId || null,
    },
  });
  return { skipped: true };
}

async function runDueCountPlansJob(tenantId, { trigger, userId }) {
  const job = await startJobRun(tenantId, { jobType: 'count_plan_due', trigger, userId });
  try {
    const { runDueCountPlans } = await import('./countPlans.js');
    const result = await runDueCountPlans(tenantId, userId);
    const ok = result.results.filter((r) => r.ok).length;
    const failed = result.results.filter((r) => !r.ok).length;
    await finishJobRun(job, {
      status: failed && !ok ? 'failed' : (failed ? 'partial' : 'ok'),
      counts: { due: result.due, ok, failed },
      result,
      errors: result.results.filter((r) => !r.ok).map((r) => ({
        code: 'COUNT_PLAN',
        message: r.error || 'failed',
        ref: r.planId,
      })),
    });
    return result;
  } catch (err) {
    await finishJobRun(job, {
      status: 'failed',
      errors: [{ code: 'COUNT_PLAN', message: err.message }],
    });
    throw err;
  }
}
