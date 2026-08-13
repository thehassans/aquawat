const seenKey = (tenantId) => `maqder_welcome_seen_${String(tenantId || '')}`

export function shouldShowDemoWelcome(tenant) {
  if (!tenant?._id) return false
  if (tenant.isDemo !== true || tenant.demoUpgraded === true) return false
  try {
    return localStorage.getItem(seenKey(tenant._id)) !== '1'
  } catch {
    return true
  }
}

export function markDemoWelcomeSeen(tenantId) {
  if (!tenantId) return
  try {
    localStorage.setItem(seenKey(tenantId), '1')
  } catch {
    /* ignore quota / private mode */
  }
}
