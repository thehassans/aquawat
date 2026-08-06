/**
 * Background Idle Route Prefetcher.
 * Preloads the most frequently used dashboard and module chunks in the idle background,
 * making subsequent route navigation virtually instant (0ms delay).
 */

const PREFETCH_MAP = {
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

export function preloadCriticalRoutes() {
  if (typeof window === 'undefined') return

  const prefetch = () => {
    const keys = Object.keys(PREFETCH_MAP)
    keys.forEach((key, index) => {
      // Stagger imports slightly to never block the main thread
      setTimeout(() => {
        try {
          PREFETCH_MAP[key]()
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
