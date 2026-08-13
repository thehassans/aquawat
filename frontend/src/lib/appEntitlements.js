/**
 * App Store entitlement checks shared by Email Marketing, SMS, IoT, and restaurant apps.
 */
export function tenantHasInstalledApp(tenant, appId) {
  const app = tenant?.settings?.installedApps?.[appId]
  return app?.isInstalled === true && app?.isEnabled !== false
}

export function tenantHasEntitlement(tenant, { appId, flag } = {}) {
  if (flag && tenant?.subscription?.[flag] === true) return true
  if (appId) return tenantHasInstalledApp(tenant, appId)
  return false
}
