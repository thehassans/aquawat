import express from 'express';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import UserActivityLog from '../models/UserActivityLog.js';
import { protect, tenantFilter, checkPermission, requireTenantFilter } from '../middleware/auth.js';
import { checkTrialLimits } from '../middleware/trialLimits.js';
import { getTenantBusinessTypes } from '../utils/businessTypes.js';
import { sendUserWelcomeEmail } from '../utils/tenantEmailService.js';
import { recordUserActivity } from '../utils/auditLogger.js';
import { isAppAccessValid } from '../utils/appTrial.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.use(protect);
router.use(tenantFilter);
router.use(requireTenantFilter);

const sanitizeUserForClient = (u) => {
  if (!u) return null;
  const obj = typeof u.toObject === 'function' ? u.toObject() : u;
  const { password, ...rest } = obj;
  return rest;
};

export const getTenantPermissibleModules = (tenant) => {
  const businessTypes = getTenantBusinessTypes(tenant);
  const installedApps = tenant?.settings?.installedApps || {};
  const isAppOn = (key) => isAppAccessValid(installedApps[key]);

  // Core base modules that all tenants have
  const modules = new Set(['invoicing', 'inventory', 'settings']);

  // Supply chain / Purchases
  if (
    businessTypes.some((t) =>
      ['trading', 'bakala', 'pharmacy', 'furniture_shop', 'manufacturing', 'construction'].includes(t)
    ) ||
    isAppOn('purchases')
  ) {
    modules.add('supply_chain');
  }

  // Finance / Accounting
  if (
    isAppOn('accounting') ||
    isAppOn('finance') ||
    isAppOn('etimad_procurement') ||
    tenant?.subscription?.hasAccountingAddon === true ||
    tenant?.settings?.enableFinanceModule === true ||
    tenant?.settings?.hasAccounting === true
  ) {
    modules.add('finance');
  }

  // Landed Costs
  if (
    isAppOn('landed_costs') ||
    isAppOn('multicourier_shipping') ||
    tenant?.settings?.enableLandedCosts === true
  ) {
    modules.add('landed_costs');
  }

  // HR & Payroll (App Store app: hr_payroll_pro, qiwa_hr_integration, gosi_mudad_compliance, or manpower business)
  const hasHrInstalled =
    isAppOn('hr_payroll_pro') ||
    isAppOn('qiwa_hr_integration') ||
    isAppOn('hr_suite') ||
    isAppOn('hr') ||
    businessTypes.includes('manpower') ||
    tenant?.subscription?.hasHrAddon === true;

  if (hasHrInstalled) {
    modules.add('hr');
  }

  const hasPayrollInstalled =
    isAppOn('hr_payroll_pro') ||
    isAppOn('gosi_mudad_compliance') ||
    isAppOn('payroll') ||
    businessTypes.includes('manpower') ||
    tenant?.subscription?.hasPayrollAddon === true;

  if (hasPayrollInstalled) {
    modules.add('payroll');
  }

  // Projects & Job Costing
  if (
    businessTypes.includes('construction') ||
    isAppOn('construction_projects') ||
    isAppOn('projects')
  ) {
    modules.add('project_management');
  }

  if (
    businessTypes.includes('construction') ||
    isAppOn('construction_projects') ||
    isAppOn('job_costing') ||
    isAppOn('manufacturing_mes')
  ) {
    modules.add('job_costing');
  }

  // Manufacturing / MRP
  if (businessTypes.includes('manufacturing') || isAppOn('manufacturing_mes') || isAppOn('mrp_manufacturing')) {
    modules.add('mrp');
  }

  // Vertical suites
  if (
    businessTypes.includes('restaurant') ||
    isAppOn('restaurant_cafe') ||
    isAppOn('restaurant_pos') ||
    isAppOn('restaurant_mess') ||
    isAppOn('qr_menu_ordering')
  ) {
    modules.add('restaurant');
  }

  if (businessTypes.includes('travel_agency') || isAppOn('travel_agency')) {
    modules.add('travel');
  }

  if (businessTypes.includes('gym') || isAppOn('gym_fitness_club') || isAppOn('gym')) {
    modules.add('gym');
  }

  if (businessTypes.includes('bakala') || isAppOn('bakala_supermarket') || isAppOn('bakala_pos')) {
    modules.add('bakala');
  }

  if (businessTypes.includes('car_workshop') || isAppOn('car_workshop')) {
    modules.add('car_workshop');
  }

  if (businessTypes.includes('car_rental') || isAppOn('car_rental')) {
    modules.add('car_rental');
  }

  if (businessTypes.includes('laundry') || isAppOn('laundry_cleaning') || isAppOn('laundry_suite')) {
    modules.add('laundry');
  }

  if (
    businessTypes.includes('boutique') ||
    businessTypes.includes('khayyat') ||
    isAppOn('boutique_rental') ||
    isAppOn('tailor_khayyat')
  ) {
    modules.add('boutique');
  }

  if (businessTypes.includes('ecommerce') || isAppOn('ecommerce_store') || isAppOn('ecommerce')) {
    modules.add('ecommerce');
  }

  if (businessTypes.includes('marquee') || isAppOn('marquee_management') || isAppOn('marquee')) {
    modules.add('marquee');
  }

  // Add-on Apps
  if (isAppOn('crm_sales_pipeline') || isAppOn('crm') || isAppOn('queries_crm')) {
    modules.add('crm');
  }

  const isWhatsAppConfigured =
    Boolean(tenant?.settings?.whatsappAccessToken && tenant?.settings?.whatsappPhoneNumberId) ||
    tenant?.settings?.whatsappConnectionStatus === 'connected' ||
    tenant?.settings?.whatsappQrConnected === true;

  if (isAppOn('whatsapp_cloud_auto') || isAppOn('whatsapp') || isWhatsAppConfigured) {
    modules.add('whatsapp');
  }

  if (
    isAppOn('iot_devices') ||
    isAppOn('payment_terminal') ||
    isAppOn('thermal_printer_driver') ||
    isAppOn('weight_scale_driver')
  ) {
    modules.add('iot');
  }

  return Array.from(modules);
};

