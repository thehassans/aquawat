import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import './index.css'
import { ErrorBoundary } from './lib/errorBoundary'
import { queryClient } from './lib/queryClient'
import {
  isChunkLoadError,
  tryRecoverFromChunkError,
} from './lib/chunkRecovery'
import { initMaqderPwaInstall } from './lib/pwaInstall'
import { initTelemetryFromServer } from './lib/analytics'
import { SalesSettingsProvider } from './context/SalesSettingsContext'

if (typeof window !== 'undefined') {
  initMaqderPwaInstall()
  initTelemetryFromServer()
}

window.addEventListener('vite:preloadError', (event) => {
  event?.preventDefault?.()
  tryRecoverFromChunkError()
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (isChunkLoadError(reason)) {
    event?.preventDefault?.()
    tryRecoverFromChunkError()
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
    if (code === 'ERR_CANCELED' || reason?.name === 'CanceledError' || reason?.name === 'AbortError') {
      event?.preventDefault?.()
      return
    }
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
            <SalesSettingsProvider>
              <App />
            </SalesSettingsProvider>
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
