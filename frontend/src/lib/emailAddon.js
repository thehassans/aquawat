/**
 * Whether the tenant may use Email Suite / email automation APIs.
 * Mirrors backend middleware tenantHasEmailAddon.
 */
export function tenantHasEmailAddon(tenant) {
  if (!tenant) return false
  if (tenant.subscription?.hasEmailAddon === true) return true
  const features = Array.isArray(tenant.subscription?.features) ? tenant.subscription.features : []
  if (features.includes('email_automation')) return true
  const emailApp = tenant.settings?.installedApps?.email_suite
  return emailApp?.isInstalled === true && emailApp?.isEnabled !== false
}
