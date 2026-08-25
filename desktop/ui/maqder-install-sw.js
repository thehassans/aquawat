/** Minimal installability SW — no caching (avoids stale-chunk issues). */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Chromium needs a fetch listener for installability, but must NOT break
// navigations when the network request fails (uncaught rejection → white screen).
self.addEventListener('fetch', (event) => {
  // Let the browser handle document navigations itself.
  if (event.request.mode === 'navigate') return

  event.respondWith(
    fetch(event.request).catch(() => new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    }))
  )
})
