import Tenant from '../models/Tenant.js';
import { AppAddon } from '../models/AppAddon.js';

/**
 * List of core/free apps that are pre-provisioned for tenants.
 */
export const CORE_PROVISIONED_APP_IDS = [
  'manufacturing_mes',
  'fleet_machinery',
  'landed_costs',
  'iot_devices',
  'crm_sales_pipeline',
  'hr_payroll_pro',
  'delivery_platforms',
  'payment_terminal',
  'zatca_phase2_pro',
  'thermal_printer_driver',
  'weight_scale_driver',
  'whatsapp_cloud_auto',
  'ai_copilot_insights',
  'gosi_mudad_compliance',
  'multicourier_shipping'
];

/**
 * Generates the default installedApps mapping for a new or existing tenant.
 */
export const getDefaultInstalledApps = (businessTypes = []) => {
  const defaultMap = {};
  const now = new Date();

  CORE_PROVISIONED_APP_IDS.forEach((appId) => {
    defaultMap[appId] = {
      isInstalled: true,
      isEnabled: true,
      installedAt: now,
      config: {}
    };
  });

  return defaultMap;
};

/**
 * Provisions core apps for a single tenant document.
 * Preserves existing configs and explicit enablement choices while guaranteeing
 * all mandatory/core apps are installed.
 */
export const provisionTenantApps = async (tenant, options = { overwriteExisting: false, save: true }) => {
  if (!tenant) return null;

  if (!tenant.settings) {
    tenant.settings = {};
  }
  if (!tenant.settings.installedApps || typeof tenant.settings.installedApps !== 'object') {
    tenant.settings.installedApps = {};
  }

  const currentApps = { ...tenant.settings.installedApps };
  const baseTime = tenant.createdAt || new Date();
  let modified = false;

  for (const appId of CORE_PROVISIONED_APP_IDS) {
    if (!currentApps[appId] || options.overwriteExisting) {
      currentApps[appId] = {
        isInstalled: true,
        isEnabled: true,
        installedAt: currentApps[appId]?.installedAt || baseTime,
        config: currentApps[appId]?.config || {}
      };
      modified = true;
    } else {
      // Ensure it is flagged as installed if it exists
      if (currentApps[appId].isInstalled === undefined) {
        currentApps[appId].isInstalled = true;
        modified = true;
      }
      if (currentApps[appId].isEnabled === undefined) {
        currentApps[appId].isEnabled = true;
        modified = true;
      }
    }
  }

  tenant.settings.installedApps = currentApps;

  if (typeof tenant.markModified === 'function') {
    tenant.markModified('settings.installedApps');
  }

  if (options.save && typeof tenant.save === 'function') {
    await tenant.save();
  }

  return tenant;
};

/**
 * Batch provisions all existing tenants in the database.
 */
export const provisionAllTenants = async (options = { overwriteExisting: false }) => {
  const tenants = await Tenant.find({});
  const results = {
    total: tenants.length,
    provisioned: 0,
    failed: 0,
    errors: []
  };

  for (const tenant of tenants) {
    try {
      await provisionTenantApps(tenant, { overwriteExisting: options.overwriteExisting, save: true });
      results.provisioned += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ tenantId: tenant._id, slug: tenant.slug, error: err.message });
    }
  }

  return results;
};
