import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector, useDispatch } from 'react-redux'
import { 
  ShieldCheck, 
  Building2, 
  KeyRound, 
  Loader2, 
  CheckCircle2, 
  WifiOff, 
  Save, 
  Landmark, 
  FileText, 
  QrCode, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Check, 
  HelpCircle,
  TrendingUp,
  Globe
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { isPakistanTenant } from '../../lib/saudiTenant'
import { getMe } from '../../store/slices/authSlice'

const PROVINCES = [
  'Sindh',
  'Punjab',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu and Kashmir'
]

export default function FbrDashboard() {
  const dispatch = useDispatch()
  const { tenant } = useSelector((state) => state.auth)
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const allowed = isPakistanTenant(tenant)

  const [showToken, setShowToken] = useState(false)
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
      toast.success(isAr ? 'تم حفظ إعدادات FBR بنجاح' : 'FBR settings saved successfully')
      queryClient.invalidateQueries({ queryKey: ['fbr-config'] })
      await dispatch(getMe())
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Save failed'),
  })

  const testMutation = useMutation({
    mutationFn: () => api.post('/tenant/compliance/config/fbr/test-connection').then((r) => r.data),
    onSuccess: async (res) => {
      toast.success(res?.message || (isAr ? 'الاتصال مع FBR ناجح' : 'FBR connection successful'))
      queryClient.invalidateQueries({ queryKey: ['fbr-config'] })
      await dispatch(getMe())
    },
    onError: (err) => toast.error(err?.response?.data?.error || err.message || 'Test failed'),
  })

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 px-6">
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-6 shadow-sm">
          <Landmark className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
          {isAr ? 'غير متاح لعملة منشأتك' : 'Not Available for Your Currency'}
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          {isAr
            ? 'تكامل FBR ينطبق فقط على المنشآت بعملة الروبية الباكستانية (PKR). يمكنك تغيير العملة الافتراضية من شاشة الإعدادات العامة.'
            : 'FBR Digital Invoicing applies exclusively to PKR tenants. Update your default currency to PKR in Settings to activate this portal.'}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-emerald-600" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Loading FBR Workspace…</p>
      </div>
    )
  }

  const status = data?.fbr?.connectionStatus || 'disconnected'
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const invoicesPosted = data?.fbr?.invoiceCounter || 0

  const isConnected = status === 'connected'
  const isActionRequired = status === 'action_required'

  return (
    <div className="space-y-7 max-w-5xl pb-20 mx-auto">
      
      {/* ─── 1. Ultra-Premium Light Hero Card ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50/90 via-white to-slate-50/90 border border-emerald-100/90 p-7 md:p-9 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-teal-100/30 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-16 h-16 shrink-0 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 ring-4 ring-emerald-50">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-100/80 text-emerald-800 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Pakistan · PKR
                </span>
                <span className="text-xs text-slate-400 font-medium">Federal Board of Revenue</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                FBR Digital Invoicing
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                Full Pakistan tax compliance with NTN/STRN verification, standard 18% sales tax, cryptographic FBR QR generation, and automated IRIS Digital Invoicing posting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-2.5 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Posted</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{invoicesPosted}</p>
            </div>
            <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-2.5 text-center shadow-sm min-w-[8.5rem]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gateway Status</p>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : isActionRequired ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <p className={`text-xs font-bold ${isConnected ? 'text-emerald-700' : isActionRequired ? 'text-amber-700' : 'text-slate-600'}`}>
                  {isConnected ? 'Active & Ready' : isActionRequired ? 'Action Required' : 'Disconnected'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Metric Overview Pills ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm flex items-center gap-4 transition hover:border-emerald-200 hover:shadow-md">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Integration Health</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {isConnected ? 'Live / Sandbox Ready' : isActionRequired ? 'Configure NTN to start' : 'Not configured'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm flex items-center gap-4 transition hover:border-emerald-200 hover:shadow-md">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Default Sales Tax</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {form.defaultSalesTaxRate}% (Standard Rate)
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm flex items-center gap-4 transition hover:border-emerald-200 hover:shadow-md">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Gateway Environment</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5 capitalize">
              {form.environment} Mode
            </p>
          </div>
        </div>
      </div>

      {/* ─── 3. Seller Tax Identity Card ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Seller Tax Identity & Compliance</h3>
              <p className="text-xs text-slate-500">Business tax credentials used for digital invoice generation and FBR verification</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              NTN (National Tax Number) <span className="text-rose-500">*</span>
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.ntn} 
              onChange={(e) => update('ntn', e.target.value)} 
              placeholder="e.g. 1234567-8" 
            />
            <p className="text-[11px] text-slate-400 mt-1">Required 7-digit registration number</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              STRN (Sales Tax Registration Number)
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.strn} 
              onChange={(e) => update('strn', e.target.value)} 
              placeholder="e.g. 00-00-0000-000-00 (optional)" 
            />
            <p className="text-[11px] text-slate-400 mt-1">Printed on tax invoices when applicable</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              CNIC (Sole Proprietor / Individual)
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.cnic} 
              onChange={(e) => update('cnic', e.target.value)} 
              placeholder="xxxxx-xxxxxxx-x" 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              POS ID (Tier-1 Retail Registration)
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.posId} 
              onChange={(e) => update('posId', e.target.value)} 
              placeholder="e.g. POS-100234"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Province / Jurisdiction
            </label>
            <select 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.province} 
              onChange={(e) => update('province', e.target.value)}
            >
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default HS Code
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.defaultHsCode} 
              onChange={(e) => update('defaultHsCode', e.target.value)} 
              placeholder="0000.0000"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Default Sales Tax Rate (%)
            </label>
            <input 
              type="number" 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.defaultSalesTaxRate} 
              onChange={(e) => update('defaultSalesTaxRate', Number(e.target.value))} 
              min={0} 
              max={100} 
            />
            <p className="text-[11px] text-slate-400 mt-1">Standard Federal rate is 18%</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Scenario ID (Sandbox Testing)
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.scenarioId} 
              onChange={(e) => update('scenarioId', e.target.value)} 
              placeholder="e.g. SN001" 
            />
          </div>
        </div>

        {/* Custom Toggle Switches */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Auto-generate FBR QR Codes</p>
                <p className="text-[11px] text-slate-500">Automatically attach compliant FBR QR codes to invoices and receipts</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={form.autoGenerateQr} 
              onChange={(e) => update('autoGenerateQr', e.target.checked)} 
              className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 border-slate-300"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Auto-post to FBR Digital Invoicing</p>
                <p className="text-[11px] text-slate-500">Post finalized sales invoices to FBR DI gateway on approval</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={form.autoSubmit} 
              onChange={(e) => update('autoSubmit', e.target.checked)} 
              className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 border-slate-300"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Enable FBR Integration Suite</p>
                <p className="text-[11px] text-slate-500">Keep FBR compliance workflows active across the entire system</p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={form.isEnabled} 
              onChange={(e) => update('isEnabled', e.target.checked)} 
              className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 border-slate-300"
            />
          </label>
        </div>
      </div>

      {/* ─── 4. API Credentials Card ────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">FBR Digital Invoicing Gateway Credentials</h3>
              <p className="text-xs text-slate-500">Connect to FBR Sandbox or Production IRIS DI server</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100/80 p-4 text-xs text-emerald-900 leading-relaxed flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Sandbox Mode:</span> Generates valid local FBR QR codes & invoice references immediately without needing a live token.
            <br />
            <span className="font-bold">Production Mode:</span> Requires a live Bearer Token issued by FBR IRIS Digital Invoicing portal.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Environment
            </label>
            <select 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.environment} 
              onChange={(e) => update('environment', e.target.value)}
            >
              <option value="sandbox">Sandbox (Testing / Local QR)</option>
              <option value="production">Production (Live IRIS DI)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              API Base URL (Optional Override)
            </label>
            <input 
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={form.apiBaseUrl} 
              onChange={(e) => update('apiBaseUrl', e.target.value)} 
              placeholder="https://gw.fbr.gov.pk/…" 
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Bearer Token (IRIS DI Authorization)
            </label>
            <div className="relative">
              <input 
                type={showToken ? 'text' : 'password'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-11 text-sm font-mono text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                value={form.apiToken} 
                onChange={(e) => update('apiToken', e.target.value)} 
                placeholder={data?.fbr?.hasApiToken ? '•••••••••••••••• (Stored securely in database)' : 'Paste your IRIS Bearer Token here'} 
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. Sticky / High-Visibility Action Bar ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="text-xs text-slate-400 font-medium">
          {form.ntn ? `Configured for NTN: ${form.ntn}` : 'Enter your NTN to enable compliance'}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-800 px-5 py-2.5 text-sm font-bold shadow-sm hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-50 transition"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            Test Connection
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-6 py-2.5 text-sm font-bold shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save FBR Settings
          </button>
        </div>
      </div>

    </div>
  )
}
