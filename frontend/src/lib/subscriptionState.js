/**
 * Shared subscription / trial gate helpers for Profile, badge, and banners.
 */

export function normalizePlanId(plan) {
  const raw = String(plan || 'trial').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (['enterprise', 'ultra_premium', 'ultrapremium', 'ultra'].includes(raw)) return 'enterprise'
  if (['professional', 'pro'].includes(raw)) return 'professional'
  if (['starter', 'basic'].includes(raw)) return 'starter'
  if (['trial', 'demo'].includes(raw)) return 'trial'
  return raw || 'trial'
}

export function getSubscriptionState(tenant) {
  const sub = tenant?.subscription || {}
  const plan = normalizePlanId(sub.plan || 'trial')
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
  const statusExpired = ['expired', 'cancelled', 'inactive', 'terminated', 'trial_ended'].includes(status)
  const isExpired = dateExpired || statusExpired || (hasEnd && daysLeft === 0 && endMs <= Date.now())
  const isTrialEnded = Boolean((isTrialPlan && isExpired) || status === 'trial_ended')
  const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 7
  const isActive = !isExpired && (status === 'active' || (isTrialPlan && !isExpired) || (!status && !isExpired))

  return {
    plan,
    status,
    startDate: sub.startDate || null,
    endDate: endRaw,
    billingCycle: sub.billingCycle || 'monthly',
    maxUsers: sub.maxUsers || 1,
    maxInvoices: sub.maxInvoices || 10,
    maxQuotations: sub.maxQuotations || 10,
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
  switch (normalizePlanId(plan)) {
    case 'starter':
      return isAr ? 'الباقة الأساسية' : 'Starter Plan'
    case 'professional':
      return isAr ? 'الباقة الاحترافية' : 'Professional Plan'
    case 'enterprise':
      return isAr ? 'باقة المؤسسات' : 'Enterprise Plan'
    case 'trial':
    default:
      return isAr ? 'الباقة التجريبية' : 'Trial Plan'
  }
}

export function addBillingCycle(fromDate, billingCycle = 'monthly') {
  const d = new Date(fromDate)
  if (Number.isNaN(d.getTime())) return new Date()
  if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

/** Stack a new cycle onto remaining time when the current end is still in the future. */
export function previewRenewedEndDate(currentEndDate, billingCycle = 'monthly') {
  const now = new Date()
  const current = currentEndDate ? new Date(currentEndDate) : null
  const currentValid = current && !Number.isNaN(current.getTime())
  const base = currentValid && current.getTime() > now.getTime() ? current : now
  return addBillingCycle(base, billingCycle)
}

export function isPaidPlanId(plan) {
  const p = normalizePlanId(plan)
  return p === 'starter' || p === 'professional' || p === 'enterprise'
}

export function getPlanShortName(plan, language = 'en') {
  const isAr = language === 'ar'
  switch (normalizePlanId(plan)) {
    case 'starter':
      return isAr ? 'الأساسية' : 'Starter'
    case 'professional':
      return isAr ? 'الاحترافية' : 'Professional'
    case 'enterprise':
      return isAr ? 'المؤسسات' : 'Enterprise'
    case 'trial':
    default:
      return isAr ? 'تجريبية' : 'Trial'
  }
}

/** Display limits that match backend trial + paid entitlements. */
export const TRIAL_DISPLAY_LIMITS = {
  users: 1,
  invoices: 10,
  quotations: 10,
}

export const PLAN_DISPLAY_LIMITS = {
  trial: { monthly: TRIAL_DISPLAY_LIMITS, yearly: TRIAL_DISPLAY_LIMITS },
  starter: {
    monthly: { users: 1, invoices: 50, quotations: 50 },
    yearly: { users: 1, invoices: 500, quotations: 500 },
  },
  professional: {
    monthly: { users: 3, invoices: 100, quotations: 100 },
    yearly: { users: 3, invoices: 1000, quotations: 1000 },
  },
  enterprise: {
    monthly: { users: 0, invoices: 0, quotations: 0 },
    yearly: { users: 0, invoices: 0, quotations: 0 },
  },
}

export function formatPlanLimit(value, language = 'en') {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return language === 'ar' ? 'غير محدود' : 'Unlimited'
  return String(n)
}

export function getPlanLimits(tenant) {
  const state = getSubscriptionState(tenant)
  if (state.isTrialPlan) return { ...TRIAL_DISPLAY_LIMITS }

  const sub = tenant?.subscription || {}
  const cycle = state.billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const catalog = PLAN_DISPLAY_LIMITS[state.plan]?.[cycle] || PLAN_DISPLAY_LIMITS.starter.monthly

  const users = Number(sub.maxUsers)
  const invoices = Number(sub.maxInvoices)
  const quotations = Number(sub.maxQuotations)

  return {
    users: Number.isFinite(users) && users > 0 ? users : catalog.users,
    invoices: Number.isFinite(invoices) && invoices > 0 ? invoices : catalog.invoices,
    quotations: Number.isFinite(quotations) && quotations > 0 ? quotations : catalog.quotations,
  }
}

export function humanizeAppId(appId = '') {
  return String(appId)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
