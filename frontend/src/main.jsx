import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import './index.css'
import { ErrorBoundary } from './lib/errorBoundary'
import { initMaqderPwaInstall } from './lib/pwaInstall'
import { initTelemetryFromServer } from './lib/analytics'

if (typeof window !== 'undefined') {
  initMaqderPwaInstall()
  initTelemetryFromServer()
}

// ─── Self-Healing Deploy & Chunk Load Auto-Recovery ────────────────────────────
// When a new build is deployed on the server, old hashed JS chunks are deleted.
// If a user's browser attempts to fetch a purged chunk, automatically purge
// the stale service worker and CacheStorage, then perform a clean hard reload
// so the user never gets stuck in an infinite loading loop.

export const purgeStaleCachesAndReload = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ''
        if (url.includes('maqder-install-sw')) return Promise.resolve()
        return r.unregister()
      }))
    }
  } catch (err) {
    console.warn('[CachePurge] Warning:', err)
  }
  const target = new URL(window.location.href)
  target.searchParams.set('_v', Date.now().toString())
  window.location.replace(target.toString())
}

const isChunkLoadError = (err) => {
  const msg = String(err?.message || err?.reason || err || '').toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('unexpected token <') ||
    msg.includes('error loading dynamically imported module')
  )
}

window.addEventListener('vite:preloadError', (event) => {
  event?.preventDefault?.()
  const KEY = 'vite-preload-reloaded-ts'
  const lastReload = Number(sessionStorage.getItem(KEY) || 0)
  if (Date.now() - lastReload > 8000) {
    sessionStorage.setItem(KEY, Date.now().toString())
    purgeStaleCachesAndReload()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (isChunkLoadError(reason)) {
    event?.preventDefault?.()
    const KEY = 'chunk-load-retry-ts'
    const lastReload = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - lastReload > 8000) {
      sessionStorage.setItem(KEY, Date.now().toString())
      purgeStaleCachesAndReload()
    }
    return
  }

  // Vite minifies AxiosError → "H" in production. Suppress expected noise.
  const code = reason?.code
  const status = reason?.response?.status
  const isAxiosLike = Boolean(
    reason?.isAxiosError
    || reason?.config
    || reason?.response
    || code === 'ERR_NETWORK'
    || code === 'ERR_CANCELED'
    || code === 'ECONNABORTED',
  )
  if (isAxiosLike) {
    // Cancelled queries / aborted requests are normal with React Query
    if (code === 'ERR_CANCELED' || reason?.name === 'CanceledError' || reason?.name === 'AbortError') {
      event?.preventDefault?.()
      return
    }
    // Auth cascade after token clear — many in-flight GETs reject together
    if (status === 401) {
      event?.preventDefault?.()
      return
    }
    event?.preventDefault?.()
    const method = String(reason?.config?.method || 'get').toUpperCase()
    const url = reason?.config?.url || ''
    const msg = reason?.userMessage || reason?.message || 'Request failed'
    console.warn(`[API] ${status || code || 'error'} ${method} ${url} — ${msg}`)
  }
})

const isDesktop = import.meta.env.VITE_IS_DESKTOP === 'true'
const Router = isDesktop ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                borderRadius: '12px',
                padding: '16px',
              },
              success: {
                iconTheme: { primary: '#14b8a6', secondary: '#f1f5f9' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' },
              },
            }}
          />
        </Router>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
)
