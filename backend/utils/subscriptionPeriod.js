/**
 * Subscription period helpers. Monthly/yearly use calendar units so a
 * renewal of 5 Oct extends to 5 Nov (or 5 Oct next year), not a 30-day drift.
 * End-of-month days clamp (31 Aug → 30 Sep, not 1 Oct).
 */

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

/** Stack N billing cycles from a base date. */
export function addBillingCycles(fromDate, billingCycle = 'monthly', cycles = 1) {
  const count = Math.max(0, Math.min(36, Number(cycles) || 0))
  let end = fromDate instanceof Date ? new Date(fromDate) : new Date(fromDate)
  if (Number.isNaN(end.getTime())) end = new Date()
  for (let i = 0; i < count; i += 1) {
    end = addBillingCycle(end, billingCycle)
  }
  return end
}

/** Stack a new cycle onto remaining time when the current end is still in the future. */
export function nextSubscriptionEndDate(currentEndDate, billingCycle = 'monthly', now = new Date()) {
  const current = currentEndDate ? new Date(currentEndDate) : null
  const currentValid = current && !Number.isNaN(current.getTime())
  const base = currentValid && current.getTime() > now.getTime() ? current : now
  return addBillingCycle(base, billingCycle)
}

export function isPaidPlanId(plan) {
  const p = String(plan || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return ['starter', 'basic', 'professional', 'pro', 'enterprise', 'ultra_premium', 'ultrapremium', 'ultra'].includes(p)
}
