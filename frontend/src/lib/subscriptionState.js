/**
 * Shared subscription / trial gate helpers for Profile, badge, and banners.
 */

export function getSubscriptionState(tenant) {
  const sub = tenant?.subscription || {}
  const plan = String(sub.plan || 'trial').toLowerCase()
  const status = String(sub.status || '').toLowerCase()
  const isDemoPending = tenant?.isDemo === true && tenant?.demoUpgraded !== true
  const isTrialPlan = plan === 'trial' || isDemoPending

  const endRaw = tenant?.demoTrialEndsAt || sub.endDate || null
  const endMs = endRaw ? new Date(endRaw).getTime() : NaN
  const hasEnd = Number.isFinite(endMs)

  let daysLeft = null
  if (hasEnd) {
    daysLeft = Math.max(0, Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24)))
  }

  const dateExpired = hasEnd && endMs < Date.now()
  const statusExpired = ['expired', 'cancelled', 'inactive', 'terminated'].includes(status)
  const isExpired = dateExpired || statusExpired || (hasEnd && daysLeft === 0 && endMs <= Date.now())
  const isTrialEnded = Boolean(isTrialPlan && isExpired)
  const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 7
  const isActive = !isExpired && (status === 'active' || (isTrialPlan && !isExpired) || (!status && !isExpired))

  return {
    plan,
    status,
    startDate: sub.startDate || null,
    endDate: endRaw,
    billingCycle: sub.billingCycle || 'monthly',
    maxUsers: sub.maxUsers || 5,
    isDemoPending,
    isTrialPlan,
    isExpired,
    isTrialEnded,
    isExpiringSoon,
    isActive,
    daysLeft,
  }
}

export function formatSubscriptionDate(dateString, language = 'en') {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getPlanDisplayName(plan, language = 'en') {
  const isAr = language === 'ar'
  switch (String(plan || 'trial').toLowerCase()) {
    case 'starter':
      return isAr ? 'الباقة الأساسية' : 'Starter Plan'
    case 'professional':
      return isAr ? 'الباقة الاحترافية' : 'Professional Plan'
    case 'enterprise':
      return isAr ? 'ألترا بريميوم' : 'Ultra Premium Plan'
    case 'trial':
    default:
      return isAr ? 'الباقة التجريبية' : 'Trial Plan'
  }
}

export function getPlanShortName(plan, language = 'en') {
  const isAr = language === 'ar'
  switch (String(plan || 'trial').toLowerCase()) {
    case 'starter':
      return isAr ? 'الأساسية' : 'Starter'
    case 'professional':
      return isAr ? 'الاحترافية' : 'Professional'
    case 'enterprise':
      return isAr ? 'ألترا بريميوم' : 'Ultra Premium'
    case 'trial':
    default:
      return isAr ? 'تجريبية' : 'Trial'
  }
}

export function humanizeAppId(appId = '') {
  return String(appId)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
