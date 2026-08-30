import { Component } from 'react'
import {
  isChunkLoadError,
  tryRecoverFromChunkError,
  purgeStaleCachesAndReload,
} from './chunkRecovery'

const refreshPage = () => {
  void purgeStaleCachesAndReload()
}

const isArabicUi = () => {
  if (typeof document === 'undefined') return false
  return document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar'
}

function SoftRouteError({ onRetry, error }) {
  const ar = isArabicUi()
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-teal-700">Maqder</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {ar ? 'تعذر تحميل الصفحة' : 'This page could not load'}
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {ar
          ? 'جرّب مرة أخرى، أو انتقل لصفحة أخرى. بياناتك محفوظة.'
          : 'Try again, or open another page. Your data is safe.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600"
      >
        {ar ? 'إعادة المحاولة' : 'Try again'}
      </button>
      {import.meta.env.DEV && error ? (
        <pre className="mt-4 max-h-32 w-full overflow-auto rounded-lg bg-slate-50 p-3 text-left text-[11px] text-red-700 dark:bg-dark-800 dark:text-red-300">
          {error?.message || String(error)}
        </pre>
      ) : null}
    </div>
  )
}

function PremiumErrorScreen({ recovering = false, error = null }) {
  const ar = isArabicUi()

  const copy = ar
    ? {
        eyebrow: 'ماقْدِر',
        title: recovering ? 'جاري التحديث' : 'نعتذر عن الخطأ',
        body: recovering
          ? 'نحدّث الصفحة الآن لضمان أحدث نسخة.'
          : 'نعتذر عن هذا الخطأ. يرجى تحديث الصفحة، أو مسح ذاكرة التخزين المؤقت ثم المحاولة مرة أخرى.',
        refresh: 'تحديث الصفحة',
        cache: 'مسح التخزين المؤقت',
        hint: 'بياناتك محفوظة. يحدث هذا عادةً بعد تحديث سريع للتطبيق.',
        recovering: 'يرجى الانتظار لحظات…',
      }
    : {
        eyebrow: 'Maqder',
        title: recovering ? 'Refreshing' : 'Sorry for the error',
        body: recovering
          ? 'We are updating the page so you have the latest version.'
          : 'Kindly refresh the page, or clear your cache and try again.',
        refresh: 'Refresh the page',
        cache: 'Clear cache',
        hint: 'Your work is safe. This is usually a brief app update.',
        recovering: 'Just a moment…',
      }

  const shell = {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    background: '#F7F6F2',
    color: '#0F172A',
    fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', system-ui, sans-serif",
    position: 'relative',
    overflow: 'hidden',
    direction: ar ? 'rtl' : 'ltr',
  }

  return (
    <div style={shell}>
      <style>{`
        @keyframes maqder-error-spin { to { transform: rotate(360deg); } }
        @keyframes maqder-error-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .maqder-error-card { animation: maqder-error-rise 0.55s ease both; }
        .maqder-error-spin { animation: maqder-error-spin 0.9s linear infinite; }
        .maqder-error-primary:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .maqder-error-ghost:hover { background: #ECFDF5; border-color: #99F6E4; }
      `}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(15,118,110,0.14) 0%, rgba(15,118,110,0) 70%)',
          top: '-160px',
          [ar ? 'left' : 'right']: '-80px',
          pointerEvents: 'none',
        }}
      />
      <div
        className="maqder-error-card"
        style={{
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.86)',
          border: '1px solid rgba(15,23,42,0.06)',
          borderRadius: 32,
          padding: '40px 32px 32px',
          boxShadow: '0 30px 80px -48px rgba(15,23,42,0.45), 0 12px 32px -20px rgba(15,118,110,0.18)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}maqderbestlogo.png`}
          alt="Maqder"
          style={{ height: 52, width: 'auto', objectFit: 'contain', margin: '0 auto 22px' }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#0F766E',
          }}
        >
          {copy.eyebrow}
        </p>
        <h1
          style={{
            margin: '10px 0 0',
            fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
            fontSize: 'clamp(28px, 5vw, 36px)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1.15,
            color: '#0B1220',
          }}
        >
          {copy.title}
        </h1>
        <p
          style={{
            margin: '14px auto 0',
            maxWidth: 340,
            fontSize: 15.5,
            lineHeight: 1.65,
            color: '#64748B',
            fontWeight: 500,
          }}
        >
          {copy.body}
        </p>

        {recovering ? (
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div
              className="maqder-error-spin"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid rgba(15,118,110,0.18)',
                borderTopColor: '#0F766E',
              }}
            />
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>{copy.recovering}</p>
          </div>
        ) : (
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="maqder-error-primary"
              onClick={refreshPage}
              style={{
                height: 50,
                border: 'none',
                borderRadius: 16,
                background: '#0F766E',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                boxShadow: '0 16px 32px -16px rgba(15,118,110,0.7)',
                transition: 'transform 0.2s ease, filter 0.2s ease',
              }}
            >
              {copy.refresh}
            </button>
            <button
              type="button"
              className="maqder-error-ghost"
              onClick={() => purgeStaleCachesAndReload()}
              style={{
                height: 50,
                borderRadius: 16,
                border: '1px solid #D6E4DF',
                background: 'transparent',
                color: '#134E4A',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                transition: 'background 0.2s ease, border-color 0.2s ease',
              }}
            >
              {copy.cache}
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#94A3B8' }}>{copy.hint}</p>
          </div>
        )}

        {error && !recovering && (
          <details
            style={{
              marginTop: 18,
              textAlign: 'left',
              fontSize: 12,
              color: '#64748b',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '10px 14px',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155', userSelect: 'none' }}>
              {ar ? 'تفاصيل الخطأ الفني (Debug Details)' : 'Technical Error Details'}
            </summary>
            <pre
              style={{
                marginTop: 8,
                fontSize: 11,
                color: '#b91c1c',
                background: '#fef2f2',
                padding: 10,
                borderRadius: 8,
                maxHeight: 180,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error?.stack || error?.message || String(error)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, recovering: false }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error: isChunkLoadError(error) ? null : error,
      recovering: false,
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    if (window.__ERROR_TRACKING_ENABLED__ && window.__captureError__) {
      window.__captureError__(error, { componentStack: errorInfo.componentStack })
    }

    // Route-level soft boundaries never hard-reload — navigation stays usable.
    if (this.props.soft) return

    if (isChunkLoadError(error) && tryRecoverFromChunkError()) {
      this.setState({ recovering: true, error: null })
    } else if (isChunkLoadError(error)) {
      this.setState({ recovering: false, error })
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== undefined && this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, recovering: false })
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, recovering: false })
  }

  render() {
    if (this.state.recovering && !this.props.soft) {
      return <PremiumErrorScreen recovering />
    }

    if (this.state.hasError) {
      if (this.props.soft) {
        return <SoftRouteError error={this.state.error} onRetry={this.reset} />
      }
      return <PremiumErrorScreen error={this.state.error} />
    }
    return this.props.children
  }
}

export default ErrorBoundary
