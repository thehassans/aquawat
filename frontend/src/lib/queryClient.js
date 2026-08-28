import { QueryClient, keepPreviousData } from '@tanstack/react-query'

const MINUTE = 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 3 * MINUTE,
      gcTime: 10 * MINUTE,
      placeholderData: keepPreviousData,
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
        if (retryAfter > 0) return retryAfter * 1000
        return Math.min(1000 * 2 ** attemptIndex, 8000)
      },
    },
    mutations: {
      retry: 0,
    },
  },
})

/** Stats / dashboard — slow-changing aggregates. */
for (const key of [
  'dashboard',
  'contacts-stats',
  'products-stats',
  'invoices-stats',
  'employees-stats',
  'expenses-stats',
  'customers-stats',
  'crm-stats',
  'mrp-stats',
  'purchase-orders-stats',
]) {
  queryClient.setQueryDefaults([key], { staleTime: 2 * MINUTE, gcTime: 15 * MINUTE })
}

/** Reference data — tenant settings, profile. */
for (const key of ['tenant', 'me', 'system-settings']) {
  queryClient.setQueryDefaults([key], { staleTime: 10 * MINUTE, gcTime: 30 * MINUTE })
}

/** High-churn lists — shorter stale window. */
for (const key of ['contacts', 'products', 'invoices', 'employees', 'expenses']) {
  queryClient.setQueryDefaults([key], { staleTime: 90 * 1000, gcTime: 10 * MINUTE })
}
