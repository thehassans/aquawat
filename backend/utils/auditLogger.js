import UserActivityLog from '../models/UserActivityLog.js';

/**
 * Safely and asynchronously records a user action into the audit trail.
 */
export async function recordUserActivity(req, {
  action,
  module,
  resourceType,
  resourceId,
  resourceName,
  description,
  descriptionAr,
  status = 'success',
  details = {},
  userId = null,
  userName = null,
  userEmail = null,
  userRole = null,
  tenantId = null,
}) {
  try {
    const effectiveTenantId = tenantId || req?.user?.tenantId || req?.tenant?._id;
    if (!effectiveTenantId) return null;

    const user = req?.user;
    const effectiveUserId = userId || user?._id;
    const effectiveUserName =
      userName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.email ||
      'System';
    const effectiveUserEmail = userEmail || user?.email || '';
    const effectiveUserRole = userRole || user?.role || 'user';

    const rawIp =
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '';
    const ipAddress = rawIp ? rawIp.replace('::ffff:', '') : '';
    const userAgent = req?.headers?.['user-agent'] || '';

    return await UserActivityLog.create({
      tenantId: effectiveTenantId,
      userId: effectiveUserId,
      userName: effectiveUserName,
      userEmail: effectiveUserEmail,
      userRole: effectiveUserRole,
      action: action || 'update',
      module: module || 'system',
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      resourceName,
      description: description || `${action} on ${resourceType || module}`,
      descriptionAr: descriptionAr || description,
      status,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Non-blocking log error
    console.warn('[AuditLogger] Non-blocking activity log error:', error.message);
    return null;
  }
}

export default { recordUserActivity };
