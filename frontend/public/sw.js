// ─── Self-Destructing Service Worker Migration ────────────────────────────────
// Automatically cleans up any previously registered service worker and caches
// from older builds on user devices, ensuring 100% fresh assets on every deployment.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
        await self.registration.unregister()
        await self.clients.claim()
      } catch (err) {
        console.warn('[SW Migration] Cleanup error:', err)
      }
    })()
  )
})

// Direct pass-through for all requests — never intercept or stale-cache network traffic
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
