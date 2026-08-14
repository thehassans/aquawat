/**
 * App Store entitlement checks shared by Email Marketing, SMS, IoT, and restaurant apps.
 */
import { isAppAccessValid } from './appStoreTrial'

export function tenantHasInstalledApp(tenant, appId) {
  return isAppAccessValid(tenant?.settings?.installedApps?.[appId])
}

export function tenantHasEntitlement(tenant, { appId, flag } = {}) {
  if (flag && tenant?.subscription?.[flag] === true) return true
  if (appId) return tenantHasInstalledApp(tenant, appId)
  return false
}
