import { lazy } from 'react'
import { isChunkLoadError } from './chunkRecovery'

/**
 * Soft-retry failed route chunks before bubbling to ErrorBoundary.
 * Keeps Suspense/PageLoader visible instead of flashing “Sorry for the error”.
 */
export async function importWithRetry(factory, { retries = 2, delayMs = 350 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await factory()
    } catch (err) {
      lastError = err
      if (attempt >= retries || !isChunkLoadError(err)) throw err
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
  throw lastError
}

export function lazyRetry(factory, options) {
  return lazy(() => importWithRetry(factory, options))
}

export default lazyRetry
