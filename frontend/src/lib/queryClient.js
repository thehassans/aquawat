import { QueryClient, keepPreviousData } from '@tanstack/react-query'

const MINUTE = 60 * 1000

/** Per-resource stale times — stats/dashboard change slowly; lists refresh sooner. */
function staleTimeForQuery(queryKey) {
  const root = Array.isArray(queryKey) ? String(queryKey[0] || '') : ''
  if (root.includes('stats') || root === 'dashboard') return 2 * MINUTE
  if (root.includes('settings') || root === 'tenant' || root === 'me') return 10 * MINUTE
  if (root.includes('contacts') || root.includes('products') || root.includes('invoices')) return 90 * 1000
  return 3 * MINUTE
}

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
  },
})

queryClient.setQueryDefaults([], {
  queries: {
    staleTime: (query) => staleTimeForQuery(query.queryKey),
  },
})

export { staleTimeForQuery }
