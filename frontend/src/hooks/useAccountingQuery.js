import { useQuery } from '@tanstack/react-query'

const isRateLimited = (error) => error?.response?.status === 429

/**
 * React Query wrapper for accounting reads.
 * Retries 429 with backoff; surfaces other errors (no silent empty / 0.00).
 */
export function useAccountingQuery(options = {}) {
  const {
    retry: userRetry,
    retryDelay: userRetryDelay,
    ...rest
  } = options

  return useQuery({
    ...rest,
    retry: (failureCount, error) => {
      if (typeof userRetry === 'function') return userRetry(failureCount, error)
      if (typeof userRetry === 'number') {
        if (isRateLimited(error)) return failureCount < Math.max(userRetry, 3)
        return failureCount < userRetry
      }
      if (isRateLimited(error)) return failureCount < 4
      return failureCount < 1
    },
    retryDelay: (attemptIndex, error) => {
      if (typeof userRetryDelay === 'function') return userRetryDelay(attemptIndex, error)
      if (typeof userRetryDelay === 'number') return userRetryDelay
      if (isRateLimited(error)) {
        const fromBody = Number(error?.response?.data?.retryAfterSeconds)
        const fromHeader = parseInt(error?.response?.headers?.['retry-after'] || '0', 10)
        const seconds = (Number.isFinite(fromBody) && fromBody > 0)
          ? fromBody
          : (fromHeader > 0 ? fromHeader : Math.min(2 ** attemptIndex, 12))
        return seconds * 1000 + Math.floor(Math.random() * 300)
      }
      return Math.min(1000 * 2 ** attemptIndex, 8000)
    },
  })
}

export default useAccountingQuery
