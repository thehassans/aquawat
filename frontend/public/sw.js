const STATIC_CACHE = 'maqder-static-v1'
const STATIC_PREFIXES = ['/assets/', '/fonts/', '/icons/']

const isStaticAsset = (url) => {
  try {
    const path = new URL(url, self.location.origin).pathname
    if (STATIC_PREFIXES.some((p) => path.startsWith(p))) return true
    return /\.(woff2?|ttf|eot|png|jpe?g|gif|svg|ico|webp)$/i.test(path)
  } catch {
    return false
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(STATIC_CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = request.url
  if (url.includes('/api/') || url.includes('/uploads/')) return

  if (!isStaticAsset(url)) {
    event.respondWith(fetch(request))
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        cache.put(request, response.clone()).catch(() => {})
      }
      return response
    })(),
  )
})
