/**
 * Poll endpoints are JWT-gated. Never return payment status or apply an
 * upgrade unless metadata.tenantId is the caller (or super_admin / demo email).
 */
export function canFulfillPaymentForTenant(req, metadata = {}) {
  const targetTenantId = metadata?.tenantId;
  if (!targetTenantId) return false;
  if (req.user?.role === 'super_admin') return true;
  if (req.user?.tenantId && String(req.user.tenantId) === String(targetTenantId)) return true;
  const demoEmail = String(metadata.demoEmail || '').trim().toLowerCase();
  const userEmail = String(req.user?.email || '').trim().toLowerCase();
  return Boolean(demoEmail && userEmail && demoEmail === userEmail);
}

/** @returns {boolean} true when the response was already sent (403). */
export function rejectUnauthorizedPaymentPoll(req, res, metadata) {
  if (canFulfillPaymentForTenant(req, metadata)) return false;
  res.status(403).json({ error: 'Not authorized to view this payment' });
  return true;
}

export default { canFulfillPaymentForTenant, rejectUnauthorizedPaymentPoll };
