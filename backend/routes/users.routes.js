import express from 'express';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { protect, tenantFilter, checkPermission } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { getTenantBusinessTypes } from '../utils/businessTypes.js';
import { sendUserWelcomeEmail } from '../utils/tenantEmailService.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);

const sanitizeUserForClient = (u) => {
  if (!u) return null;
  const obj = typeof u.toObject === 'function' ? u.toObject() : u;
  const { password, ...rest } = obj;
  return rest;
};

const sanitizePermissionsForTenant = (permissions = [], tenant) => {
  const businessTypes = getTenantBusinessTypes(tenant);
  const blockedModules = new Set();

  if (!businessTypes.includes('travel_agency')) blockedModules.add('travel');
  if (!businessTypes.includes('restaurant')) blockedModules.add('restaurant');

  return (Array.isArray(permissions) ? permissions : [])
    .filter((permission) => permission?.module && !blockedModules.has(String(permission.module)));
};

router.get('/', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, isActive } = req.query;

    const query = { ...req.tenantFilter };

    if (typeof isActive !== 'undefined') {
      query.isActive = String(isActive) === 'true';
    }

    if (role) query.role = role;

    if (search) {
      const q = String(search).trim();
      query.$or = [
        { email: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { firstNameAr: { $regex: q, $options: 'i' } },
        { lastNameAr: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant associated with user' });

    const [tenant, activeCount, totalCount] = await Promise.all([
      Tenant.findById(tenantId).select('subscription.maxUsers'),
      User.countDocuments({ tenantId, isActive: true }),
      User.countDocuments({ tenantId }),
    ]);

    res.json({
      maxUsers: tenant?.subscription?.maxUsers ?? 0,
      activeUsers: activeCount,
      totalUsers: totalCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', checkTrialLimits('users'), checkPermission('settings', 'create'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant associated with user' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const maxUsers = Number(tenant.subscription?.maxUsers ?? 0);
    if (Number.isFinite(maxUsers) && maxUsers > 0) {
      const activeCount = await User.countDocuments({ tenantId, isActive: true });
      if (activeCount >= maxUsers) {
        return res.status(403).json({ error: 'User limit reached for this tenant' });
      }
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const sendWelcomeEmail = req.body?.sendWelcomeEmail !== false;

    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!firstName) return res.status(400).json({ error: 'First name is required' });
    if (!lastName) return res.status(400).json({ error: 'Last name is required' });

    const existing = await User.findOne({ tenantId, email });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const role = String(req.body?.role || 'viewer');
    if (role === 'super_admin') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (role === 'kitchen_staff' && !getTenantBusinessTypes(tenant).includes('restaurant')) {
      return res.status(400).json({ error: 'Kitchen staff is not available for this tenant' });
    }

    let permissions = sanitizePermissionsForTenant(req.body?.permissions, tenant);
    if (role === 'kitchen_staff' && permissions.length === 0) {
      permissions = [{ module: 'restaurant', actions: ['read', 'update'] }];
    }

    const created = await User.create({
      tenantId,
      branchId: req.body?.branchId || undefined,
      email,
      password,
      firstName,
      lastName,
      firstNameAr: req.body?.firstNameAr,
      lastNameAr: req.body?.lastNameAr,
      phone: req.body?.phone,
      role,
      permissions,
      isActive: true,
    });

    const saved = await User.findById(created._id).select('-password');
    let inviteEmailSent = false;
    let inviteEmailError = null;
    if (sendWelcomeEmail) {
      try {
        await sendUserWelcomeEmail({
          tenant,
          user: saved,
          temporaryPassword: password,
          language: String(req.body?.inviteLanguage || req.headers['accept-language'] || 'en').startsWith('ar') ? 'ar' : 'en',
        });
        inviteEmailSent = true;
      } catch (mailError) {
        inviteEmailError = mailError?.message || 'Failed to send welcome email';
        logger.warn(`User created but welcome email failed for ${email}: ${inviteEmailError}`);
      }
    }

    res.status(201).json({
      ...sanitizeUserForClient(saved),
      inviteEmailSent,
      inviteEmailError,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Duplicate user email' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', checkPermission('settings', 'update'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant associated with user' });

    const existing = await User.findOne({ _id: req.params.id, tenantId }).select('+password');
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (String(existing._id) === String(req.user?._id)) {
      return res.status(400).json({ error: 'You cannot modify your own user from here' });
    }

    if (typeof req.body?.email !== 'undefined') {
      const email = String(req.body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const dupe = await User.findOne({ tenantId, email, _id: { $ne: existing._id } });
      if (dupe) return res.status(400).json({ error: 'User already exists' });
      existing.email = email;
    }

    if (typeof req.body?.firstName !== 'undefined') existing.firstName = String(req.body.firstName || '').trim();
    if (typeof req.body?.lastName !== 'undefined') existing.lastName = String(req.body.lastName || '').trim();
    if (typeof req.body?.firstNameAr !== 'undefined') existing.firstNameAr = req.body.firstNameAr;
    if (typeof req.body?.lastNameAr !== 'undefined') existing.lastNameAr = req.body.lastNameAr;
    if (typeof req.body?.phone !== 'undefined') existing.phone = req.body.phone;
    if (typeof req.body?.branchId !== 'undefined') existing.branchId = req.body.branchId || undefined;

    if (typeof req.body?.role !== 'undefined') {
      const role = String(req.body.role || 'viewer');
      if (role === 'super_admin') return res.status(400).json({ error: 'Invalid role' });
      if (role === 'kitchen_staff' && !getTenantBusinessTypes(req.tenant).includes('restaurant')) {
        return res.status(400).json({ error: 'Kitchen staff is not available for this tenant' });
      }
      existing.role = role;
    }

    if (typeof req.body?.permissions !== 'undefined') {
      let permissions = sanitizePermissionsForTenant(req.body.permissions, req.tenant);
      if (existing.role === 'kitchen_staff' && permissions.length === 0) {
        permissions = [{ module: 'restaurant', actions: ['read', 'update'] }];
      }
      existing.permissions = permissions;
    }

    if (typeof req.body?.isActive !== 'undefined') {
      existing.isActive = Boolean(req.body.isActive);
    }

    if (req.body?.password) {
      const password = String(req.body.password);
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      existing.password = password;
    }

    await existing.save();

    const saved = await User.findById(existing._id).select('-password');
    res.json(sanitizeUserForClient(saved));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', checkPermission('settings', 'delete'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant associated with user' });

    const existing = await User.findOne({ _id: req.params.id, tenantId });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (String(existing._id) === String(req.user?._id)) {
      return res.status(400).json({ error: 'You cannot deactivate your own user' });
    }

    existing.isActive = false;
    await existing.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
