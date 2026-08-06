import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import './index.css'
import { ErrorBoundary } from './lib/errorBoundary'

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
      await Promise.all(registrations.map((r) => r.unregister()))
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
  if (isChunkLoadError(event.reason)) {
    event?.preventDefault?.()
    const KEY = 'chunk-load-retry-ts'
    const lastReload = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - lastReload > 8000) {
      sessionStorage.setItem(KEY, Date.now().toString())
      purgeStaleCachesAndReload()
    }
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.response?.status === 429) return false
        return failureCount < 1
      },
      staleTime: 5 * 60 * 1000,
    },
  },
})

const isDesktop = import.meta.env.VITE_IS_DESKTOP === 'true'
const Router = isDesktop ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary fallbackMessage="Something went wrong while loading the app. Please reload the page.">
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
