import InvSettings from '../../models/inventory/InvSettings.js';
import InvSchedulerRun from '../../models/inventory/InvSchedulerRun.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvProductStockCache from '../../models/inventory/InvProductStockCache.js';
import { toObjectId } from '../../models/inventory/common.js';

export const ENGINE_VERSION = '3.1.0-p2';

/**
 * Module health snapshot for Overview strip + ops.
 */
export async function inventoryModuleHealth(tenantId) {
  const tid = toObjectId(tenantId);
  const now = new Date();

  const [settings, lastScheduler, waitingPastDeadline, openValidating, cacheRows] = await Promise.all([
    InvSettings.findOne({ tenantId: tid })
      .select('engineEnabled stockAccountingEnabled schedulerEnabled groupStockMultiLocations')
      .lean(),
    InvSchedulerRun.findOne({ tenantId: tid }).sort({ startedAt: -1 }).select('startedAt status error counts').lean(),
    InvMove.countDocuments({
      tenantId: tid,
      state: 'waiting',
      deadlineDate: { $lt: now },
    }),
    InvTransfer.countDocuments({
      tenantId: tid,
      validateLock: { $ne: null },
    }),
    InvProductStockCache.countDocuments({ tenantId: tid }),
  ]);

  const issues = [];
  if (!settings?.engineEnabled) issues.push({ code: 'ENGINE_OFF', severity: 'info', message: 'Inventory engine is disabled' });
  if (waitingPastDeadline > 0) {
    issues.push({
      code: 'WAITING_PAST_DEADLINE',
      severity: 'warning',
      message: `${waitingPastDeadline} move(s) waiting past deadline`,
      count: waitingPastDeadline,
    });
  }
  if (openValidating > 0) {
    issues.push({
      code: 'VALIDATE_LOCK',
      severity: 'warning',
      message: `${openValidating} transfer(s) hold a validate lock`,
      count: openValidating,
    });
  }
  if (lastScheduler?.status === 'failed') {
    issues.push({
      code: 'SCHEDULER_FAILED',
      severity: 'error',
      message: lastScheduler.error || 'Last scheduler run failed',
    });
  }

  const status = issues.some((i) => i.severity === 'error')
    ? 'critical'
    : issues.some((i) => i.severity === 'warning')
      ? 'warning'
      : 'healthy';

  return {
    engineVersion: ENGINE_VERSION,
    status,
    engineEnabled: Boolean(settings?.engineEnabled),
    stockAccountingEnabled: Boolean(settings?.stockAccountingEnabled),
    schedulerEnabled: Boolean(settings?.schedulerEnabled),
    lastSchedulerRun: lastScheduler
      ? {
        startedAt: lastScheduler.startedAt,
        status: lastScheduler.status,
        error: lastScheduler.error || null,
      }
      : null,
    waitingPastDeadline,
    openValidateLocks: openValidating,
    cacheRowCount: cacheRows,
    issues,
    checkedAt: now.toISOString(),
  };
}
