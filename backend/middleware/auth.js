import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { getTenantBusinessTypes } from '../utils/businessTypes.js';

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

    // Load the user WITH the instance methods intact (no .lean()) so
    // `user.hasPermission(...)` inside `checkPermission` still works.
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'User account is deactivated' });
    }

    // Check if tenant is active (for non-super admins).
    if (user.role !== 'super_admin' && user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId).lean();
      if (!tenant) {
        return res.status(401).json({ error: 'Tenant account is inactive' });
      }
      // If tenant is inactive, still attach it so /auth/me can return isActive:false.
      // The frontend InactiveBlocker in MainLayout will handle the UI lockout.
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
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
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
      req.user.tenantId = req.headers['x-tenant-id']; // allow POSTs to inherit
    } else {
      req.tenantFilter = {};
    }
  } else {
    req.tenantFilter = { tenantId: req.user.tenantId };
  }
  next();
};

export const authenticate = protect;

export default { protect, authenticate, authorize, checkPermission, tenantFilter, requireBusinessType, checkEmailAddon, tenantHasEmailAddon };
