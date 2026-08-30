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

export function parseCalendarDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
  }
  const raw = String(value).trim()
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (isoDay) {
    return new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]), 12, 0, 0, 0)
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0)
}

/** Display dates as "25 12 2026" (dd mm yyyy). */
export function formatSubscriptionDate(dateString, language = 'en') {
  const d = parseCalendarDate(dateString)
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  // language kept for API compatibility; format is always numeric day-month-year
  void language
  return `${dd} ${mm} ${yyyy}`
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
  const source = fromDate instanceof Date ? fromDate : new Date(fromDate)
  if (Number.isNaN(source.getTime())) return new Date()

  const year = source.getFullYear()
  const month = source.getMonth()
  const day = source.getDate()
  const hours = source.getHours()
  const minutes = source.getMinutes()
  const seconds = source.getSeconds()
  const ms = source.getMilliseconds()

  let targetYear = year
  let targetMonth = month
  if (billingCycle === 'yearly') targetYear += 1
  else targetMonth += 1

  targetYear += Math.floor(targetMonth / 12)
  targetMonth = ((targetMonth % 12) + 12) % 12

  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const targetDay = Math.min(day, lastDay)
  return new Date(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms)
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
