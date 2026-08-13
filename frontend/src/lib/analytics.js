// Provider-agnostic analytics wrapper.
// Config injected at runtime from Super Admin settings.

let initialized = false
let config = null

export function initAnalytics(cfg) {
  config = cfg
  if (!cfg?.enabled || !cfg?.apiKey) return
  initialized = true

  if (cfg.provider === 'posthog') {
    if (typeof window !== 'undefined' && !window.posthog) {
      window.__analytics_provider__ = 'posthog'
    }
  } else if (cfg.provider === 'mixpanel') {
    window.__analytics_provider__ = 'mixpanel'
  }
}

function loadSentryBrowser(dsn) {
  if (typeof window === 'undefined' || !dsn || window.Sentry) return
  const script = document.createElement('script')
  script.src = 'https://browser.sentry-cdn.com/8.47.0/bundle.min.js'
  script.crossOrigin = 'anonymous'
  script.onload = () => {
    try {
      window.Sentry?.init({ dsn, environment: import.meta.env.MODE })
      window.__ERROR_TRACKING_ENABLED__ = true
      window.__captureError__ = (error, context = {}) => {
        try {
          window.Sentry?.captureException(error, { extra: context })
        } catch {}
      }
    } catch {}
  }
  document.head.appendChild(script)
}

export async function initTelemetryFromServer() {
  try {
    const res = await fetch('/api/public/telemetry', { credentials: 'omit' })
    if (!res.ok) return
    const data = await res.json()
    if (data?.analytics) initAnalytics(data.analytics)
    if (data?.errorTracking?.enabled && data?.errorTracking?.dsn && data?.errorTracking?.provider === 'sentry') {
      loadSentryBrowser(data.errorTracking.dsn)
    }
  } catch {}
}

export function track(event, properties = {}) {
  if (!initialized || !config?.enabled) return
  try {
    const payload = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        platform: 'web',
      }
    }
    // If custom endpoint
    if (config.endpoint) {
      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify(payload),
      }).catch(() => {})
    }
    // Console in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties)
    }
  } catch {}
}

export function identify(userId, traits = {}) {
  if (!initialized) return
  track('$identify', { distinct_id: userId, ...traits })
}

export function page(name, properties = {}) {
  track('$pageview', { page_name: name, ...properties })
}

export default { initAnalytics, initTelemetryFromServer, track, identify, page }
