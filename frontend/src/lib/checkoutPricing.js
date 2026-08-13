/**
 * Platform SaaS checkout list prices are set independently per currency
 * in Super Admin (e.g. 29.99 USD and 49.99 SAR) — never derive one from the other via FX.
 */

import { getTenantCurrency } from './saudiTenant'

/** Default display currency when the tenant is not SAR. */
export const CHECKOUT_CURRENCY = 'USD'

/** ZATCA Phase 2 addon — clean dual list prices */
export const ZATCA_ADDON = {
  USD: { monthly: 14.99, yearly: 149.99 },
  SAR: { monthly: 49.99, yearly: 499.99 },
}

/** List-price lane: SAR for SAR tenants, USD otherwise. No FX between the two. */
export function resolveCheckoutLane(tenant) {
  return getTenantCurrency(tenant) === 'SAR' ? 'SAR' : 'USD'
}

export function resolvePlanPrice(plan, billingCycle = 'monthly', currency = 'USD') {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const code = String(currency || 'USD').toUpperCase()
  if (code === 'USD') {
    const v = cycle === 'yearly'
      ? Number(plan?.priceYearlyUsd ?? plan?.priceYearly)
      : Number(plan?.priceMonthlyUsd ?? plan?.priceMonthly)
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
  }
  const v = cycle === 'yearly'
    ? Number(plan?.priceYearlySar ?? plan?.priceYearly)
    : Number(plan?.priceMonthlySar ?? plan?.priceMonthly)
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
}

export function zatcaAddonAmount(billingCycle = 'monthly', currency = 'USD') {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const code = String(currency || 'USD').toUpperCase()
  const table = ZATCA_ADDON[code] || ZATCA_ADDON.USD
  return table[cycle]
}

export function isZatcaFeatureText(text = '') {
  return /zatca|زكاة|فاتورة المرحلة|gosi\/wps/i.test(String(text))
}

/** Normalize CMS / fallback plan into dual-currency list prices. */
export function normalizeCheckoutPlan(plan, fallback = {}, displayCurrency = 'USD') {
  const merged = { ...fallback, ...plan }
  const id = merged.id || fallback.id || 'starter'
  const monthlyUsd = Number(merged.priceMonthlyUsd ?? fallback.priceMonthlyUsd)
  const yearlyUsd = Number(merged.priceYearlyUsd ?? fallback.priceYearlyUsd)
  const monthlySar = Number(merged.priceMonthlySar ?? merged.priceMonthly ?? fallback.priceMonthlySar ?? fallback.priceMonthly)
  const yearlySar = Number(merged.priceYearlySar ?? merged.priceYearly ?? fallback.priceYearlySar ?? fallback.priceYearly)

  // Defaults when Super Admin has not set dual prices yet
  const defaults = {
    starter: { monthlyUsd: 29.99, yearlyUsd: 299.99, monthlySar: 49.99, yearlySar: 499.99 },
    professional: { monthlyUsd: 59.99, yearlyUsd: 599.99, monthlySar: 99.99, yearlySar: 999.99 },
    enterprise: { monthlyUsd: 0, yearlyUsd: 0, monthlySar: 0, yearlySar: 0 },
  }[id] || { monthlyUsd: 29.99, yearlyUsd: 299.99, monthlySar: 49.99, yearlySar: 499.99 }

  const hasUsd = Number.isFinite(monthlyUsd) && (merged.priceMonthlyUsd != null || fallback.priceMonthlyUsd != null)
  const hasSar = Number.isFinite(monthlySar)

  const priceMonthlyUsd = hasUsd ? monthlyUsd : defaults.monthlyUsd
  const priceYearlyUsd = Number.isFinite(yearlyUsd) && (merged.priceYearlyUsd != null || fallback.priceYearlyUsd != null)
    ? yearlyUsd
    : defaults.yearlyUsd
  const priceMonthlySar = hasSar ? monthlySar : defaults.monthlySar
  const priceYearlySar = Number.isFinite(yearlySar) ? yearlySar : defaults.yearlySar
  const lane = String(displayCurrency || 'USD').toUpperCase() === 'SAR' ? 'SAR' : 'USD'

  return {
    ...merged,
    priceMonthlyUsd,
    priceYearlyUsd,
    priceMonthlySar,
    priceYearlySar,
    priceMonthly: lane === 'SAR' ? priceMonthlySar : priceMonthlyUsd,
    priceYearly: lane === 'SAR' ? priceYearlySar : priceYearlyUsd,
  }
}
