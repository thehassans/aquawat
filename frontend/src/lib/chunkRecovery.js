/**
 * Shared deploy/chunk recovery — one key, one matcher, one purge path.
 * Prevents competing handlers from flashing “Sorry for the error” then hard-reloading.
 */

export const CHUNK_RETRY_KEY = 'maqder_chunk_reload'
const CHUNK_RETRY_COOLDOWN_MS = 8000

export function isChunkLoadError(error) {
  const msg = String(error?.message || error?.name || error?.reason?.message || error || '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('failed to load module script') ||
    (msg.includes('unexpected token') && (msg.includes('<') || msg.includes('<!')))
  )
}

export function canAttemptChunkRecovery() {
  if (typeof sessionStorage === 'undefined') return false
  const last = Number(sessionStorage.getItem(CHUNK_RETRY_KEY) || 0)
  return Date.now() - last > CHUNK_RETRY_COOLDOWN_MS
}

export function markChunkRecoveryAttempt() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(CHUNK_RETRY_KEY, String(Date.now()))
}

export async function purgeStaleCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations.map((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
          if (url.includes('maqder-install-sw')) return Promise.resolve()
          return r.unregister()
        })
      )
    }
  } catch (err) {
    console.warn('[ChunkRecovery] Cache purge warning:', err)
  }
  const target = new URL(window.location.href)
  target.searchParams.set('_v', Date.now().toString())
  window.location.replace(target.toString())
}

/** Returns true if a recovery reload was scheduled. */
export function tryRecoverFromChunkError() {
  if (!canAttemptChunkRecovery()) return false
  markChunkRecoveryAttempt()
  void purgeStaleCachesAndReload()
  return true
}
