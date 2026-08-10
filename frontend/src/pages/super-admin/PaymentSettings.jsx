import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Apple, Smartphone, Save, Loader2, CheckCircle, Eye, EyeOff, Plug, X, AlertCircle } from 'lucide-react'
import api from '../../lib/api'

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 py-2.5 px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'
const cardCls = 'max-w-2xl space-y-5 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-6'

export default function PaymentSettings() {
  const queryClient = useQueryClient()
  const [moyasarForm, setMoyasarForm] = useState({ enabled: false, publishableKey: '', secretKey: '', webhookSecret: '', environment: 'test' })
  const [stripeForm, setStripeForm] = useState({ enabled: false, publishableKey: '', secretKey: '', webhookSecret: '', environment: 'test' })
  const [applePayForm, setApplePayForm] = useState({ enabled: false, merchantId: '', merchantCertificatePath: '', merchantCertificateKeyPath: '', environment: 'test' })
  const [stcPayForm, setStcPayForm] = useState({ enabled: false, merchantId: '', apiKey: '', environment: 'test' })
  const [tabbyForm, setTabbyForm] = useState({ enabled: false, publicKey: '', secretKey: '', merchantCode: '', environment: 'test' })
  const [tamaraForm, setTamaraForm] = useState({ enabled: false, apiToken: '', notificationToken: '', environment: 'test' })

  const [showSecret, setShowSecret] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [showStripeSecret, setShowStripeSecret] = useState(false)
  const [showStripeWebhook, setShowStripeWebhook] = useState(false)
  const [showStcKey, setShowStcKey] = useState(false)
  const [showTabbyKey, setShowTabbyKey] = useState(false)
  const [showTamaraToken, setShowTamaraToken] = useState(false)
  const [showTamaraNotifToken, setShowTamaraNotifToken] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-payment-settings'],
    queryFn: () => api.get('/super-admin/settings/payment').then((res) => res.data),
  })

  useEffect(() => {
    if (data?.payment) {
      const m = data.payment.moyasar || {}
      setMoyasarForm({ enabled: m.enabled, publishableKey: m.publishableKey || '', secretKey: '', webhookSecret: '', environment: m.environment || 'test' })
      const stripe = data.payment.stripe || {}
      setStripeForm({ enabled: stripe.enabled, publishableKey: stripe.publishableKey || '', secretKey: '', webhookSecret: '', environment: stripe.environment || 'test' })
      const a = data.payment.applePay || {}
      setApplePayForm({ enabled: a.enabled, merchantId: a.merchantId || '', merchantCertificatePath: a.merchantCertificatePath || '', merchantCertificateKeyPath: a.merchantCertificateKeyPath || '', environment: a.environment || 'test' })
      const s = data.payment.stcPay || {}
      setStcPayForm({ enabled: s.enabled, merchantId: s.merchantId || '', apiKey: '', environment: s.environment || 'test' })
      const tb = data.payment.tabby || {}
      setTabbyForm({ enabled: tb.enabled, publicKey: tb.publicKey || '', secretKey: '', merchantCode: tb.merchantCode || '', environment: tb.environment || 'test' })
      const tm = data.payment.tamara || {}
      setTamaraForm({ enabled: tm.enabled, apiToken: '', notificationToken: '', environment: tm.environment || 'test' })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put('/super-admin/settings/payment', { payment: payload }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-payment-settings'] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  const testMutation = useMutation({
    mutationFn: (provider) => api.post('/super-admin/settings/payment/test-connection', { provider }).then((res) => res.data),
  })

  const handleSave = () => {
    const payload = {
      moyasar: { ...moyasarForm },
      stripe: { ...stripeForm },
      applePay: { ...applePayForm },
      stcPay: { ...stcPayForm },
      tabby: { ...tabbyForm },
      tamara: { ...tamaraForm },
    }
    if (!payload.moyasar.secretKey) delete payload.moyasar.secretKey
    if (!payload.moyasar.webhookSecret) delete payload.moyasar.webhookSecret
    if (!payload.stripe.secretKey) delete payload.stripe.secretKey
    if (!payload.stripe.webhookSecret) delete payload.stripe.webhookSecret
    if (!payload.stcPay.apiKey) delete payload.stcPay.apiKey
    if (!payload.tabby.secretKey) delete payload.tabby.secretKey
    if (!payload.tamara.apiToken) delete payload.tamara.apiToken
    if (!payload.tamara.notificationToken) delete payload.tamara.notificationToken
    saveMutation.mutate(payload)
  }

  const handleTest = (provider) => {
    setTestResult(null)
    testMutation.mutate(provider, {
      onSuccess: (result) => setTestResult({ provider, ...result }),
      onError: (err) => setTestResult({ provider, ok: false, message: err.response?.data?.error || err.message }),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const moyasar = data?.payment?.moyasar || {}
  const stripe = data?.payment?.stripe || {}
  const applePay = data?.payment?.applePay || {}
  const stcPay = data?.payment?.stcPay || {}
  const tabby = data?.payment?.tabby || {}
  const tamara = data?.payment?.tamara || {}

  const TestButton = ({ provider }) => (
    <button
      onClick={() => handleTest(provider)}
      disabled={testMutation.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-dark-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-dark-700 disabled:opacity-60"
    >
      {testMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
      Test Connection
    </button>
  )

  const TestResult = ({ provider }) => {
    if (!testResult || testResult.provider !== provider) return null
    return (
      <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${testResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
        {testResult.ok ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
        <span>{testResult.message}</span>
        <button onClick={() => setTestResult(null)} className="ml-auto shrink-0"><X className="h-3.5 w-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Gateway Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure payment gateways for demo user upgrades and checkout</p>
      </div>

      {/* ── Moyasar ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Moyasar</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Saudi payment gateway — Visa, Mastercard, Mada, Apple Pay</p>
            </div>
          </div>
          <TestButton provider="moyasar" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={moyasarForm.enabled} onChange={(e) => setMoyasarForm({ ...moyasarForm, enabled: e.target.checked })} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Moyasar Payments</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Environment</label>
          <select value={moyasarForm.environment} onChange={(e) => setMoyasarForm({ ...moyasarForm, environment: e.target.value })} className={inputCls}>
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Publishable Key</label>
          <input type="text" value={moyasarForm.publishableKey} onChange={(e) => setMoyasarForm({ ...moyasarForm, publishableKey: e.target.value })} placeholder="pk_test_..." className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>
            Secret Key {moyasar.hasSecretKey && <span className="text-xs text-gray-400">(currently set: {moyasar.secretKeyMasked})</span>}
          </label>
          <div className="relative">
            <input type={showSecret ? 'text' : 'password'} value={moyasarForm.secretKey} onChange={(e) => setMoyasarForm({ ...moyasarForm, secretKey: e.target.value })} placeholder={moyasar.hasSecretKey ? '•••••••• (enter new to replace)' : 'sk_test_...'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Webhook Secret {moyasar.hasWebhookSecret && <span className="text-xs text-gray-400">(currently set: {moyasar.webhookSecretMasked})</span>}
          </label>
          <div className="relative">
            <input type={showWebhook ? 'text' : 'password'} value={moyasarForm.webhookSecret} onChange={(e) => setMoyasarForm({ ...moyasarForm, webhookSecret: e.target.value })} placeholder={moyasar.hasWebhookSecret ? '•••••••• (enter new to replace)' : 'whsec_...'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowWebhook(!showWebhook)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">Webhook URL:</span> POST /api/payments/webhook</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">Callback URL:</span> GET /api/payments/callback</p>
        </div>

        <TestResult provider="moyasar" />
      </div>

      {/* ── Stripe ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Stripe</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Global cards & App Store paid add-ons — Checkout Sessions + webhooks</p>
            </div>
          </div>
          <TestButton provider="stripe" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={stripeForm.enabled} onChange={(e) => setStripeForm({ ...stripeForm, enabled: e.target.checked })} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Stripe Payments</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Environment</label>
          <select value={stripeForm.environment} onChange={(e) => setStripeForm({ ...stripeForm, environment: e.target.value })} className={inputCls}>
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Publishable Key</label>
          <input type="text" value={stripeForm.publishableKey} onChange={(e) => setStripeForm({ ...stripeForm, publishableKey: e.target.value })} placeholder="pk_test_..." className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>
            Secret Key {stripe.hasSecretKey && <span className="text-xs text-gray-400">(currently set: {stripe.secretKeyMasked})</span>}
          </label>
          <div className="relative">
            <input type={showStripeSecret ? 'text' : 'password'} value={stripeForm.secretKey} onChange={(e) => setStripeForm({ ...stripeForm, secretKey: e.target.value })} placeholder={stripe.hasSecretKey ? '•••••••• (enter new to replace)' : 'sk_test_...'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowStripeSecret(!showStripeSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showStripeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Webhook Secret {stripe.hasWebhookSecret && <span className="text-xs text-gray-400">(currently set: {stripe.webhookSecretMasked})</span>}
          </label>
          <div className="relative">
            <input type={showStripeWebhook ? 'text' : 'password'} value={stripeForm.webhookSecret} onChange={(e) => setStripeForm({ ...stripeForm, webhookSecret: e.target.value })} placeholder={stripe.hasWebhookSecret ? '•••••••• (enter new to replace)' : 'whsec_...'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowStripeWebhook(!showStripeWebhook)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showStripeWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-3 space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">Webhook URL:</span> POST /api/payments/stripe-webhook</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Listen for <code className="font-mono">checkout.session.completed</code> — powers plan upgrades and paid App Store installs.</p>
        </div>

        <TestResult provider="stripe" />
      </div>

      {/* ── Apple Pay ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
              <Apple className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Apple Pay</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Accept payments via Apple Pay on iOS and Safari</p>
            </div>
          </div>
          <TestButton provider="applePay" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={applePayForm.enabled} onChange={(e) => setApplePayForm({ ...applePayForm, enabled: e.target.checked })} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Apple Pay</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Environment</label>
          <select value={applePayForm.environment} onChange={(e) => setApplePayForm({ ...applePayForm, environment: e.target.value })} className={inputCls}>
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Merchant ID</label>
          <input type="text" value={applePayForm.merchantId} onChange={(e) => setApplePayForm({ ...applePayForm, merchantId: e.target.value })} placeholder="merchant.com.yourcompany.app" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Merchant Certificate Path</label>
          <input type="text" value={applePayForm.merchantCertificatePath} onChange={(e) => setApplePayForm({ ...applePayForm, merchantCertificatePath: e.target.value })} placeholder="/path/to/cert.pem" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Merchant Certificate Key Path</label>
          <input type="text" value={applePayForm.merchantCertificateKeyPath} onChange={(e) => setApplePayForm({ ...applePayForm, merchantCertificateKeyPath: e.target.value })} placeholder="/path/to/cert.key" className={inputCls} />
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Apple Pay requires domain verification in the Apple Developer portal. The merchant certificate must be stored on the server.</p>
        </div>

        <TestResult provider="applePay" />
      </div>

      {/* ── STC Pay ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Smartphone className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">STC Pay</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Saudi mobile wallet — STC Pay Business API</p>
            </div>
          </div>
          <TestButton provider="stcPay" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={stcPayForm.enabled} onChange={(e) => setStcPayForm({ ...stcPayForm, enabled: e.target.checked })} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable STC Pay</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Environment</label>
          <select value={stcPayForm.environment} onChange={(e) => setStcPayForm({ ...stcPayForm, environment: e.target.value })} className={inputCls}>
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Merchant ID</label>
          <input type="text" value={stcPayForm.merchantId} onChange={(e) => setStcPayForm({ ...stcPayForm, merchantId: e.target.value })} placeholder="Your STC Pay merchant ID" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>
            API Key {stcPay.hasApiKey && <span className="text-xs text-gray-400">(currently set: {stcPay.apiKeyMasked})</span>}
          </label>
          <div className="relative">
            <input type={showStcKey ? 'text' : 'password'} value={stcPayForm.apiKey} onChange={(e) => setStcPayForm({ ...stcPayForm, apiKey: e.target.value })} placeholder={stcPay.hasApiKey ? '•••••••• (enter new to replace)' : 'Enter STC Pay API key'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowStcKey(!showStcKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showStcKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">STC Pay Business API allows merchants to accept payments directly from customers' STC Pay wallets. Requires a merchant account with STC Pay.</p>
        </div>

        <TestResult provider="stcPay" />
      </div>

      {/* ── Tabby ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-white overflow-hidden ring-1 ring-gray-200">
              <img src="/tabby.png" alt="Tabby" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Tabby</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Buy now, pay later — split into 4 interest-free payments</p>
            </div>
          </div>
          <TestButton provider="tabby" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={tabbyForm.enabled} onChange={(e) => setTabbyForm({ ...tabbyForm, enabled: e.target.checked })} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Tabby</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Environment</label>
          <select value={tabbyForm.environment} onChange={(e) => setTabbyForm({ ...tabbyForm, environment: e.target.value })} className={inputCls}>
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Merchant Code</label>
          <input type="text" value={tabbyForm.merchantCode} onChange={(e) => setTabbyForm({ ...tabbyForm, merchantCode: e.target.value })} placeholder="Your Tabby merchant code" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Public Key</label>
          <input type="text" value={tabbyForm.publicKey} onChange={(e) => setTabbyForm({ ...tabbyForm, publicKey: e.target.value })} placeholder="pk_test_..." className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>
            Secret Key {tabby.hasSecretKey && <span className="text-xs text-gray-400">(currently set: {tabby.secretKeyMasked})</span>}
          </label>
          <div className="relative">
            <input type={showTabbyKey ? 'text' : 'password'} value={tabbyForm.secretKey} onChange={(e) => setTabbyForm({ ...tabbyForm, secretKey: e.target.value })} placeholder={tabby.hasSecretKey ? '•••••••• (enter new to replace)' : 'sk_test_...'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowTabbyKey(!showTabbyKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showTabbyKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">Webhook URL:</span> POST /api/payments/tabby-webhook</p>
        </div>

        <TestResult provider="tabby" />
      </div>

      {/* ── Tamara ── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-dark-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-white overflow-hidden ring-1 ring-gray-200">
              <img src="/tamara.webp" alt="Tamara" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Tamara</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Buy now, pay later — Saudi-focused installment plans</p>
            </div>
          </div>
          <TestButton provider="tamara" />
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={tamaraForm.enabled} onChange={(e) => setTamaraForm({ ...tamaraForm, enabled: e.target.checked })} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Tamara</span>
          </label>
        </div>

        <div>
          <label className={labelCls}>Environment</label>
          <select value={tamaraForm.environment} onChange={(e) => setTamaraForm({ ...tamaraForm, environment: e.target.value })} className={inputCls}>
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>
            API Token {tamara.hasApiToken && <span className="text-xs text-gray-400">(currently set: {tamara.apiTokenMasked})</span>}
          </label>
          <div className="relative">
            <input type={showTamaraToken ? 'text' : 'password'} value={tamaraForm.apiToken} onChange={(e) => setTamaraForm({ ...tamaraForm, apiToken: e.target.value })} placeholder={tamara.hasApiToken ? '•••••••• (enter new to replace)' : 'Enter Tamara API token'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowTamaraToken(!showTamaraToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showTamaraToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Notification Token {tamara.hasNotificationToken && <span className="text-xs text-gray-400">(currently set: {tamara.notificationTokenMasked})</span>}
          </label>
          <div className="relative">
            <input type={showTamaraNotifToken ? 'text' : 'password'} value={tamaraForm.notificationToken} onChange={(e) => setTamaraForm({ ...tamaraForm, notificationToken: e.target.value })} placeholder={tamara.hasNotificationToken ? '•••••••• (enter new to replace)' : 'Used to verify webhook notifications'} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowTamaraNotifToken(!showTamaraNotifToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showTamaraNotifToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-dark-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">Webhook URL:</span> POST /api/payments/tamara-webhook</p>
        </div>

        <TestResult provider="tamara" />
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Settings
        </button>
        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            Saved successfully
          </span>
        )}
      </div>
    </div>
  )
}
