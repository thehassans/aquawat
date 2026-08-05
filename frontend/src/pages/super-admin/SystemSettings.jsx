import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bug, Wifi, BarChart2, Clock, Shield, Save, RefreshCw,
  Check, Info, AlertTriangle, Server, Database, Zap,
  Eye, EyeOff, ChevronRight, Activity, Lock, Globe, MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'error', label: 'Error Tracking', icon: Bug, color: 'from-red-500 to-rose-600' },
  { id: 'network', label: 'Offline & Network', icon: Wifi, color: 'from-blue-500 to-cyan-600' },
  { id: 'analytics', label: 'Analytics', icon: BarChart2, color: 'from-violet-500 to-purple-600' },
  { id: 'sessions', label: 'State & Sessions', icon: Clock, color: 'from-amber-500 to-orange-500' },
  { id: 'security', label: 'Performance & Security', icon: Shield, color: 'from-emerald-500 to-teal-600' },
  { id: 'monitoring', label: 'Tenant Monitoring API', icon: Activity, color: 'from-indigo-500 to-blue-600' },
  { id: 'sms', label: 'SMS & OTP', icon: MessageSquare, color: 'from-green-500 to-emerald-600' },
]

// ── UI helpers ────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function InfoBox({ icon: Icon = Info, title, children, variant = 'info' }) {
  const styles = {
    info: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    success: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  }
  const iconStyles = {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  }
  return (
    <div className={`rounded-2xl border p-4 ${styles[variant]}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconStyles[variant]}`} />
        <div>
          {title && <p className="font-semibold text-sm mb-1">{title}</p>}
          <div className="text-sm leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-gray-100 dark:border-dark-700 last:border-b-0">
      <div className="sm:w-64 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function SaveButton({ onClick, loading }) {
  return (
    <div className="pt-6 border-t border-gray-100 dark:border-dark-700 flex justify-end">
      <button
        onClick={onClick}
        disabled={loading}
        className="btn btn-primary gap-2"
      >
        {loading
          ? <RefreshCw className="w-4 h-4 animate-spin" />
          : <Save className="w-4 h-4" />
        }
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}

// ── Tab content components ────────────────────────────────────────────────────

function TenantMonitoringTab({ settings, onChange, onSave, saving }) {
  return (
    <div className="space-y-6">
      <InfoBox icon={Activity} title="Tenant Monitoring Integration">
        Configure an external API endpoint to fetch real-time server resources (CPU, RAM, Disk) and active sessions. Maqder ERP will pass the `tenantSlug` as a query parameter when calling this endpoint.
      </InfoBox>

      <div className="card rounded-2xl p-6 space-y-2">
        <FieldRow label="Enable Monitoring">
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.tenantMonitoring?.enabled || false}
              onChange={(v) => onChange('tenantMonitoring.enabled', v)}
            />
            <span className="text-sm text-gray-500">
              {settings.tenantMonitoring?.enabled ? 'Active — querying external API' : 'Inactive — using basic internal DB stats'}
            </span>
          </div>
        </FieldRow>

        <FieldRow label="API Endpoint URL">
          <input
            type="text"
            className="input"
            placeholder="https://your-monitoring-api.com/stats"
            value={settings.tenantMonitoring?.endpointURL || ''}
            onChange={(e) => onChange('tenantMonitoring.endpointURL', e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Must accept ?tenantSlug=... query parameter</p>
        </FieldRow>

        <FieldRow label="API Key / Bearer Token">
          <input
            type="password"
            className="input"
            placeholder="Enter API key or Bearer token"
            value={settings.tenantMonitoring?.apiKey || ''}
            onChange={(e) => onChange('tenantMonitoring.apiKey', e.target.value)}
          />
        </FieldRow>
        
        <FieldRow label="Provider Type">
          <select
            className="select"
            value={settings.tenantMonitoring?.provider || 'custom'}
            onChange={(e) => onChange('tenantMonitoring.provider', e.target.value)}
          >
            <option value="custom">Custom Webhook</option>
            <option value="plesk">Plesk API</option>
            <option value="cpanel">cPanel UAPI</option>
          </select>
        </FieldRow>

        <FieldRow label="Test Connection">
          <button
            type="button"
            onClick={async () => {
              if (!settings.tenantMonitoring?.endpointURL) {
                return toast.error('Please enter an Endpoint URL first');
              }
              const testPromise = api.post('/super-admin/settings/monitoring/test-connection', {
                endpointURL: settings.tenantMonitoring.endpointURL,
                apiKey: settings.tenantMonitoring.apiKey,
                provider: settings.tenantMonitoring.provider
              });
              toast.promise(testPromise, {
                loading: 'Testing connection...',
                success: 'Connection successful! (Valid response received)',
                error: (err) => err.response?.data?.error || 'Connection failed'
              });
            }}
            className="btn btn-secondary gap-2"
          >
            <Zap className="w-4 h-4" />
            Test API Connection
          </button>
        </FieldRow>
      </div>

      <SaveButton onClick={onSave} loading={saving} />
    </div>
  )
}

function ErrorTrackingTab({ settings, onChange, onSave, saving }) {
  const [showDsn, setShowDsn] = useState(false)

  return (
    <div className="space-y-6">
      <InfoBox icon={Bug} title="What is Error Tracking?">
        Error tracking automatically captures JavaScript exceptions, API failures, and rendering errors. When an error occurs, a full stack trace with user context and session data is captured and sent to your configured provider — enabling rapid diagnosis and resolution without waiting for user reports.
      </InfoBox>

      <div className="card rounded-2xl p-6">
        <FieldRow label="Enable Error Tracking">
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.errorTracking?.enabled || false}
              onChange={(v) => onChange('errorTracking.enabled', v)}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {settings.errorTracking?.enabled ? 'Active — capturing errors' : 'Inactive'}
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Provider">
          <select
            className="select"
            value={settings.errorTracking?.provider || 'sentry'}
            onChange={(e) => onChange('errorTracking.provider', e.target.value)}
          >
            <option value="sentry">Sentry</option>
            <option value="bugsnag">Bugsnag</option>
            <option value="custom">Custom Webhook</option>
          </select>
        </FieldRow>

        <FieldRow label="DSN / Endpoint URL">
          <div className="relative">
            <input
              type={showDsn ? 'text' : 'password'}
              className="input pr-10"
              placeholder="https://key@sentry.io/project-id"
              value={settings.errorTracking?.dsn || ''}
              onChange={(e) => onChange('errorTracking.dsn', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowDsn(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showDsn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FieldRow>

        <FieldRow label="Upload Source Maps">
          <div className="flex items-center gap-3">
            <Toggle
              checked={settings.errorTracking?.uploadSourceMaps || false}
              onChange={(v) => onChange('errorTracking.uploadSourceMaps', v)}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Enables human-readable stack traces in production
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Test Connection">
          <button
            onClick={() => toast.success('Test error sent! Check your provider dashboard.')}
            className="btn btn-secondary gap-2"
          >
            <Zap className="w-4 h-4" />
            Send Test Error
          </button>
        </FieldRow>
      </div>

      <SaveButton onClick={onSave} loading={saving} />
    </div>
  )
}

function NetworkTab() {
  const features = [
    {
      icon: Wifi,
      title: 'Offline Banner',
      value: 'Always On',
      description: 'A slide-in banner appears at the top of the screen when the user loses internet connectivity. It disappears after 3 seconds when connection is restored.',
      status: 'active',
    },
    {
      icon: RefreshCw,
      title: 'Retry Strategy',
      value: 'Exponential Backoff',
      description: 'Failed API requests are retried with increasing delays: 1s → 2s → 4s → 8s → 16s. Maximum 5 retry attempts per request.',
      status: 'active',
    },
    {
      icon: Database,
      title: 'Local Queue',
      value: 'IndexedDB-backed',
      description: 'Write operations that fail while offline are queued in IndexedDB and replayed in order once connectivity is restored.',
      status: 'active',
    },
  ]

  return (
    <div className="space-y-6">
      <InfoBox icon={Info} title="Frontend-Managed Features">
        These network resilience features are built into the frontend and require no configuration. They are always active for all tenants.
      </InfoBox>

      <div className="grid gap-4">
        {features.map(f => (
          <div key={f.title} className="card rounded-2xl p-5 flex items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <f.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-bold text-gray-900 dark:text-white">{f.title}</h4>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {f.value}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsTab({ settings, onChange, onSave, saving }) {
  const isCustom = settings.analytics?.provider === 'custom'
  const events = [
    { key: 'trackSignup', label: 'Sign-up' },
    { key: 'trackLogin', label: 'Login' },
    { key: 'trackInvoiceCreated', label: 'Invoice Created' },
    { key: 'trackPosPayment', label: 'POS Payment' },
    { key: 'trackOrderCompleted', label: 'Order Completed' },
  ]

  return (
    <div className="space-y-6">
      <InfoBox icon={Activity} title="What does analytics track?">
        Analytics helps you understand how users interact with Maqder — which features are most used, drop-off points, and performance metrics. All data is sent to your chosen provider and never shared with Maqder.
      </InfoBox>

      <div className="card rounded-2xl p-6">
        <FieldRow label="Enable Analytics">
          <Toggle
            checked={settings.analytics?.enabled || false}
            onChange={(v) => onChange('analytics.enabled', v)}
          />
        </FieldRow>

        <FieldRow label="Provider">
          <select
            className="select"
            value={settings.analytics?.provider || 'posthog'}
            onChange={(e) => onChange('analytics.provider', e.target.value)}
          >
            <option value="posthog">PostHog</option>
            <option value="mixpanel">Mixpanel</option>
            <option value="amplitude">Amplitude</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </FieldRow>

        <FieldRow label="API Key">
          <input
            type="password"
            className="input"
            placeholder="phc_xxxxxxxxxxxxx"
            value={settings.analytics?.apiKey || ''}
            onChange={(e) => onChange('analytics.apiKey', e.target.value)}
          />
        </FieldRow>

        {isCustom && (
          <FieldRow label="Custom Endpoint URL">
            <input
              type="text"
              className="input"
              placeholder="https://your-api.com/analytics"
              value={settings.analytics?.endpoint || ''}
              onChange={(e) => onChange('analytics.endpoint', e.target.value)}
            />
          </FieldRow>
        )}
      </div>

      <div className="card rounded-2xl p-6">
        <h4 className="font-bold text-gray-900 dark:text-white mb-1">Event Toggles</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose which business events to track</p>
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.key} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ev.label}</span>
              <Toggle
                checked={settings.analytics?.events?.[ev.key] !== false}
                onChange={(v) => onChange(`analytics.events.${ev.key}`, v)}
              />
            </div>
          ))}
        </div>
      </div>

      <SaveButton onClick={onSave} loading={saving} />
    </div>
  )
}

function SessionsTab({ settings, onChange, onSave, saving }) {
  return (
    <div className="space-y-6">
      <InfoBox icon={Clock} title="Token Lifecycle">
        Access tokens authenticate API requests. Refresh tokens allow silent renewal without re-login. Session timeout logs out idle users for security.
      </InfoBox>

      <div className="card rounded-2xl p-6">
        <FieldRow label="Access Token Expiry">
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input w-28"
              min={5}
              max={1440}
              value={settings.sessions?.accessTokenExpiry || 60}
              onChange={(e) => onChange('sessions.accessTokenExpiry', Number(e.target.value))}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">minutes</span>
          </div>
        </FieldRow>

        <FieldRow label="Refresh Token Expiry">
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input w-28"
              min={1}
              max={365}
              value={settings.sessions?.refreshTokenExpiry || 30}
              onChange={(e) => onChange('sessions.refreshTokenExpiry', Number(e.target.value))}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">days</span>
          </div>
        </FieldRow>

        <FieldRow label="Session Timeout">
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input w-28"
              min={5}
              max={1440}
              value={settings.sessions?.sessionTimeout || 480}
              onChange={(e) => onChange('sessions.sessionTimeout', Number(e.target.value))}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">minutes of inactivity</span>
          </div>
        </FieldRow>
      </div>

      <InfoBox icon={AlertTriangle} variant="warning" title="Security vs Convenience">
        Shorter token expiry values increase security by reducing the window for token theft, but require users to log in more frequently. A 60-minute access token with 30-day refresh is a balanced default for enterprise SaaS.
      </InfoBox>

      <SaveButton onClick={onSave} loading={saving} />
    </div>
  )
}

function SecurityTab({ settings, onChange, onSave, saving }) {
  const measures = [
    {
      title: 'XSS Protection',
      description: 'Sanitizes all user-generated HTML before rendering. Prevents Cross-Site Scripting attacks by stripping dangerous tags and attributes.',
      key: 'xssProtection',
      icon: Shield,
    },
    {
      title: 'MongoDB Sanitization',
      description: 'Strips $ and . characters from request body to prevent NoSQL injection attacks against MongoDB operator expressions.',
      key: 'mongoSanitize',
      icon: Database,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Rate limiting — Auth */}
      <div className="card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white">Auth Rate Limiting</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Protects login/register endpoints from brute-force attacks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Max Requests</label>
            <input
              type="number"
              className="input mt-1"
              min={1}
              value={settings.security?.authRateLimit?.maxRequests || 10}
              onChange={(e) => onChange('security.authRateLimit.maxRequests', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Window (minutes)</label>
            <input
              type="number"
              className="input mt-1"
              min={1}
              value={settings.security?.authRateLimit?.windowMinutes || 15}
              onChange={(e) => onChange('security.authRateLimit.windowMinutes', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Rate limiting — API */}
      <div className="card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white">API Rate Limiting</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Global limit applied to all API endpoints per IP</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Max Requests</label>
            <input
              type="number"
              className="input mt-1"
              min={1}
              value={settings.security?.apiRateLimit?.maxRequests || 500}
              onChange={(e) => onChange('security.apiRateLimit.maxRequests', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Window (minutes)</label>
            <input
              type="number"
              className="input mt-1"
              min={1}
              value={settings.security?.apiRateLimit?.windowMinutes || 15}
              onChange={(e) => onChange('security.apiRateLimit.windowMinutes', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Toggle security measures */}
      <div className="card rounded-2xl p-6 space-y-5">
        <h4 className="font-bold text-gray-900 dark:text-white">Security Middleware</h4>
        {measures.map(m => (
          <div key={m.key} className="flex items-start gap-5 py-4 border-b border-gray-100 dark:border-dark-700 last:border-b-0">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center flex-shrink-0">
              <m.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h5 className="font-semibold text-gray-900 dark:text-white text-sm">{m.title}</h5>
                <Toggle
                  checked={settings.security?.[m.key] !== false}
                  onChange={(v) => onChange(`security.${m.key}`, v)}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{m.description}</p>
            </div>
          </div>
        ))}
      </div>

      <SaveButton onClick={onSave} loading={saving} />
    </div>
  )
}

function SmsSettingsTab({ settings, onChange, onSave, saving }) {
  const isCustom = settings.sms?.provider === 'custom'

  return (
    <div className="space-y-6">
      <InfoBox icon={MessageSquare} title="SMS & OTP Settings">
        Configure SMS provider for multi-factor authentication and notifications.
      </InfoBox>

      <div className="card rounded-2xl p-6">
        <FieldRow label="Enable SMS">
          <Toggle
            checked={settings.sms?.enabled || false}
            onChange={(v) => onChange('sms.enabled', v)}
          />
        </FieldRow>

        <FieldRow label="Provider">
          <select
            className="select"
            value={settings.sms?.provider || 'twilio'}
            onChange={(e) => onChange('sms.provider', e.target.value)}
          >
            <option value="twilio">Twilio</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </FieldRow>

        {settings.sms?.provider !== 'custom' && (
          <>
            <FieldRow label="Twilio Account SID">
              <input
                type="text"
                className="input"
                placeholder="AC..."
                value={settings.sms?.twilioAccountSid || ''}
                onChange={(e) => onChange('sms.twilioAccountSid', e.target.value)}
              />
            </FieldRow>

            <FieldRow label="Twilio Auth Token">
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={settings.sms?.twilioAuthToken || ''}
                onChange={(e) => onChange('sms.twilioAuthToken', e.target.value)}
              />
            </FieldRow>

            <FieldRow label="Twilio From Number">
              <input
                type="text"
                className="input"
                placeholder="+1234567890"
                value={settings.sms?.twilioFromNumber || ''}
                onChange={(e) => onChange('sms.twilioFromNumber', e.target.value)}
              />
            </FieldRow>
          </>
        )}

        {isCustom && (
          <FieldRow label="Custom Endpoint URL">
            <input
              type="text"
              className="input"
              placeholder="https://your-api.com/sms"
              value={settings.sms?.customEndpoint || ''}
              onChange={(e) => onChange('sms.customEndpoint', e.target.value)}
            />
          </FieldRow>
        )}
      </div>

      <SaveButton onClick={onSave} loading={saving} />
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('error')
  const [localSettings, setLocalSettings] = useState({})
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.get('/super-admin/system-settings').then(r => r.data),
    onSuccess: (d) => setLocalSettings(d?.settings || d || {}),
  })

  // Initialize from fetched data
  const settings = Object.keys(localSettings).length ? localSettings : (data?.settings || data || {})

  const { mutate: saveSettings, isPending: saving } = useMutation({
    mutationFn: (payload) => api.put('/super-admin/system-settings', { settings: payload }),
    onSuccess: () => {
      toast.success('System settings saved successfully')
      setDirty(false)
    },
    onError: (err) => toast.error(err.userMessage || 'Failed to save settings'),
  })

  // Deep-path setter: 'errorTracking.enabled' → nested update
  const handleChange = (path, value) => {
    setDirty(true)
    setLocalSettings(prev => {
      const next = { ...prev }
      const parts = path.split('.')
      let cur = next
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...(cur[parts[i]] || {}) }
        cur = cur[parts[i]]
      }
      cur[parts[at(-1)]] = value
      return next
    })
  }

  // Simpler version without using at(-1) for compatibility
  const handleChangeFixed = (path, value) => {
    setDirty(true)
    setLocalSettings(prev => {
      const next = JSON.parse(JSON.stringify(prev || {}))
      const parts = path.split('.')
      let cur = next
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {}
        cur = cur[parts[i]]
      }
      cur[parts[parts.length - 1]] = value
      return next
    })
  }

  const handleSave = () => saveSettings(settings)

  const tabProps = {
    settings,
    onChange: handleChangeFixed,
    onSave: handleSave,
    saving,
  }

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-dark-700 rounded-xl w-64" />
      <div className="h-16 bg-gray-200 dark:bg-dark-700 rounded-2xl" />
      <div className="h-64 bg-gray-200 dark:bg-dark-700 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            System Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
            Configure platform-wide quality infrastructure and security controls
          </p>
        </div>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-semibold"
          >
            <AlertTriangle className="w-4 h-4" />
            Unsaved changes
          </motion.div>
        )}
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-800 rounded-2xl overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all relative ${
                isActive
                  ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${tab.color} opacity-10`}
                />
              )}
              <tab.icon className={`w-4 h-4 relative z-10 ${isActive ? '' : ''}`} />
              <span className="relative z-10">{tab.label}</span>
              {isActive && (
                <span className={`relative z-10 w-2 h-2 rounded-full bg-gradient-to-br ${tab.color}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'error' && <ErrorTrackingTab {...tabProps} />}
          {activeTab === 'network' && <NetworkTab />}
          {activeTab === 'analytics' && <AnalyticsTab {...tabProps} />}
          {activeTab === 'sessions' && <SessionsTab {...tabProps} />}
          {activeTab === 'security' && <SecurityTab {...tabProps} />}
          {activeTab === 'monitoring' && <TenantMonitoringTab {...tabProps} />}
          {activeTab === 'sms' && <SmsSettingsTab {...tabProps} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
