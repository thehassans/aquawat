import { Component } from 'react'

const isChunkLoadError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('unexpected token <') ||
    msg.includes('error loading dynamically imported module')
  )
}

const purgeAndReload = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch (err) {
    console.warn('[ErrorBoundary] Cache purge warning:', err)
  }
  const target = new URL(window.location.href)
  target.searchParams.set('_v', Date.now().toString())
  window.location.replace(target.toString())
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, recovering: false }
  }

  static getDerivedStateFromError(error) {
    if (isChunkLoadError(error)) {
      const lastRetry = Number(sessionStorage.getItem('chunk-error-retry-ts') || 0)
      if (Date.now() - lastRetry > 8000) {
        sessionStorage.setItem('chunk-error-retry-ts', Date.now().toString())
        // Keep a visible loader while purge+reload runs — never return hasError:false
        // (that remounts broken children and leaves #root blank until refresh).
        purgeAndReload()
        return { hasError: true, error: null, recovering: true }
      }
    }
    return { hasError: true, error, recovering: false }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    if (window.__ERROR_TRACKING_ENABLED__ && window.__captureError__) {
      window.__captureError__(error, { componentStack: errorInfo.componentStack })
    }
  }

  render() {
    if (this.state.recovering) {
      return (
        <div className="min-h-screen bg-[#1a3d28] flex items-center justify-center px-4">
          <div className="text-center flex flex-col items-center gap-5">
            <img src="/maqdernewlogo.webp" alt="Maqder" className="h-20 w-auto object-contain" />
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/70 text-sm font-medium">Updating application…</p>
          </div>
        </div>
      )
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-6 p-8">
          <div className="w-20 h-20 rounded-3xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
              {this.props.fallbackMessage || 'An unexpected error occurred. The application may have updated in the background.'}
            </p>
          </div>
          <button
            onClick={() => purgeAndReload()}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Application
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl max-w-full overflow-auto">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
