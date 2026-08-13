import Tenant from '../models/Tenant.js';
import { TRIAL_LIMITS } from '../utils/planEntitlements.js';

export { TRIAL_LIMITS };

/**
 * Map of resource type -> Mongoose model name (for countDocuments).
 * The model is imported lazily to avoid circular dependencies.
 */
const MODEL_MAP = {
  invoices: 'Invoice',
  quotations: 'Quotation',
  customers: 'Customer',
  suppliers: 'Supplier',
  purchaseOrders: 'PurchaseOrder',
  purchaseReturns: 'PurchaseReturn',
  products: 'Product',
  warehouses: 'Warehouse',
  users: 'User',
  projects: 'Project',
  tasks: 'Task',
  employees: 'Employee',
  expenses: 'Expense',
  vouchers: 'Voucher',
  shipments: 'Shipment',
  restaurantOrders: 'RestaurantOrder',
  restaurantMenuItems: 'RestaurantMenuItem',
  restaurantTables: 'RestaurantTable',
  travelBookings: 'TravelBooking',
  rentalCars: 'RentalCar',
  rentalCustomers: 'RentalCustomer',
  saloonServices: 'SaloonService',
  saloonStaff: 'SaloonStaff',
  saloonAppointments: 'SaloonAppointment',
  laundryServices: 'LaundryService',
  laundryCustomers: 'LaundryCustomer',
  laundryInventory: 'LaundryInventory',
  promotions: 'Promotion',
  manpowerTimesheets: 'ManpowerTimesheet',
  khayyatStitchings: 'KhayyatStitching',
};

/**
 * Cache for dynamic model imports to avoid repeated dynamic import() calls.
 */
const modelCache = {};

async function getModel(modelName) {
  if (modelCache[modelName]) return modelCache[modelName];
  try {
    const mod = await import(`../models/${modelName}.js`);
    modelCache[modelName] = mod.default || mod;
    return modelCache[modelName];
  } catch (e) {
    return null;
  }
}

/**
 * Check if a tenant is on trial or demo.
 */
function isTrialTenant(tenant) {
  if (!tenant) return false;
  if (tenant.isDemo === true && !tenant.demoUpgraded) return true;
  if (tenant.subscription?.plan === 'trial') return true;
  return false;
}

/**
 * Middleware factory: checkTrialLimits(resourceType)
 * Usage: router.post('/', checkTrialLimits('invoices'), checkPermission('invoicing', 'create'), handler)
 *
 * If the tenant is on trial/demo, counts existing records and blocks creation if limit is reached.
 * Super admins and non-trial tenants are not affected.
 */
export function checkTrialLimits(resourceType) {
  return async (req, res, next) => {
    try {
      // Super admins bypass
      if (req.user?.role === 'super_admin') return next();

      // Get tenant from req.tenant (set by protect middleware) or fetch
      let tenant = req.tenant;
      if (!tenant && req.user?.tenantId) {
        tenant = await Tenant.findById(req.user.tenantId).lean();
      }
      if (!tenant) return next();

      let limit = TRIAL_LIMITS[resourceType];
      if (isTrialTenant(tenant)) {
        if (!limit) return next();
      } else if (resourceType === 'invoices') {
        limit = Number(tenant.subscription?.maxInvoices) || 0;
        if (!limit) return next();
      } else if (resourceType === 'quotations') {
        limit = Number(tenant.subscription?.maxQuotations) || 0;
        if (!limit) return next();
      } else if (resourceType === 'users') {
        limit = Number(tenant.subscription?.maxUsers) || 0;
        if (!limit) return next();
      } else {
        return next();
      }

      // Get the model and count existing records
      const modelName = MODEL_MAP[resourceType];
      if (!modelName) return next();

      const Model = await getModel(modelName);
      if (!Model) return next();

      const tenantFilter = { tenantId: req.user.tenantId };
      const currentCount = await Model.countDocuments(tenantFilter);

      if (currentCount >= limit) {
        return res.status(403).json({
          error: 'TRIAL_LIMIT_REACHED',
          limitType: resourceType,
          limit,
          current: currentCount,
          message: `Plan limit reached: ${currentCount}/${limit} ${resourceType}. Upgrade to continue.`,
        });
      }

      next();
    } catch (err) {
      // On error, allow the request to proceed (fail open)
      console.error('checkTrialLimits error:', err);
      next();
    }
  };
}

export default { checkTrialLimits, TRIAL_LIMITS };
