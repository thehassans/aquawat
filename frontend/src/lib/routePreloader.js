/**
 * Background Idle Route Prefetcher.
 * Preloads frequently used dashboard and module chunks during idle time,
 * scoped to the tenant's installed business types.
 */

import { getTenantBusinessTypes } from './businessTypes'

const ROUTE_IMPORTS = {
  dashboard: () => import('../pages/Dashboard'),
  invoices: () => import('../pages/invoices/Invoices'),
  invoiceSell: () => import('../pages/invoices/InvoiceCreateSellPage'),
  pos: () => import('../pages/bakala/BakalaPOS'),
  quotations: () => import('../pages/quotations/Quotations'),
  settings: () => import('../pages/Settings'),
  users: () => import('../pages/Users'),
  reports: () => import('../pages/Reports'),
  profile: () => import('../pages/Profile'),
}

function resolvePrefetchKeys(tenant) {
  const types = getTenantBusinessTypes(tenant)
  const keys = ['dashboard', 'invoices', 'settings', 'profile']

  if (types.some((t) => ['trading', 'bakala', 'pharmacy', 'grocery'].includes(t))) {
    keys.push('invoiceSell', 'quotations', 'reports')
  }
  if (types.some((t) => ['bakala', 'pharmacy', 'grocery'].includes(t))) {
    keys.push('pos')
  }
  if (types.includes('trading')) {
    keys.push('users')
  }

  return [...new Set(keys)]
}

export function preloadCriticalRoutes(tenant) {
  if (typeof window === 'undefined') return

  const keys = resolvePrefetchKeys(tenant)

  const prefetch = () => {
    keys.forEach((key, index) => {
      const loader = ROUTE_IMPORTS[key]
      if (!loader) return
      setTimeout(() => {
        try {
          loader()
        } catch {
          // Ignore prefetch failures safely
        }
      }, index * 250)
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetch, { timeout: 3000 })
  } else {
    setTimeout(prefetch, 1000)
  }
}
