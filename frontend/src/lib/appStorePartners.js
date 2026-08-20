import { isAppAccessValid } from './appStoreTrial'

export const DELIVERY_APP_IDS = [
  'delivery_platforms',
  'hungerstation_delivery',
  'jahez_delivery',
  'keeta_delivery',
  'mrsool_delivery',
  'ninja_delivery',
  'toyou_delivery',
  'jumlaty_delivery',
]

export const COURIER_APP_IDS = [
  'multicourier_shipping',
  'smsa_express',
  'aramex_shipping',
  'jnt_express',
  'naqel_express',
  'imile_courier',
  'spl_saudi_post',
  'fedex_shipping',
  'dhl_express',
  'ups_shipping',
  'tnt_express',
]

export const BNPL_APP_IDS = [
  'tabby_bnpl',
  'tamara_bnpl',
]

export function tenantHasInstalledApp(tenant, appIds = []) {
  const apps = tenant?.settings?.installedApps || {}
  return appIds.some((id) => isAppAccessValid(apps[id]))
}

export function tenantHasDeliveryAccess(tenant) {
  if (tenant?.subscription?.hasDeliveryAddon) return true
  return tenantHasInstalledApp(tenant, DELIVERY_APP_IDS)
}

export function isAppGateOpen(tenant, { requireApp, requireAnyApp } = {}) {
  const apps = tenant?.settings?.installedApps || {}
  const isOn = (id) => isAppAccessValid(apps[id])
  if (Array.isArray(requireAnyApp) && requireAnyApp.length) return requireAnyApp.some(isOn)
  if (requireApp) return isOn(requireApp)
  return true
}

/** Sidebar/launcher unlock: vertical business type grant, or an installed App Store app. */
export function isNavItemAppVisible(tenant, businessTypes = [], item = {}) {
  const grantTypes = Array.isArray(item.grantBusinessTypes)
    ? item.grantBusinessTypes
    : Array.isArray(item.businessTypes)
    ? item.businessTypes
    : []
  const hasAppReq = Boolean(item.requireApp) || (Array.isArray(item.requireAnyApp) && item.requireAnyApp.length > 0)
  if (!grantTypes.length && !hasAppReq) return true
  if (grantTypes.some((type) => businessTypes.includes(type))) return true
  if (hasAppReq) return isAppGateOpen(tenant, item)
  return false
}
