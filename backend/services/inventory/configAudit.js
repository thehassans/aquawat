import InvConfigAudit from '../../models/inventory/InvConfigAudit.js';
import { toObjectId } from '../../models/inventory/common.js';

/**
 * Record who changed money-moving config (settings, warehouse steps, category costing).
 */
export async function recordConfigAudit({
  tenantId,
  userId = null,
  userName = null,
  resourceType,
  resourceId = null,
  resourceName = null,
  action = 'update',
  changes = [],
  note = null,
}) {
  if (!tenantId || !changes?.length) return null;
  try {
    return await InvConfigAudit.create({
      tenantId: toObjectId(tenantId),
      userId: userId ? toObjectId(userId) : undefined,
      userName,
      resourceType,
      resourceId: resourceId != null ? String(resourceId) : undefined,
      resourceName,
      action,
      changes,
      note,
    });
  } catch (err) {
    console.warn('[inv-audit]', err.message);
    return null;
  }
}

/** Diff plain objects for selected keys. */
export function diffFields(before, after, keys) {
  const changes = [];
  for (const field of keys) {
    const from = before?.[field];
    const to = after?.[field];
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
      changes.push({ field, from: from ?? null, to: to ?? null });
    }
  }
  return changes;
}
