import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { getTenantBusinessTypes } from '../utils/businessTypes.js';

// In-memory cache for ultra-fast auth checks (eliminates 2 DB queries per request)
const USER_CACHE_TTL_MS = 30 * 1000; // 30s TTL
const TENANT_CACHE_TTL_MS = 60 * 1000; // 60s TTL
const userCache = new Map();
const tenantCache = new Map();

// Periodic cleanup to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of userCache.entries()) {
    if (now - val.timestamp > USER_CACHE_TTL_MS) userCache.delete(key);
  }
  for (const [key, val] of tenantCache.entries()) {
    if (now - val.timestamp > TENANT_CACHE_TTL_MS) tenantCache.delete(key);
  }
}, 60 * 1000).unref();

export const invalidateAuthCache = (userId, tenantId) => {
  if (userId) userCache.delete(String(userId));
  if (tenantId) tenantCache.delete(String(tenantId));
};

export const tenantHasEmailAddon = (tenant) => {
  if (!tenant) return false;
  if (tenant.subscription?.hasEmailAddon === true) return true;
  const features = Array.isArray(tenant.subscription?.features) ? tenant.subscription.features : [];
  return features.includes('email_automation');
};

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = String(decoded.id);

    // 1. Resolve User from Cache or DB
    let user;
    const cachedUser = userCache.get(userId);
    if (cachedUser && (Date.now() - cachedUser.timestamp < USER_CACHE_TTL_MS)) {
      user = cachedUser.user;
    } else {
      user = await User.findById(decoded.id).select('-password');
      if (user) {
        userCache.set(userId, { user, timestamp: Date.now() });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      userCache.delete(userId);
      return res.status(401).json({ error: 'User account is deactivated' });
    }

    // 2. Resolve Tenant from Cache or DB (for non-super admins)
    if (user.role !== 'super_admin' && user.tenantId) {
      const tenantId = String(user.tenantId);
      let tenant;
      const cachedTenant = tenantCache.get(tenantId);
      if (cachedTenant && (Date.now() - cachedTenant.timestamp < TENANT_CACHE_TTL_MS)) {
        tenant = cachedTenant.tenant;
      } else {
        tenant = await Tenant.findById(user.tenantId).lean();
        if (tenant) {
          tenantCache.set(tenantId, { tenant, timestamp: Date.now() });
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

export const checkPermission = (module, action) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }
    
    if (!req.user.hasPermission(module, action)) {
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

export default { protect, authenticate, authorize, checkPermission, tenantFilter, requireBusinessType, checkEmailAddon, tenantHasEmailAddon, invalidateAuthCache };
