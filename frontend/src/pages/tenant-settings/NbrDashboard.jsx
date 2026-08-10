import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ShieldCheck, Building2, KeyRound, Loader2, CheckCircle2, WifiOff, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { isBangladeshTenant } from '../../lib/saudiTenant'

export default function NbrDashboard() {
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const allowed = isBangladeshTenant(tenant)

  const [form, setForm] = useState({
    binNumber: '',
    vatRegistrationNumber: '',
    mushakForm: '6.3',
    defaultVatRate: 15,
    autoGenerateQr: true,
    environment: 'sandbox',
    apiBaseUrl: '',
    apiKey: '',
    apiSecret: '',
    isEnabled: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['nbr-config'],
    queryFn: () => api.get('/tenant/compliance/config/nbr').then((r) => r.data),
    enabled: allowed,
  })

  useEffect(() => {
    if (!data?.nbr) return
    setForm((prev) => ({
      ...prev,
      binNumber: data.nbr.binNumber || data.business?.binNumber || '',
      vatRegistrationNumber: data.nbr.vatRegistrationNumber || data.business?.vatNumber || '',
      mushakForm: data.nbr.mushakForm || '6.3',
      defaultVatRate: data.nbr.defaultVatRate ?? 15,
      autoGenerateQr: data.nbr.autoGenerateQr !== false,
      environment: data.nbr.environment || 'sandbox',
      apiBaseUrl: data.nbr.apiBaseUrl || '',
      apiKey: '',
      apiSecret: '',
      isEnabled: data.nbr.isEnabled !== false,
    }))
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post('/tenant/compliance/config/nbr', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ إعدادات NBR' : 'NBR settings saved')
      queryClient.invalidateQueries({ queryKey: ['nbr-config'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Save failed'),
  })

  const testMutation = useMutation({
    mutationFn: () => api.post('/tenant/compliance/config/nbr/test-connection').then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res?.message || (isAr ? 'الاتصال ناجح' : 'Connection OK'))
      queryClient.invalidateQueries({ queryKey: ['nbr-config'] })
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Test failed'),
  })

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-5">
          <ShieldCheck className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {isAr ? 'غير متاح لعملة منشأتك' : 'Not available for your currency'}
        </h2>
        <p className="text-sm text-gray-500">
          {isAr
            ? 'تكامل NBR / Mushak ينطبق فقط على المنشآت بعملة التاكا البنغلاديشي (BDT). غيّر العملة الافتراضية من الإعدادات.'
            : 'NBR / Mushak e-invoicing applies only to BDT tenants. Set your default currency to BDT in Settings.'}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  const status = data?.nbr?.connectionStatus || 'disconnected'
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
          {isAr ? 'لوحة NBR / Mushak' : 'NBR / Mushak Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isAr
            ? 'امتثال هيئة الإيرادات الوطنية البنغلاديشية وفواتير ضريبة Mushak'
            : 'Bangladesh National Board of Revenue compliance & Mushak VAT invoicing'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <div className="flex items-center gap-2 font-semibold">
            {status === 'connected' ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Connected</>
            ) : (
              <><WifiOff className="w-4 h-4 text-gray-400" /> {status === 'action_required' ? 'Action required' : 'Disconnected'}</>
            )}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Mushak Form</p>
          <p className="font-semibold text-gray-900 dark:text-white">{form.mushakForm || '6.3'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Default VAT</p>
          <p className="font-semibold text-gray-900 dark:text-white">{form.defaultVatRate}%</p>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-600" />
          Business tax identity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">BIN (Business Identification Number)</label>
            <input className="input" value={form.binNumber} onChange={(e) => update('binNumber', e.target.value)} placeholder="123456789-0123" />
          </div>
          <div>
            <label className="label">VAT Registration Number</label>
            <input className="input" value={form.vatRegistrationNumber} onChange={(e) => update('vatRegistrationNumber', e.target.value)} />
          </div>
          <div>
            <label className="label">Mushak Form</label>
            <select className="select" value={form.mushakForm} onChange={(e) => update('mushakForm', e.target.value)}>
              <option value="6.3">Mushak 6.3 — Tax Invoice</option>
              <option value="6.4">Mushak 6.4 — Credit Note</option>
            </select>
          </div>
          <div>
            <label className="label">Default VAT Rate (%)</label>
            <input type="number" className="input" value={form.defaultVatRate} onChange={(e) => update('defaultVatRate', Number(e.target.value))} min={0} max={100} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.autoGenerateQr} onChange={(e) => update('autoGenerateQr', e.target.checked)} />
          Auto-generate NBR verification QR on POS receipts
        </label>
      </div>

      <div className="card p-6 space-y-5">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary-600" />
          NBR API credentials
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Environment</label>
            <select className="select" value={form.environment} onChange={(e) => update('environment', e.target.value)}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="label">API Base URL</label>
            <input className="input" value={form.apiBaseUrl} onChange={(e) => update('apiBaseUrl', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="label">API Key</label>
            <input className="input" type="password" value={form.apiKey} onChange={(e) => update('apiKey', e.target.value)} placeholder={data?.nbr?.hasApiKey ? '•••••••• (unchanged)' : ''} />
          </div>
          <div>
            <label className="label">API Secret</label>
            <input className="input" type="password" value={form.apiSecret} onChange={(e) => update('apiSecret', e.target.value)} placeholder={data?.nbr?.hasApiSecret ? '•••••••• (unchanged)' : ''} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-primary flex items-center gap-2"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(form)}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save NBR Settings
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
          Test Connection
        </button>
      </div>
    </div>
  )
}
