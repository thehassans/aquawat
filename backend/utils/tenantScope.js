import mongoose from 'mongoose';

export class TenantScopeError extends Error {
  constructor(message = 'Tenant context required', statusCode = 400) {
    super(message);
    this.name = 'TenantScopeError';
    this.statusCode = statusCode;
  }
}

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
};

/**
 * Resolve a concrete tenant id for data access.
 * Never returns null — throws TenantScopeError instead (prevents cross-tenant leaks).
 * Super-admin: x-tenant-id (or query/body tenantId) wins over JWT tenantId so impersonation works.
 */
export function resolveTenantId(user, req = null) {
  if (user?.role === 'super_admin') {
    const headerId = req?.headers?.['x-tenant-id'] || req?.query?.tenantId || req?.body?.tenantId;
    if (headerId) {
      const id = toObjectId(headerId);
      if (!id) throw new TenantScopeError('Invalid tenant id', 400);
      return id;
    }
  }

  if (user?.tenantId) {
    return toObjectId(user.tenantId) || user.tenantId;
  }

  if (user?.role === 'super_admin') {
    throw new TenantScopeError('x-tenant-id header required for super_admin tenant data access', 400);
  }

  throw new TenantScopeError('Tenant context required', 403);
}

/** Build a Mongo filter that always includes tenantId. */
export function withTenant(tenantId, extra = {}) {
  if (!tenantId) throw new TenantScopeError();
  return { tenantId, ...extra };
}

/** Express helper — send TenantScopeError as JSON. */
export function handleTenantScopeError(res, error) {
  if (error instanceof TenantScopeError) {
    return res.status(error.statusCode || 400).json({ error: error.message, success: false });
  }
  return null;
}

export default { resolveTenantId, withTenant, TenantScopeError, handleTenantScopeError };
