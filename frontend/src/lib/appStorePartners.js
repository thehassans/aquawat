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
  return appIds.some((id) => apps[id]?.isInstalled && apps[id]?.isEnabled !== false)
}

export function tenantHasDeliveryAccess(tenant) {
  if (tenant?.subscription?.hasDeliveryAddon) return true
  return tenantHasInstalledApp(tenant, DELIVERY_APP_IDS)
}

export function isAppGateOpen(tenant, { requireApp, requireAnyApp } = {}) {
  const apps = tenant?.settings?.installedApps || {}
  const isOn = (id) => Boolean(apps[id]?.isInstalled && apps[id]?.isEnabled !== false)
  if (Array.isArray(requireAnyApp) && requireAnyApp.length) return requireAnyApp.some(isOn)
  if (requireApp) return isOn(requireApp)
  return true
}
