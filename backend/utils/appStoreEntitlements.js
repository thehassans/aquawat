/**
 * Maps App Store appIds to the subscription flags still used by
 * requireAddon / legacy page gates. Install and uninstall are the source of truth.
 */

import { isAppAccessValid } from './appTrial.js';

export const APP_ENTITLEMENTS = {
  email_suite: { flags: { hasEmailAddon: true }, feature: 'email_automation' },
  sms_marketing: { flags: { hasSmsAddon: true } },
  iot_devices: { flags: { hasIotAddon: true } },
  weight_scale_driver: { flags: { hasWeightScaleAddon: true } },
  multi_branch: { flags: { hasBranchAddon: true } },
  restaurant_branches: { flags: { hasBranchAddon: true } },
  delivery_platforms: { flags: { hasDeliveryAddon: true } },
  restaurant_mess: { flags: { hasMessAddon: true } },
  restaurant_combos: { flags: { hasCombosAddon: true } },
  qr_menu_ordering: { flags: { hasQrOrderingAddon: true } },
  restaurant_kds: { flags: { hasKdsAddon: true } },
  restaurant_reservations: { flags: { hasReservationsAddon: true } },
};

export const ENTITLEMENT_APP_IDS = Object.keys(APP_ENTITLEMENTS);

const FLAG_TO_APP = Object.fromEntries(
  Object.entries(APP_ENTITLEMENTS).flatMap(([appId, spec]) =>
    Object.keys(spec.flags || {}).map((flag) => [flag, appId])
  )
);

export function isAppInstalled(tenant, appId) {
  return isAppAccessValid(tenant?.settings?.installedApps?.[appId]);
}

export function tenantHasSmsAddon(tenant) {
  if (!tenant) return false;
  if (tenant.subscription?.hasSmsAddon === true) return true;
  return isAppInstalled(tenant, 'sms_marketing');
}

export function applyAppEntitlements(tenant, appId) {
  const spec = APP_ENTITLEMENTS[appId];
  if (!spec) return false;
  if (!tenant.subscription) tenant.subscription = {};
  for (const [key, value] of Object.entries(spec.flags || {})) {
    tenant.subscription[key] = value;
  }
  if (spec.feature) {
    const features = Array.isArray(tenant.subscription.features)
      ? tenant.subscription.features.filter(Boolean)
      : [];
    tenant.subscription.features = [...new Set([...features, spec.feature])];
  }
  tenant.markModified?.('subscription');
  return true;
}

export function revokeAppEntitlements(tenant, appId, { keepDeliveryIfOthersRemain = false } = {}) {
  const spec = APP_ENTITLEMENTS[appId];
  if (!spec) return false;
  if (!tenant.subscription) tenant.subscription = {};

  if (keepDeliveryIfOthersRemain && spec.flags?.hasDeliveryAddon) {
    return false;
  }

  for (const key of Object.keys(spec.flags || {})) {
    tenant.subscription[key] = false;
  }
  if (spec.feature) {
    const features = Array.isArray(tenant.subscription.features) ? tenant.subscription.features : [];
    tenant.subscription.features = features.filter((feature) => feature !== spec.feature);
  }
  tenant.markModified?.('subscription');
  return true;
}

/** Super Admin UI: treat legacy subscription flags as installed until App Store is used. */
export function tenantAppearsToHaveApp(tenant, appId) {
  if (isAppInstalled(tenant, appId)) return true;
  const spec = APP_ENTITLEMENTS[appId];
  if (!spec) return false;
  return Object.keys(spec.flags || {}).some((flag) => tenant?.subscription?.[flag] === true);
}

export function flagToAppId(flag) {
  return FLAG_TO_APP[flag] || null;
}
