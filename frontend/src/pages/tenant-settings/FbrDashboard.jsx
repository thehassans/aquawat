import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector, useDispatch } from 'react-redux'
import { ShieldCheck, Building2, KeyRound, Loader2, CheckCircle2, WifiOff, Save, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { isPakistanTenant } from '../../lib/saudiTenant'
import { getMe } from '../../store/slices/authSlice'

const PROVINCES = ['Sindh', 'Punjab', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir']

export default function FbrDashboard() {
  const dispatch = useDispatch()
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const allowed = isPakistanTenant(tenant)

  const [form, setForm] = useState({
    ntn: '',
    strn: '',
    cnic: '',
    posId: '',
    scenarioId: '',
    province: 'Sindh',
    defaultHsCode: '0000.0000',
    defaultSalesTaxRate: 18,
    autoGenerateQr: true,
    autoSubmit: true,
    environment: 'sandbox',
    apiBaseUrl: '',
    apiToken: '',
    isEnabled: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['fbr-config'],
    queryFn: () => api.get('/tenant/compliance/config/fbr').then((r) => r.data),
    enabled: allowed,
  })

  useEffect(() => {
    if (!data?.fbr) return
    setForm((prev) => ({
      ...prev,
      ntn: data.fbr.ntn || data.business?.ntn || data.business?.vatNumber || '',
      strn: data.fbr.strn || '',
      cnic: data.fbr.cnic || '',
      posId: data.fbr.posId || '',
      scenarioId: data.fbr.scenarioId || '',
      province: data.fbr.province || 'Sindh',
      defaultHsCode: data.fbr.defaultHsCode || '0000.0000',
      defaultSalesTaxRate: data.fbr.defaultSalesTaxRate ?? 18,
      autoGenerateQr: data.fbr.autoGenerateQr !== false,
      autoSubmit: data.fbr.autoSubmit !== false,
      environment: data.fbr.environment || 'sandbox',
      apiBaseUrl: data.fbr.apiBaseUrl || '',
      apiToken: '',
      isEnabled: data.fbr.isEnabled !== false,
    }))
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post('/tenant/compliance/config/fbr', payload).then((r) => r.data),
    onSuccess: async () => {
      toast.success(isAr ? 'تم حفظ إعدادات FBR' : 'FBR settings saved')
      queryClient.invalidateQueries({ queryKey: ['fbr-config'] })
      await dispatch(getMe())
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Save failed'),
  })

  const testMutation = useMutation({
    mutationFn: () => api.post('/tenant/compliance/config/fbr/test-connection').then((r) => r.data),
    onSuccess: async (res) => {
      toast.success(res?.message || (isAr ? 'الاتصال ناجح' : 'Connection OK'))
      queryClient.invalidateQueries({ queryKey: ['fbr-config'] })
      await dispatch(getMe())
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Test failed'),
  })

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-5">
          <Landmark className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {isAr ? 'غير متاح لعملة منشأتك' : 'Not available for your currency'}
        </h2>
        <p className="text-sm text-gray-500">
          {isAr
            ? 'تكامل FBR ينطبق فقط على المنشآت بعملة الروبية الباكستانية (PKR). غيّر العملة الافتراضية من الإعدادات.'
            : 'FBR Digital Invoicing applies only to PKR tenants. Set your default currency to PKR in Settings.'}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  const status = data?.fbr?.connectionStatus || 'disconnected'
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const invoicesPosted = data?.fbr?.invoiceCounter || 0

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-green-900 p-6 md:p-8 text-white shadow-2xl">
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <ShieldCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Pakistan · PKR</p>
              <h1 className="text-3xl font-black tracking-tight">FBR Digital Invoicing</h1>
              <p className="text-sm text-white/60 mt-1">NTN, STRN, 18% sales tax, FBR QR, and IRIS DI posting.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/15">
              <p className="text-[10px] uppercase tracking-widest text-white/50">Posted</p>
              <p className="text-xl font-black">{invoicesPosted}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/15 min-w-[8rem]">
              <p className="text-[10px] uppercase tracking-widest text-white/50">Status</p>
              <p className="text-sm font-bold mt-0.5">
                {status === 'connected' ? 'Connected' : status === 'action_required' ? 'Action required' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-slate-100 dark:border-dark-700">
          <p className="text-xs text-slate-500 mb-1">Connection</p>
          <div className="flex items-center gap-2 font-semibold">
            {status === 'connected' ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Live / sandbox ready</>
            ) : (
              <><WifiOff className="w-4 h-4 text-slate-400" /> {status === 'action_required' ? 'Save NTN to continue' : 'Not configured'}</>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-slate-100 dark:border-dark-700">
          <p className="text-xs text-slate-500 mb-1">Sales tax</p>
          <p className="font-semibold text-slate-900 dark:text-white">{form.defaultSalesTaxRate}%</p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 border border-slate-100 dark:border-dark-700">
          <p className="text-xs text-slate-500 mb-1">Environment</p>
          <p className="font-semibold text-slate-900 dark:text-white capitalize">{form.environment}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 space-y-5 border border-slate-100 dark:border-dark-700">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-600" />
          Seller tax identity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">NTN (National Tax Number)</label>
            <input className="input" value={form.ntn} onChange={(e) => update('ntn', e.target.value)} placeholder="1234567" />
          </div>
          <div>
            <label className="label">STRN (Sales Tax Registration)</label>
            <input className="input" value={form.strn} onChange={(e) => update('strn', e.target.value)} placeholder="optional" />
          </div>
          <div>
            <label className="label">CNIC (unregistered / sole prop)</label>
            <input className="input" value={form.cnic} onChange={(e) => update('cnic', e.target.value)} placeholder="xxxxx-xxxxxxx-x" />
          </div>
          <div>
            <label className="label">POS ID</label>
            <input className="input" value={form.posId} onChange={(e) => update('posId', e.target.value)} />
          </div>
          <div>
            <label className="label">Province</label>
            <select className="select" value={form.province} onChange={(e) => update('province', e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Default HS code</label>
            <input className="input" value={form.defaultHsCode} onChange={(e) => update('defaultHsCode', e.target.value)} />
          </div>
          <div>
            <label className="label">Default sales tax (%)</label>
            <input type="number" className="input" value={form.defaultSalesTaxRate} onChange={(e) => update('defaultSalesTaxRate', Number(e.target.value))} min={0} max={100} />
          </div>
          <div>
            <label className="label">Scenario ID (sandbox)</label>
            <input className="input" value={form.scenarioId} onChange={(e) => update('scenarioId', e.target.value)} placeholder="SN001" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.autoGenerateQr} onChange={(e) => update('autoGenerateQr', e.target.checked)} />
          Auto-generate FBR QR on invoices and POS receipts
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.autoSubmit} onChange={(e) => update('autoSubmit', e.target.checked)} />
          Auto-post approved sales invoices to FBR Digital Invoicing
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isEnabled} onChange={(e) => update('isEnabled', e.target.checked)} />
          Enable FBR posting
        </label>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 space-y-5 border border-slate-100 dark:border-dark-700">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-emerald-600" />
          FBR DI API credentials
        </h3>
        <p className="text-sm text-slate-500">
          Sandbox works without a token (local FBR reference + QR). Production posting needs a bearer token from IRIS Digital Invoicing.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Environment</label>
            <select className="select" value={form.environment} onChange={(e) => update('environment', e.target.value)}>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="label">API base URL (optional override)</label>
            <input className="input" value={form.apiBaseUrl} onChange={(e) => update('apiBaseUrl', e.target.value)} placeholder="https://gw.fbr.gov.pk/…" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Bearer token</label>
            <input className="input" type="password" value={form.apiToken} onChange={(e) => update('apiToken', e.target.value)} placeholder={data?.fbr?.hasApiToken ? '•••••••• (unchanged)' : ''} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2.5 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(form)}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 font-semibold hover:bg-slate-800 disabled:opacity-50"
          disabled={testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Test connection
        </button>
      </div>
    </div>
  )
}
