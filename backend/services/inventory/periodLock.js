import InvTransfer from '../../models/inventory/InvTransfer.js';
import InvMove from '../../models/inventory/InvMove.js';
import InvQuant from '../../models/inventory/InvQuant.js';
import InvLocation from '../../models/inventory/InvLocation.js';
import { D } from '../../utils/decimal.js';
import { toObjectId } from '../../models/inventory/common.js';
import { getInvSettings } from './settingsService.js';
import { InventoryValidationError } from './errors.js';
import { recordConfigAudit } from './configAudit.js';

export async function getPeriodLockDate(tenantId) {
  const settings = await getInvSettings(tenantId);
  return settings?.inventoryPeriodLockDate ? new Date(settings.inventoryPeriodLockDate) : null;
}

export async function assertNotPeriodLocked(tenantId, effectiveDate, {
  message,
  messageAr,
} = {}) {
  const lock = await getPeriodLockDate(tenantId);
  if (!lock) return;
  const endOfLock = new Date(lock);
  endOfLock.setHours(23, 59, 59, 999);
  const d = effectiveDate ? new Date(effectiveDate) : new Date();
  if (d <= endOfLock) {
    const day = endOfLock.toISOString().slice(0, 10);
    throw new InventoryValidationError(
      message || `Posting blocked — inventory period locked through ${day}`,
      'PERIOD_LOCKED',
      {
        messageAr: messageAr || `الترحيل محظور — الفترة مقفلة حتى ${day}`,
        lockDate: day,
      },
    );
  }
}

export async function setPeriodLockDate(tenantId, userId, lockDate) {
  const tid = toObjectId(tenantId);
  const { default: InvSettings } = await import('../../models/inventory/InvSettings.js');
  const settings = await InvSettings.findOne({ tenantId: tid });
  if (!settings) throw new InventoryValidationError('Settings not found', 'NO_SETTINGS');
  const prior = settings.inventoryPeriodLockDate;
  settings.inventoryPeriodLockDate = lockDate ? new Date(lockDate) : null;
  if (userId) settings.updatedBy = userId;
  await settings.save();
  await recordConfigAudit({
    tenantId: tid,
    userId,
    resourceType: 'settings',
    resourceId: settings._id,
    resourceName: 'inventoryPeriodLockDate',
    changes: [{ field: 'inventoryPeriodLockDate', from: prior, to: settings.inventoryPeriodLockDate }],
  });
  return settings;
}

/** B.7 — month-end close checklist */
export async function periodCloseChecklist(tenantId, { asOf } = {}) {
  const tid = toObjectId(tenantId);
  const cutoff = asOf ? new Date(asOf) : new Date();
  const blocking = [];
  const warnings = [];

  const pendingVariance = await InvQuant.countDocuments({
    tenantId: tid,
    varianceApprovalRequired: true,
    countedQuantity: { $ne: null },
  });
  if (pendingVariance > 0) {
    blocking.push({
      code: 'PENDING_COUNT_VARIANCE',
      count: pendingVariance,
      message: `${pendingVariance} count line(s) awaiting variance approval`,
      messageAr: `${pendingVariance} سطر/أسطر عد بانتظار اعتماد الفروقات`,
    });
  }

  const stalePickings = await InvTransfer.countDocuments({
    tenantId: tid,
    state: { $nin: ['done', 'cancelled'] },
    scheduledDate: { $lt: cutoff },
  });
  if (stalePickings > 0) {
    warnings.push({
      code: 'STALE_PICKINGS',
      count: stalePickings,
      message: `${stalePickings} unvalidated transfer(s) scheduled before period end`,
      messageAr: `${stalePickings} تحويل/تحويلات غير مُعتمدة قبل نهاية الفترة`,
    });
  }

  const waitingMoves = await InvMove.countDocuments({
    tenantId: tid,
    state: 'waiting',
    dateDeadline: { $lt: cutoff },
  });
  if (waitingMoves > 0) {
    warnings.push({
      code: 'WAITING_MOVES',
      count: waitingMoves,
      message: `${waitingMoves} move(s) still waiting past deadline`,
      messageAr: `${waitingMoves} حركة/حركات بانتظار تجاوزت الموعد`,
    });
  }

  const internalLocs = await InvLocation.find({
    tenantId: tid,
    usage: 'internal',
    active: true,
  }).select('_id').lean();
  const locIds = internalLocs.map((l) => l._id);
  const negativeQuants = await InvQuant.countDocuments({
    tenantId: tid,
    locationId: { $in: locIds },
    quantity: { $lt: '0' },
  });
  if (negativeQuants > 0) {
    blocking.push({
      code: 'NEGATIVE_QUANTS',
      count: negativeQuants,
      message: `${negativeQuants} negative quant(s) on internal locations`,
      messageAr: `${negativeQuants} رصيد/أرصدة سالبة في مواقع داخلية`,
    });
  }

  let integrityOk = null;
  try {
    const { assertProductStockCache } = await import('./syncProductCache.js');
    const assert = await assertProductStockCache(tid, { limit: 200 });
    integrityOk = assert.ok;
    if (!assert.ok) {
      blocking.push({
        code: 'CACHE_DRIFT',
        count: assert.mismatchCount,
        message: `Product stock cache drift: ${assert.mismatchCount} mismatch(es)`,
        messageAr: `انحراف ذاكرة المخزون: ${assert.mismatchCount} عدم تطابق`,
      });
    }
  } catch (err) {
    warnings.push({
      code: 'INTEGRITY_SKIPPED',
      message: err.message,
    });
  }

  const lock = await getPeriodLockDate(tenantId);
  return {
    asOf: cutoff.toISOString(),
    lockDate: lock ? lock.toISOString().slice(0, 10) : null,
    canClose: blocking.length === 0,
    blocking,
    warnings,
    integrityOk,
  };
}
