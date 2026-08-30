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
  quotationNew: () => import('../pages/quotations/QuotationCreatePage'),
  settings: () => import('../pages/Settings'),
  users: () => import('../pages/Users'),
  reports: () => import('../pages/Reports'),
  profile: () => import('../pages/Profile'),
  sales: () => import('../pages/sales/SalesHomePage'),
  salesOrders: () => import('../pages/sales/SalesOrdersPage'),
  inventory: () => import('../pages/inventory/InventoryOverview'),
  products: () => import('../pages/inventory/Products'),
  warehouses: () => import('../pages/inventory/Warehouses'),
  purchases: () => import('../pages/purchases/PurchasesOverview'),
  purchaseOrders: () => import('../pages/PurchaseOrders'),
  grn: () => import('../pages/purchases/GrnList'),
  customers: () => import('../pages/customers/CustomerList'),
  accounting: () => import('../pages/accounting/Accounting'),
}

function resolvePrefetchKeys(tenant) {
  const types = getTenantBusinessTypes(tenant)
  const keys = ['dashboard', 'invoices', 'settings', 'profile', 'customers']

  if (types.some((t) => ['trading', 'bakala', 'pharmacy', 'grocery', 'furniture_shop'].includes(t))) {
    keys.push(
      'invoiceSell',
      'quotations',
      'quotationNew',
      'reports',
      'sales',
      'salesOrders',
      'inventory',
      'products',
      'warehouses',
      'purchases',
      'purchaseOrders',
      'grn',
      'accounting'
    )
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
        Promise.resolve()
          .then(() => loader())
          .catch(() => {
            // Ignore prefetch failures — never surface as unhandledrejection
          })
      }, index * 180)
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(prefetch, { timeout: 4000 })
  } else {
    setTimeout(prefetch, 800)
  }
}

/** Prefetch a single known module key (e.g. hover intent). */
export function prefetchRouteKey(key) {
  const loader = ROUTE_IMPORTS[key]
  if (!loader) return
  Promise.resolve()
    .then(() => loader())
    .catch(() => {})
}
