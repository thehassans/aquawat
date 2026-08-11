import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { getTenantBusinessTypes } from '../utils/businessTypes.js';
import { cacheGet, cacheSet, cacheDel, isRedisReady } from '../lib/redis.js';

// ─── L1: In-process memory cache (microsecond hits, private per worker) ────────
const USER_CACHE_TTL_MS = 30 * 1000;   // 30s
const TENANT_CACHE_TTL_MS = 60 * 1000; // 60s
const userCache = new Map();
const tenantCache = new Map();

// ─── L2: Redis shared cache (cross-worker, surviving worker restarts) ──────────
const USER_REDIS_TTL_S = 60;   // 60 seconds
const TENANT_REDIS_TTL_S = 120; // 2 minutes

// Periodic L1 cleanup to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of userCache.entries()) {
    if (now - val.timestamp > USER_CACHE_TTL_MS) userCache.delete(key);
  }
  for (const [key, val] of tenantCache.entries()) {
    if (now - val.timestamp > TENANT_CACHE_TTL_MS) tenantCache.delete(key);
  }
}, 60 * 1000).unref();

export const invalidateAuthCache = async (userId, tenantId) => {
  if (userId) {
    userCache.delete(String(userId));
    await cacheDel(`user:${userId}`);
  }
  if (tenantId) {
    tenantCache.delete(String(tenantId));
    await cacheDel(`tenant:${tenantId}`);
  }
};

export const tenantHasEmailAddon = (tenant) => {
  if (!tenant) return false;
  if (tenant.subscription?.hasEmailAddon === true) return true;
  const features = Array.isArray(tenant.subscription?.features) ? tenant.subscription.features : [];
  if (features.includes('email_automation')) return true;
  // App Store "Email Suite" unlocks the same email APIs as the paid add-on flag.
  const emailApp = tenant.settings?.installedApps?.email_suite;
  return emailApp?.isInstalled === true && emailApp?.isEnabled !== false;
};

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.maqder_token) {
      token = req.cookies.maqder_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = String(decoded.id);

    // 1. Resolve User — L1 in-process → L2 Redis → MongoDB
    let user;
    const cachedUser = userCache.get(userId);
    if (cachedUser && (Date.now() - cachedUser.timestamp < USER_CACHE_TTL_MS)) {
      user = cachedUser.user;
    } else {
      // Try Redis L2 (shared across workers)
      const redisUser = await cacheGet(`user:${userId}`);
      if (redisUser) {
        user = redisUser;
        userCache.set(userId, { user, timestamp: Date.now() });
      } else {
        // Fetch from MongoDB
        user = await User.findById(decoded.id).select('-password').lean();
        if (user) {
          userCache.set(userId, { user, timestamp: Date.now() });
          await cacheSet(`user:${userId}`, user, USER_REDIS_TTL_S);
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      userCache.delete(userId);
      await cacheDel(`user:${userId}`);
      return res.status(401).json({ error: 'User account is deactivated' });
    }

    // 2. Resolve Tenant — L1 → L2 → MongoDB (for non-super admins)
    if (user.role !== 'super_admin' && user.tenantId) {
      const tenantId = String(user.tenantId);
      let tenant;
      const cachedTenant = tenantCache.get(tenantId);
      if (cachedTenant && (Date.now() - cachedTenant.timestamp < TENANT_CACHE_TTL_MS)) {
        tenant = cachedTenant.tenant;
      } else {
        // Try Redis L2
        const redisTenant = await cacheGet(`tenant:${tenantId}`);
        if (redisTenant) {
          tenant = redisTenant;
          tenantCache.set(tenantId, { tenant, timestamp: Date.now() });
        } else {
          // Fetch from MongoDB — only fields needed by protect / checkEmailAddon /
          // requireBusinessType / dashboard installedApps. Avoid caching ecommerce
          // newsletter lists, payment secrets, CSID private material, etc.
          const TENANT_AUTH_SELECT = [
            'isActive',
            'subscription',
            'businessType',
            'businessTypes',
            'business',
            'settings.currency',
            'settings.invoiceLanguage',
            'settings.invoiceBranding',
            'settings.installedApps',
            'branding',
            'name',
            'slug',
            'zatca.isOnboarded',
            'zatca.phase',
          ].join(' ');
          tenant = await Tenant.findById(user.tenantId).select(TENANT_AUTH_SELECT).lean();
          if (tenant) {
            tenantCache.set(tenantId, { tenant, timestamp: Date.now() });
            await cacheSet(`tenant:${tenantId}`, tenant, TENANT_REDIS_TTL_S);
          }
        }
      }

      if (!tenant) {
        return res.status(401).json({ error: 'Tenant account is inactive' });
      }

      req.tenant = tenant;
      if (tenant.isActive && tenant.subscription?.status !== 'active') {
        return res.status(403).json({ error: 'Subscription expired or inactive' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ 
      error: `Role ${req.user.role} is not authorized to access this route` 
    });
  };
};

export const checkEmailAddon = (req, res, next) => {
  if (req.user.role === 'super_admin') {
    return next();
  }

  if (!tenantHasEmailAddon(req.tenant)) {
    return res.status(403).json({ error: 'Email add-on is not enabled for this tenant' });
  }

  next();
};

export const requireBusinessType = (...allowedTypes) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') {
      return next();
    }

    const businessTypes = getTenantBusinessTypes(req.tenant);
    if (allowedTypes.length > 0 && !allowedTypes.some((type) => businessTypes.includes(type))) {
      return res.status(403).json({ error: 'Not available for this business type' });
    }

    next();
  };
};

/** Works for both Mongoose docs and lean() plain objects. */
export const userHasPermission = (user, module, action) => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (typeof user.hasPermission === 'function') {
    return user.hasPermission(module, action);
  }
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const perm = permissions.find((p) => p.module === module);
  return Boolean(perm && Array.isArray(perm.actions) && perm.actions.includes(action));
};

export const checkPermission = (module, action) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }
    
    if (!userHasPermission(req.user, module, action)) {
      return res.status(403).json({ 
        error: `Not authorized to ${action} in ${module} module` 
      });
    }
    next();
  };
};

export const tenantFilter = (req, res, next) => {
  if (req.user.role === 'super_admin') {
    if (req.headers['x-tenant-id']) {
      req.tenantFilter = { tenantId: req.headers['x-tenant-id'] };
      req.user = Object.assign(Object.create(Object.getPrototypeOf(req.user)), req.user, { tenantId: req.headers['x-tenant-id'] });
    } else {
      req.tenantFilter = {};
    }
  } else {
    req.tenantFilter = { tenantId: req.user.tenantId };
  }
  next();
};

export const authenticate = protect;

export default { protect, authenticate, authorize, checkPermission, userHasPermission, tenantFilter, requireBusinessType, checkEmailAddon, tenantHasEmailAddon, invalidateAuthCache };
