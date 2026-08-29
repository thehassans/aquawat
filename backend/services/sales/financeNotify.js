import User from '../../models/User.js';
import CRMActivity from '../../models/CRMActivity.js';

/**
 * Notify finance (or admins) when an SO is held for credit / margin.
 */
export async function notifyFinanceApprovalHold({
  tenantId,
  order,
  reason,
  code,
  userId,
}) {
  const financeUsers = await User.find({
    tenantId,
    isActive: { $ne: false },
    $or: [
      { role: { $in: ['admin', 'owner', 'manager', 'finance'] } },
      { 'permissions.module': 'finance' },
      { 'permissions.module': 'sales', 'permissions.actions': 'approve' },
    ],
  })
    .select('_id email firstName')
    .limit(25)
    .lean();

  const subject = `${code || 'APPROVAL'}: ${order.poNumber || order._id}`;
  const description = String(reason || 'Sales order requires finance/manager approval');
  const created = [];

  for (const u of financeUsers) {
    if (userId && String(u._id) === String(userId)) continue;
    const act = await CRMActivity.create({
      tenantId,
      type: 'task',
      subject,
      description,
      purchaseOrderId: order._id,
      customerId: order.customerId?._id || order.customerId || null,
      assignedTo: u._id,
      status: 'pending',
      dueDate: new Date(),
      createdBy: userId,
    });
    created.push(act._id);
  }

  return { notified: created.length, activityIds: created };
}

/** True if user may release a credit/margin hold */
export function canReleaseSalesApproval(user, approvalCode) {
  if (!user) return false;
  if (['admin', 'owner', 'manager', 'super_admin', 'superadmin'].includes(user.role)) return true;

  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  const has = (mod, action) => {
    const row = perms.find((p) => p?.module === mod);
    return row?.actions?.includes?.(action);
  };

  if (approvalCode === 'CREDIT_LIMIT_EXCEEDED') {
    return has('finance', 'approve') || has('finance', 'update') || has('sales', 'approve');
  }
  if (approvalCode === 'MARGIN_BELOW_THRESHOLD') {
    return has('sales', 'approve') || has('sales', 'margin') || has('finance', 'approve');
  }
  return has('sales', 'approve');
}
