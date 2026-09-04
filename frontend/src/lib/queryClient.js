import { QueryClient, keepPreviousData } from '@tanstack/react-query'

const MINUTE = 60 * 1000

/** Per-resource stale times — reduce refetch storms on SaaS navigation. */
export function staleTimeForQuery(queryKey) {
  const root = Array.isArray(queryKey) ? String(queryKey[0] || '') : ''
  if (root.includes('stats') || root === 'dashboard' || root === 'apps-overview') return 2 * MINUTE
  if (root.includes('settings') || root === 'tenant' || root === 'me' || root === 'sales-settings') return 10 * MINUTE
  if (
    root.includes('contacts') ||
    root.includes('products') ||
    root.includes('invoices') ||
    root.includes('quotations') ||
    root.includes('warehouses') ||
    root.includes('customers') ||
    root.includes('suppliers')
  ) {
    return 90 * 1000
  }
  if (root.includes('header-email') || root.includes('notifications')) return 55 * 1000
  return 3 * MINUTE
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 3 * MINUTE,
      gcTime: 15 * MINUTE,
      placeholderData: keepPreviousData,
      networkMode: 'online',
      structuralSharing: true,
      retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404) return false
        if (status === 429 || status === 502 || status === 503 || status === 504 || error?.code === 'ECONNABORTED') {
          return failureCount < 3
        }
        return failureCount < 1
      },
      retryDelay: (attemptIndex, error) => {
        const retryAfter = parseInt(error?.response?.headers?.['retry-after'] || '0', 10)
        if (retryAfter > 0) return retryAfter * 1000 + Math.random() * 500
        return Math.min(1000 * 2 ** attemptIndex + Math.random() * 500, 12000)
      },
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
})

// Apply smarter stale times for common resource roots
;[
  ['dashboard', 2 * MINUTE],
  ['stats', 2 * MINUTE],
  ['me', 10 * MINUTE],
  ['tenant', 10 * MINUTE],
  ['settings', 10 * MINUTE],
  ['products', 90 * 1000],
  ['invoices', 90 * 1000],
  ['quotations', 90 * 1000],
  ['customers', 90 * 1000],
  ['warehouses', 90 * 1000],
  ['suppliers', 90 * 1000],
  ['contacts', 90 * 1000],
].forEach(([key, staleTime]) => {
  queryClient.setQueryDefaults([key], { staleTime })
})

export default queryClient
