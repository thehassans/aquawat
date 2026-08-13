/**
 * Whether the tenant may use Email Marketing APIs.
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

/** Ready to send: enabled, from-address, and SMTP credentials when using custom SMTP. */
export function isEmailMarketingConfigured(email = {}) {
  if (!email?.enabled) return false
  const from = String(email.fromEmail || '').trim()
  if (!from.includes('@')) return false
  if (email.identityType === 'custom_smtp') {
    return Boolean(
      String(email.smtpHost || '').trim()
      && String(email.smtpUser || '').trim()
      && (email.hasSmtpPass || email.smtpPass)
    )
  }
  return true
}
