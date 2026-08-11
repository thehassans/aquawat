import Tenant from '../models/Tenant.js';
import { AppAddon } from '../models/AppAddon.js';

/**
 * Core apps auto-installed on tenant create.
 * Intentionally empty: new tenants (including trading) start with no App Store
 * modules activated — users install what they need from the App Store.
 */
export const CORE_PROVISIONED_APP_IDS = [];

/**
 * Generates the default installedApps mapping for a new or existing tenant.
 * With an empty core list this returns {} so trading signup stays clean.
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
 * With CORE_PROVISIONED_APP_IDS empty, ensures installedApps exists as {}
 * without activating any modules.
 */
export const provisionTenantApps = async (tenant, options = { overwriteExisting: false, save: true }) => {
  if (!tenant) return null;

  if (!tenant.settings) {
    tenant.settings = {};
  }
  if (!tenant.settings.installedApps || typeof tenant.settings.installedApps !== 'object') {
    tenant.settings.installedApps = {};
  }

  if (CORE_PROVISIONED_APP_IDS.length === 0) {
    return tenant;
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

  if (modified && typeof tenant.markModified === 'function') {
    tenant.markModified('settings.installedApps');
  }

  if (modified && options.save && typeof tenant.save === 'function') {
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