const sanitizePermissionsForTenant = (permissions = [], tenant) => {
  const allowed = new Set(getTenantPermissibleModules(tenant));

  return (Array.isArray(permissions) ? permissions : []).filter(
    (permission) => permission?.module && allowed.has(String(permission.module))
  );
};

// @route   GET /api/users
// @desc    Get all users for tenant
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

// @route   GET /api/users/stats
// @desc    Get user counts & seat limits
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

// @route   GET /api/users/logs
// @desc    Get audit and activity logs for tenant
router.get('/logs', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant context' });

    const { page = 1, limit = 30, search, userId, module, action, startDate, endDate } = req.query;

    const query = { tenantId };

    if (userId) query.userId = userId;
    if (module) query.module = module;
    if (action) query.action = action;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      const q = String(search).trim();
      query.$or = [
        { userName: { $regex: q, $options: 'i' } },
        { userEmail: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { descriptionAr: { $regex: q, $options: 'i' } },
        { resourceName: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      UserActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UserActivityLog.countDocuments(query),
    ]);

    res.json({
      logs,
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

// @route   GET /api/users/logs/stats
// @desc    Get activity summary metrics
router.get('/logs/stats', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant context' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, distinctUsersToday, topModules] = await Promise.all([
      UserActivityLog.countDocuments({ tenantId }),
      UserActivityLog.countDocuments({ tenantId, createdAt: { $gte: todayStart } }),
      UserActivityLog.distinct('userId', { tenantId, createdAt: { $gte: todayStart } }),
      UserActivityLog.aggregate([
        { $match: { tenantId } },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      totalLogs,
      todayLogs,
      activeUsersToday: distinctUsersToday.length,
      topModules,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/users/:id/logs
// @desc    Get activity logs for specific user
router.get('/:id/logs', checkPermission('settings', 'read'), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'No tenant context' });

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = { tenantId, userId: req.params.id };

    const [logs, total] = await Promise.all([
      UserActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UserActivityLog.countDocuments(query),
    ]);

    res.json({
      logs,
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

// @route   POST /api/users
// @desc    Create a new user with tenant-specific permissions
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
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    // Audit log
    await recordUserActivity(req, {
      action: 'create',
      module: 'users',
      resourceType: 'User',
      resourceId: saved._id,
      resourceName: `${saved.firstName} ${saved.lastName} (${saved.email})`,
      description: `Created user account for ${saved.firstName} ${saved.lastName} with role ${saved.role}`,
      descriptionAr: `تم إنشاء حساب مستخدم جديد لـ ${saved.firstName} ${saved.lastName} بدور ${saved.role}`,
      details: { role: saved.role, permissionsCount: saved.permissions?.length || 0 },
    });

    let inviteEmailSent = false;
    let inviteEmailError = null;
    if (sendWelcomeEmail) {
      try {
        await sendUserWelcomeEmail({
          tenant,
          user: saved,
          temporaryPassword: password,
          language: String(req.body?.inviteLanguage || req.headers['accept-language'] || 'en').startsWith('ar')
            ? 'ar'
            : 'en',
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

// @route   PUT /api/users/:id
// @desc    Update user details and permissions
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

    // Audit log
    await recordUserActivity(req, {
      action: 'update',
      module: 'users',
      resourceType: 'User',
      resourceId: saved._id,
      resourceName: `${saved.firstName} ${saved.lastName} (${saved.email})`,
      description: `Updated user profile and permissions for ${saved.firstName} ${saved.lastName}`,
      descriptionAr: `تم تحديث بيانات وصلاحيات المستخدم ${saved.firstName} ${saved.lastName}`,
      details: { role: saved.role, isActive: saved.isActive, permissionsCount: saved.permissions?.length || 0 },
    });

    res.json(sanitizeUserForClient(saved));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Deactivate user
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

    // Audit log
    await recordUserActivity(req, {
      action: 'delete',
      module: 'users',
      resourceType: 'User',
      resourceId: existing._id,
      resourceName: `${existing.firstName} ${existing.lastName} (${existing.email})`,
      description: `Deactivated user account for ${existing.firstName} ${existing.lastName}`,
      descriptionAr: `تم تعطيل حساب المستخدم ${existing.firstName} ${existing.lastName}`,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
