/**
 * Subscription period helpers. Monthly/yearly use calendar units so a
 * renewal of 5 Oct extends to 5 Nov (or 5 Oct next year), not a 30-day drift.
 */

export function addBillingCycle(fromDate, billingCycle = 'monthly') {
  const d = new Date(fromDate)
  if (Number.isNaN(d.getTime())) return new Date()
  if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
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
