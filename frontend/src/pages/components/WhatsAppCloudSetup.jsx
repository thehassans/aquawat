import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BadgeCheck,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Webhook,
  AlertTriangle,
  Building2,
  ArrowLeft,
  Smartphone,
  Link2,
  Send,
  MessageCircle,
} from 'lucide-react'
import api from '../../lib/api'
import { App3DIcon } from '../../components/ui/App3DIcon'
import WhatsAppConnect from './WhatsAppConnect'

const MODE_KEY = 'maqder-whatsapp-setup-mode'

const DOCS = {
  getStarted: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  phone: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/add-a-phone-number',
  tokens: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#access-tokens',
  webhooks: 'https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components',
  templates: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates',
  send: 'https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages',
  apps: 'https://developers.facebook.com/apps/',
  business: 'https://business.facebook.com/latest/settings',
  systemUsers: 'https://business.facebook.com/latest/settings/system_users',
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600/40 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400'

function CopyField({ label, value, ar, language }) {
  const copy = async () => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    toast.success(language === 'ar' ? 'تم النسخ' : 'Copied')
  }
  return (
    <div>
      <label className={labelClass}>{language === 'ar' ? ar : label}</label>
      <div className="flex gap-2">
        <input readOnly value={value || ''} className={`${inputClass} font-mono text-[13px]`} />
        <button type="button" onClick={copy} className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function DocLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

function QualityChip({ rating }) {
  const value = String(rating || '').toUpperCase()
  const tone = value === 'GREEN'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : value === 'YELLOW'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : value === 'RED'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : 'bg-slate-50 text-slate-500 ring-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ${tone}`}>
      {value || '—'}
    </span>
  )
}

export default function WhatsAppCloudSetup({ language, onOpenInbox }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) || 'choose' } catch { return 'choose' }
  })
  const [step, setStep] = useState(0)
  const [qrStep, setQrStep] = useState(0)
  const [testPhone, setTestPhone] = useState('')
  const [form, setForm] = useState({
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    appSecret: '',
    metaAppId: '',
    autoSendInvoices: true,
    autoSendQuotations: true,
    autoNotifyOrderStatus: true,
  })

  const { data: config, isLoading } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => api.get('/whatsapp/config').then((r) => r.data),
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.get('/whatsapp/templates').then((r) => r.data),
  })

  const { data: qrStatus } = useQuery({
    queryKey: ['whatsapp-client-status'],
    queryFn: () => api.get('/whatsapp/client/status').then((r) => r.data),
    refetchInterval: (query) => {
      const status = query?.state?.data?.status
      if (status === 'INITIALIZING' || status === 'QR_READY') return 2000
      return false
    },
  })

  useEffect(() => {
    if (!config) return
    setForm((prev) => ({
      ...prev,
      phoneNumberId: config.phoneNumberId || '',
      businessAccountId: config.businessAccountId || '',
      metaAppId: config.metaAppId || '',
      autoSendInvoices: config.autoSendInvoices !== false,
      autoSendQuotations: config.autoSendQuotations !== false,
      autoNotifyOrderStatus: config.autoNotifyOrderStatus !== false,
    }))
  }, [config])

  useEffect(() => {
    if (config?.connected && mode === 'choose') selectMode('official')
  }, [config?.connected, mode])

  const invoiceTemplates = useMemo(
    () => (templates || []).filter((t) => String(t.name || '').startsWith('maqder_invoice')),
    [templates]
  )
  const approvedInvoice = invoiceTemplates.some((t) => String(t.status).toLowerCase() === 'approved')
  const qrConnected = qrStatus?.status === 'READY' || qrStatus?.status === 'CONNECTED'

  const officialSteps = [
    { id: 'meta', icon: Building2, en: 'Meta Business & App', ar: 'حساب ميتا والتطبيق' },
    { id: 'phone', icon: Phone, en: 'WhatsApp phone & IDs', ar: 'رقم واتساب والمعرّفات' },
    { id: 'token', icon: KeyRound, en: 'Permanent access token', ar: 'رمز الوصول الدائم' },
    { id: 'connect', icon: ShieldCheck, en: 'Connect & test', ar: 'الربط والاختبار' },
    { id: 'webhook', icon: Webhook, en: 'Webhooks', ar: 'الويب هوك' },
    { id: 'templates', icon: FileText, en: 'Invoice templates', ar: 'قوالب الفواتير' },
    { id: 'auto', icon: Receipt, en: 'Auto-send & settings', ar: 'الإرسال التلقائي والإعدادات' },
  ]

  const qrSteps = [
    { id: 'intro', icon: Smartphone, en: 'How QR connect works', ar: 'كيف يعمل ربط رمز QR' },
    { id: 'phone', icon: Phone, en: 'Open WhatsApp on your phone', ar: 'افتح واتساب على الجوال' },
    { id: 'linked', icon: Link2, en: 'Linked devices', ar: 'الأجهزة المرتبطة' },
    { id: 'scan', icon: QrCode, en: 'Scan the QR code', ar: 'امسح رمز QR' },
    { id: 'auto', icon: Receipt, en: 'Auto-send & settings', ar: 'الإرسال التلقائي والإعدادات' },
  ]

  const officialDone = {
    0: true,
    1: Boolean(config?.phoneNumberId && config?.businessAccountId),
    2: Boolean(config?.hasAccessToken),
    3: Boolean(config?.connected),
    4: Boolean(config?.webhookVerifyToken),
    5: approvedInvoice,
    6: Boolean(config?.connected && config?.autoSendInvoices !== false),
  }

  const qrDone = {
    0: true,
    1: qrStep > 0 || qrConnected,
    2: qrStep > 1 || qrConnected,
    3: qrConnected,
    4: Boolean(form.autoSendInvoices || form.autoSendQuotations),
  }

  const selectMode = (next) => {
    setMode(next)
    setStep(0)
    setQrStep(0)
    try { localStorage.setItem(MODE_KEY, next) } catch {}
  }

  const saveConfig = useMutation({
    mutationFn: (payload) => api.put('/whatsapp/config', payload),
    onSuccess: (res) => {
      queryClient.setQueryData(['whatsapp-config'], res.data)
      queryClient.invalidateQueries(['whatsapp-config'])
    },
  })

  const testConnection = useMutation({
    mutationFn: () => api.post('/whatsapp/config/test'),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم الاتصال بنجاح' : 'Connected successfully')
      queryClient.setQueryData(['whatsapp-config'], res.data.config)
      queryClient.invalidateQueries(['whatsapp-config'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل الاتصال' : 'Connection failed'))
    },
  })

  const createTemplates = useMutation({
    mutationFn: () => api.post('/whatsapp/cloud/ensure-default-templates'),
    onSuccess: (res) => {
      const created = res.data?.results?.filter((r) => r.status === 'created')?.length || 0
      const existing = res.data?.results?.filter((r) => r.status === 'exists')?.length || 0
      toast.success(
        isAr
          ? `تم إرسال ${created} قالب إلى ميتا (الموجود سابقاً: ${existing})`
          : `Submitted ${created} templates to Meta (${existing} already existed)`
      )
      queryClient.invalidateQueries(['whatsapp-templates'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'تعذر إنشاء القوالب' : 'Could not create templates'))
    },
  })

  const syncTemplates = useMutation({
    mutationFn: () => api.post('/whatsapp/cloud/sync-templates'),
    onSuccess: (res) => {
      toast.success(isAr ? `تمت المزامنة: ${res.data?.count || 0} قالب` : `Synced ${res.data?.count || 0} templates`)
      queryClient.invalidateQueries(['whatsapp-templates'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'تعذر المزامنة' : 'Could not sync templates'))
    },
  })

  const sendTest = useMutation({
    mutationFn: () => api.post('/whatsapp/cloud/send-test-invoice', { phone: testPhone }),
    onSuccess: () => {
      toast.success(isAr ? 'تم إرسال الفاتورة التجريبية' : 'Test invoice sent')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'تعذر الإرسال' : 'Could not send'))
    },
  })

  const rotateWebhook = useMutation({
    mutationFn: () => api.put('/whatsapp/config', { rotateVerifyToken: true }),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم تجديد الرمز' : 'Token rotated')
      queryClient.setQueryData(['whatsapp-config'], res.data)
      queryClient.invalidateQueries(['whatsapp-config'])
    },
  })

  const handleSaveAndTest = async () => {
    try {
      await saveConfig.mutateAsync({
        phoneNumberId: form.phoneNumberId.trim(),
        businessAccountId: form.businessAccountId.trim(),
        accessToken: form.accessToken.trim(),
        appSecret: form.appSecret.trim(),
        metaAppId: form.metaAppId.trim(),
        provider: 'meta',
      })
      await testConnection.mutateAsync()
    } catch (err) {
      if (!testConnection.isError) {
        toast.error(err.response?.data?.error || (isAr ? 'تعذر الحفظ' : 'Could not save'))
      }
    }
  }

  const persistAutomation = async (patch) => {
    const next = { ...form, ...patch }
    setForm(next)
    try {
      await saveConfig.mutateAsync({
        autoSendInvoices: next.autoSendInvoices,
        autoSendQuotations: next.autoSendQuotations,
        autoNotifyOrderStatus: next.autoNotifyOrderStatus,
      })
      toast.success(isAr ? 'حُفظت إعدادات الإرسال التلقائي' : 'Automation settings saved')
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'تعذر الحفظ' : 'Could not save'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c111a]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  const changeMethodButton = (
    <button
      type="button"
      onClick={() => selectMode('choose')}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-100 hover:border-slate-400 hover:shadow-md dark:border-white/15 dark:bg-dark-800 dark:text-slate-100 dark:hover:bg-dark-700"
    >
      <ArrowLeft className={`h-4 w-4 stroke-[2.5] text-slate-600 dark:text-slate-300 ${isAr ? 'rotate-180' : ''}`} />
      <span>{isAr ? 'تغيير طريقة الربط' : 'Change Connection Method'}</span>
    </button>
  )

  const shell = (sidebar, body) => (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white text-slate-900 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#0c111a] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08),transparent_42%)]" />
      <div className="relative grid gap-0 lg:grid-cols-[290px_1fr]">
        <aside className="border-b border-slate-100 bg-slate-50/70 p-6 lg:border-b-0 lg:border-e lg:border-slate-100 dark:border-white/5 dark:bg-dark-900/50">
          {sidebar}
        </aside>
        <section className="min-h-[70vh] p-6 sm:p-8">{body}</section>
      </div>
    </div>
  )

  const brandHeader = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0">
          <App3DIcon appId="whatsapp_cloud_auto" icon="whatsapp" label="WhatsApp" className="h-12 w-12" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400">
            {isAr ? 'متجر التطبيقات' : 'App Store'}
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{isAr ? 'واتساب' : 'WhatsApp'}</h1>
        </div>
      </div>

      <button
        type="button"
        onClick={() => selectMode('choose')}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300 dark:hover:bg-dark-700 transition"
      >
        <ArrowLeft className={`h-3.5 w-3.5 stroke-[2.5] ${isAr ? 'rotate-180' : ''}`} />
        <span>{isAr ? 'تغيير طريقة الربط' : 'Change Method'}</span>
      </button>
    </div>
  )

  if (mode === 'choose') {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-6 py-10 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)] sm:px-10 dark:border-white/10 dark:bg-[#0c111a]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.09),transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto h-16 w-16">
            <App3DIcon appId="whatsapp_cloud_auto" icon="whatsapp" label="WhatsApp" className="h-16 w-16" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400">
            {isAr ? 'الخطوة الأولى' : 'Step 1 · Choose how to connect'}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'كيف تريد ربط واتساب؟' : 'How do you want to connect WhatsApp?'}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {isAr
              ? 'اختر المسار المناسب. واجهة ميتا الرسمية لإرسال الفواتير وعروض الأسعار التلقائية، أو رمز QR للربط السريع من تطبيق الجوال.'
              : 'Pick your path. Official Meta Cloud API for automated invoices & quotations, or a QR scan to link your phone directly.'}
          </p>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          {/* Official Meta API */}
          <button
            type="button"
            onClick={() => selectMode('official')}
            className="group rounded-[24px] border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_20px_40px_-28px_rgba(5,150,105,0.55)] dark:border-emerald-500/20 dark:from-emerald-950/20 dark:to-dark-800"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {isAr ? 'المعتمد والموصى به' : 'Official · Recommended'}
              </span>
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              {isAr ? 'واجهة Meta Cloud API الرسمية' : 'Official Meta Cloud API'}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? 'اربط حساب WhatsApp Business الرسمي عبر ميتا. يتيح إرسال الفواتير وعروض الأسعار تلقائياً ومزامنة القوالب المعتمدة.'
                : 'Connect via Meta developer app & permanent token. Auto-sends invoices, quotations, and syncs approved templates.'}
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span>{isAr ? 'بدء إعداد Cloud API' : 'Setup Cloud API'}</span>
              <ChevronRight className={`h-4 w-4 transition group-hover:translate-x-1 ${isAr ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* QR Scan */}
          <button
            type="button"
            onClick={() => selectMode('qr')}
            className="group rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-dark-800"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-white/10 dark:text-slate-300">
                {isAr ? 'ربط سريع' : 'Fast Setup'}
              </span>
              <QrCode className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              {isAr ? 'مسح رمز QR من الجوال' : 'Scan QR code from phone'}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? 'امسح الرمز من تطبيق واتساب على هاتفك مباشرة. بدون الحاجة لحساب مطوّرين في ميتا، مع دعم صندوق المحادثات والإرسال الفوري.'
                : 'Scan directly from your phone’s Linked Devices. No Meta developer account needed; supports inbox chat and direct sending.'}
            </p>
            <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{isAr ? 'بدء ربط رمز QR' : 'Setup via QR'}</span>
              <ChevronRight className={`h-4 w-4 transition group-hover:translate-x-1 ${isAr ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </div>
      </div>
    )
  }

  // QR Mode Shell
  if (mode === 'qr') {
    return shell(
      <>
        {brandHeader}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isAr
            ? 'اربط تطبيق واتساب على جوالك مباشرة لمحادثات الصندوق والإرسال السريع.'
            : 'Link the WhatsApp app on your phone for inbox messaging and fast sharing.'}
        </p>
        {qrConnected ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              {isAr ? 'الجوال متصل بنجاح' : 'Phone linked & ready'}
            </div>
            {onOpenInbox ? (
              <button type="button" onClick={onOpenInbox} className="mt-3 w-full rounded-xl bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                {isAr ? 'فتح صندوق الوارد' : 'Open inbox'}
              </button>
            ) : null}
          </div>
        ) : null}

        <ol className="mt-6 space-y-1">
          {qrSteps.map((item, index) => {
            const Icon = item.icon
            const active = qrStep === index
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setQrStep(index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-dark-800 dark:text-white dark:ring-white/10'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-dark-800/60 dark:hover:text-white'
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${qrDone[index] ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-white text-slate-400 dark:bg-dark-700 dark:text-slate-400'}`}>
                    {qrDone[index] ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 font-medium">{isAr ? item.ar : item.en}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {/* Change Method Action */}
        <div className="mt-8 pt-4 border-t border-slate-200/80 dark:border-white/10">
          {changeMethodButton}
        </div>
      </>,
      <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-400">
              {isAr ? `الخطوة ${qrStep + 1} من ${qrSteps.length}` : `Step ${qrStep + 1} of ${qrSteps.length}`}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{isAr ? qrSteps[qrStep].ar : qrSteps[qrStep].en}</h2>
          </div>
        </div>

        <AnimateStep step={qrStep}>
          {qrStep === 0 && (
            <GuideCard title={isAr ? 'ربط سريع من الجوال' : 'A quick link from your phone'}>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr
                  ? 'يستخدم مقدر جلسة واتساب ويب على الخادم. تمسح الرمز مرة واحدة من الجوال، ثم يمكنك إرسال الفواتير وعروض الأسعار والتواصل مع العملاء.'
                  : 'Maqder keeps a WhatsApp session on the server. Scan once from your phone to send invoices, quotations, and chat with clients.'}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{isAr ? 'لا تحتاج حساب مطوّرين في ميتا' : 'No Meta developer account required'}</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{isAr ? 'مناسب للمحادثات، الفواتير وعروض الأسعار' : 'Instant invoice & quotation dispatching'}</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{isAr ? 'إرسال بنقرة واحدة من صفحة الفاتورة وعرض السعر' : '1-click send from Invoice and Quotation views'}</li>
              </ul>
            </GuideCard>
          )}

          {qrStep === 1 && (
            <GuideCard title={isAr ? 'جهّز الجوال' : 'Prepare your phone'}>
              <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <li>{isAr ? 'افتح تطبيق واتساب على نفس الرقم الذي تريد ربطه.' : 'Open the WhatsApp app on the phone number you want to link.'}</li>
                <li>{isAr ? 'تأكد أن الجوال متصل بالإنترنت بشكل جيد.' : 'Keep the phone online on Wi-Fi or mobile data.'}</li>
                <li>{isAr ? 'لا تغلق واتساب أثناء المسح.' : 'Do not close WhatsApp while scanning.'}</li>
              </ol>
            </GuideCard>
          )}

          {qrStep === 2 && (
            <GuideCard title={isAr ? 'افتح الأجهزة المرتبطة' : 'Open Linked devices'}>
              <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <li>{isAr ? 'اضغط القائمة ⋮ أو الإعدادات في واتساب.' : 'Tap the menu ⋮ or Settings in WhatsApp.'}</li>
                <li>{isAr ? 'اختر الأجهزة المرتبطة (Linked Devices).' : 'Choose Linked Devices.'}</li>
                <li>{isAr ? 'اضغط "ربط جهاز" ثم وجّه الكاميرا نحو الرمز في الخطوة التالية.' : 'Tap "Link a device", then scan the code on the next step.'}</li>
              </ol>
            </GuideCard>
          )}

          {qrStep === 3 && (
            <GuideCard title={isAr ? 'امسح الرمز أدناه' : 'Scan the code below'}>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                {isAr
                  ? 'اضغط توليد الرمز إن لم يظهر، ثم امسحه من الجوال. يتم التحديث فورياً.'
                  : 'Generate the code if it is not visible, then scan it from your phone.'}
              </p>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-dark-800/80">
                <WhatsAppConnect variant="setup" />
              </div>
            </GuideCard>
          )}

          {qrStep === 4 && (
            <GuideCard title={isAr ? 'إعدادات الإرسال التلقائي' : 'Auto-send & notification settings'}>
              <label className="flex items-center justify-between gap-6 border-b border-slate-100 py-4 dark:border-white/10">
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">
                    {isAr ? 'إرسال الفاتورة تلقائياً عند الإصدار أو التوقيع' : 'Auto-send Invoice on approval or ZATCA sign'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {isAr ? 'إرسال رابط الفاتورة والبيانات تلقائياً لرقم العميل عبر واتساب.' : 'Automatically dispatch invoice link to customer via WhatsApp.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.autoSendInvoices}
                  onChange={(e) => persistAutomation({ autoSendInvoices: e.target.checked })}
                  className="h-4 w-4 accent-emerald-800"
                />
              </label>

              <label className="flex items-center justify-between gap-6 border-b border-slate-100 py-4 dark:border-white/10">
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">
                    {isAr ? 'إرسال عرض السعر تلقائياً عند الإنشاء أو الاعتماد' : 'Auto-send Quotation on creation or approval'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {isAr ? 'إرسال رابط عرض السعر للمراجعة مباشرة للعميل.' : 'Automatically dispatch quotation review link to customer.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.autoSendQuotations}
                  onChange={(e) => persistAutomation({ autoSendQuotations: e.target.checked })}
                  className="h-4 w-4 accent-emerald-800"
                />
              </label>

              <label className="flex items-center justify-between gap-6 py-4">
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">
                    {isAr ? 'إشعارات الطلبات المباشرة' : 'Order-status notifications'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {isAr ? 'إرسال إشعار عند استلام أو جاهزية الطلب.' : 'When an order is placed, ready, or served.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.autoNotifyOrderStatus}
                  onChange={(e) => persistAutomation({ autoNotifyOrderStatus: e.target.checked })}
                  className="h-4 w-4 accent-emerald-800"
                />
              </label>
            </GuideCard>
          )}
        </AnimateStep>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            disabled={qrStep === 0}
            onClick={() => setQrStep((s) => Math.max(0, s - 1))}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
          >
            {isAr ? 'السابق' : 'Back'}
          </button>
          {qrStep < qrSteps.length - 1 ? (
            <button
              type="button"
              onClick={() => setQrStep((s) => s + 1)}
              className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {isAr ? 'التالي' : 'Continue'}
            </button>
          ) : qrConnected && onOpenInbox ? (
            <button
              type="button"
              onClick={onOpenInbox}
              className="rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {isAr ? 'الذهاب إلى الصندوق' : 'Go to inbox'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => selectMode('official')}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {isAr ? 'التبديل إلى الربط الرسمي (Cloud API)' : 'Switch to official Cloud API'}
            </button>
          )}
        </div>
      </>
    )
  }

  // Official Meta Cloud API Shell
  return shell(
    <>
      {brandHeader}
      <p className="mt-1 text-xs text-slate-400">{isAr ? 'واجهة Cloud API الرسمية · Graph v21.0' : 'Official Cloud API · Graph v21.0'}</p>
      {config?.connected ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <BadgeCheck className="h-4 w-4" />
            {isAr ? 'متصل' : 'Connected'}
          </div>
          <p className="mt-1 font-mono text-sm text-slate-900 dark:text-white">{config.displayPhoneNumber || config.phoneNumberId}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{config.verifiedName || config.businessName}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{isAr ? 'الجودة' : 'Quality'}</span>
            <QualityChip rating={config.qualityRating} />
          </div>
          {onOpenInbox ? (
            <button type="button" onClick={onOpenInbox} className="mt-3 w-full rounded-xl bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {isAr ? 'فتح صندوق الوارد' : 'Open inbox'}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {isAr
            ? 'اتبع وثائق ميتا الرسمية. هذا المسار هو المعتمد لإرسال فواتير وعروض أسعار الأعمال.'
            : 'Follow Meta’s official docs. This is the supported path for automated invoice delivery.'}
        </p>
      )}

      <ol className="mt-6 space-y-1">
        {officialSteps.map((item, index) => {
          const Icon = item.icon
          const active = step === index
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setStep(index)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-dark-800 dark:text-white dark:ring-white/10'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-dark-800/60 dark:hover:text-white'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${officialDone[index] ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-white text-slate-400 dark:bg-dark-700 dark:text-slate-400'}`}>
                  {officialDone[index] ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="flex-1 font-medium">{isAr ? item.ar : item.en}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Change Method Action */}
      <div className="mt-8 pt-4 border-t border-slate-200/80 dark:border-white/10">
        {changeMethodButton}
      </div>
    </>,
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-400">
            {isAr ? `الخطوة ${step + 1} من ${officialSteps.length}` : `Step ${step + 1} of ${officialSteps.length}`}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{isAr ? officialSteps[step].ar : officialSteps[step].en}</h2>
        </div>
        <DocLink href={DOCS.getStarted}><BookOpen className="h-3.5 w-3.5" /> {isAr ? 'وثائق Cloud API' : 'Cloud API docs'}</DocLink>
      </div>

      {config?.lastHealthError && step === 3 ? (
        <div className="mb-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {config.lastHealthError}
        </div>
      ) : null}

      <AnimateStep step={step}>
        {step === 0 && (
          <GuideCard title={isAr ? 'أنشئ محفظة أعمال وتطبيق مطوّرين' : 'Create a Meta Business portfolio and developer app'}>
            <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <li>
                {isAr ? 'افتح إعدادات Business Manager وأكمل التحقق من النشاط.' : 'Open Meta Business settings and complete business verification.'}
                {' '}<DocLink href={DOCS.business}>{isAr ? 'إعدادات الأعمال' : 'Business settings'}</DocLink>
              </li>
              <li>
                {isAr ? 'من لوحة المطوّرين أنشئ تطبيقاً من نوع Business وأضف منتج WhatsApp.' : 'In Meta for Developers create a Business-type app and add the WhatsApp product.'}
                {' '}<DocLink href={DOCS.apps}>{isAr ? 'تطبيقاتي' : 'My Apps'}</DocLink>
              </li>
              <li>{isAr ? 'لا ترسل فواتير حقيقية من أرقام الاختبار التجريبية. انقل التطبيق إلى Live بعد مراجعته.' : 'Do not send live customer invoices from test numbers. Move the app Live after review.'}</li>
            </ol>
            <p className="mt-4 text-xs text-slate-400">
              {isAr ? 'الصلاحيات المطلوبة: whatsapp_business_messaging و whatsapp_business_management.' : 'You will grant whatsapp_business_messaging and whatsapp_business_management.'}
            </p>
          </GuideCard>
        )}

        {step === 1 && (
          <GuideCard title={isAr ? 'أدخل معرّف رقم الهاتف وحساب الأعمال' : 'Enter Phone Number ID and Business Account ID'}>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {isAr
                ? 'تجد هذه المعرّفات في صفحة WhatsApp > API Setup داخل تطبيق المطوّرين في ميتا.'
                : 'Find these IDs under WhatsApp > API Setup in your Meta developer app.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{isAr ? 'Phone Number ID' : 'Phone Number ID'}</label>
                <input className={inputClass} value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="10xxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className={labelClass}>{isAr ? 'WhatsApp Business Account ID' : 'Business Account ID'}</label>
                <input className={inputClass} value={form.businessAccountId} onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })} placeholder="10xxxxxxxxxxxxxxx" />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>{isAr ? 'App ID (اختياري)' : 'Meta App ID (optional)'}</label>
              <input className={inputClass} value={form.metaAppId} onChange={(e) => setForm({ ...form, metaAppId: e.target.value })} placeholder="xxxxxxxxxxxxxxx" />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <DocLink href={DOCS.phone}>{isAr ? 'إضافة رقم هاتف' : 'Add phone number'}</DocLink>
              <button type="button" onClick={handleSaveAndTest} disabled={saveConfig.isPending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}
              </button>
            </div>
          </GuideCard>
        )}

        {step === 2 && (
          <GuideCard title={isAr ? 'أنشئ رمز وصول دائم عبر System User' : 'Generate a permanent token via a System User'}>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? 'رموز الاختبار المؤقتة تنتهي خلال 24 ساعة. لفواتير مستقرة، أنشئ مستخدم نظام (System User) بصلاحية Admin ثم ولّد رمزا غير منتهي.'
                : 'Temporary tokens expire in 24 hours. For reliable invoicing, create an Admin System User and generate a permanent token.'}
            </p>
            <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-slate-600 dark:text-slate-300">
              <li>{isAr ? 'افتح إعدادات الأعمال > System Users.' : 'Open Business Settings > System Users.'}</li>
              <li>{isAr ? 'أضف مستخدماً وعيّن له التطبيق بصلاحية Full Control.' : 'Add a user and assign the app with Full Control.'}</li>
              <li>{isAr ? 'اضغط Generate New Token واختر الصلاحيتين: whatsapp_business_messaging و whatsapp_business_management.' : 'Click Generate Token and select whatsapp_business_messaging and whatsapp_business_management.'}</li>
            </ol>
            <div className="mt-5 space-y-4">
              <div>
                <label className={labelClass}>{isAr ? 'رمز الوصول الدائم (EAAG...)' : 'Permanent access token (EAAG...)'}</label>
                <input type="password" className={inputClass} value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder={config?.hasAccessToken ? '•••••••• (محفوظ)' : 'EAAG...'} />
              </div>
              <div>
                <label className={labelClass}>{isAr ? 'App Secret للتحقق من توقيع الويب هوك' : 'App Secret (for webhook signature verification)'}</label>
                <input type="password" className={inputClass} value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder={config?.hasAppSecret ? '•••••••• (محفوظ)' : 'App secret from App Settings > Basic'} />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <DocLink href={DOCS.systemUsers}>{isAr ? 'مستخدمو النظام' : 'System users'}</DocLink>
              <button type="button" onClick={handleSaveAndTest} disabled={saveConfig.isPending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}
              </button>
            </div>
          </GuideCard>
        )}

        {step === 3 && (
          <GuideCard title={isAr ? 'التحقق من الاتصال برقم واتساب' : 'Verify connection to your WhatsApp phone'}>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? 'يفحص مقدر صحة الرمز والمعرّفات عبر واجهة ميتا الرسمية ويجلب اسم الحساب وجودة الرقم.'
                : 'Maqder queries Meta Graph API to verify the token, phone ID, quality rating, and verified display name.'}
            </p>
            <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <span className="block text-xs text-slate-400">{isAr ? 'حالة الاتصال' : 'Status'}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{config?.connected ? (isAr ? 'متصل بنجاح' : 'Connected') : (isAr ? 'غير متصل' : 'Not connected')}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400">{isAr ? 'الرقم المعروض' : 'Display phone'}</span>
                  <span className="font-mono text-slate-900 dark:text-white">{config?.displayPhoneNumber || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400">{isAr ? 'الاسم المعتمد' : 'Verified name'}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{config?.verifiedName || config?.businessName || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400">{isAr ? 'تقييم الجودة' : 'Quality'}</span>
                  <QualityChip rating={config?.qualityRating} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <DocLink href={DOCS.getStarted}>{isAr ? 'دليل البدء' : 'Get started guide'}</DocLink>
              <button type="button" onClick={() => testConnection.mutate()} disabled={testConnection.isPending} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                {testConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isAr ? 'إعادة الاختبار' : 'Test connection'}
              </button>
            </div>
          </GuideCard>
        )}

        {step === 4 && (
          <GuideCard title={isAr ? 'تهيئة الويب هوك لاستقبال الرسائل وحالات التسليم' : 'Configure webhooks for inbound messages and delivery receipts'}>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? 'في تطبيق المطوّرين > WhatsApp > Configuration، أضف الرابط ورمز التحقق، ثم اشترك في حقل messages.'
                : 'In Meta Developer app > WhatsApp > Configuration, paste the Callback URL and Verify Token, then subscribe to the messages field.'}
            </p>
            <div className="mt-4 space-y-3">
              <CopyField language={language} label="Callback URL" ar="رابط الاستدعاء (Callback URL)" value={config?.webhookCallbackUrl} />
              <CopyField language={language} label="Verify Token" ar="رمز التحقق (Verify Token)" value={config?.webhookVerifyToken} />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <DocLink href={DOCS.webhooks}>{isAr ? 'وثائق الويب هوك' : 'Webhook docs'}</DocLink>
              <button type="button" onClick={() => rotateWebhook.mutate()} disabled={rotateWebhook.isPending} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-dark-800">
                {isAr ? 'تجديد Verify Token' : 'Rotate verify token'}
              </button>
            </div>
          </GuideCard>
        )}

        {step === 5 && (
          <GuideCard title={isAr ? 'قوالب الفواتير المعتمدة (Utility)' : 'Approved invoice utility templates'}>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isAr
                ? 'خارج نافذة 24 ساعة للخدمة، تشترط ميتا قالب UTILITY معتمد لإرسال الفواتير. يمكنك إنشاء القوالب الافتراضية بنقرة واحدة ومزامنتها.'
                : 'Outside the 24-hour service window, Meta requires an approved UTILITY template to deliver invoice PDFs.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => createTemplates.mutate()} disabled={createTemplates.isPending} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                {createTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAr ? 'إنشاء قوالب مقدر الافتراضية' : 'Create default templates'}
              </button>
              <button type="button" onClick={() => syncTemplates.mutate()} disabled={syncTemplates.isPending} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-dark-800">
                {syncTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isAr ? 'مزامنة القوالب من ميتا' : 'Sync templates from Meta'}
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {invoiceTemplates.map((t) => (
                <div key={t.id || t.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-dark-800">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.language} · {t.category}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    t.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : t.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </GuideCard>
        )}

        {step === 6 && (
          <GuideCard title={isAr ? 'تشغيل الإرسال التلقائي وتجربة الإرسال' : 'Turn on auto-send and try a live test'}>
            <label className="flex items-center justify-between gap-6 border-b border-slate-100 py-4 dark:border-white/10">
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{isAr ? 'إرسال PDF عند اعتماد أو توقيع الفاتورة' : 'Auto-send Invoice PDF on approval or ZATCA sign'}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{isAr ? 'إرسال الفاتورة تلقائياً للعميل عبر واتساب.' : 'Automatically dispatch invoice PDF link to customer on WhatsApp.'}</span>
              </span>
              <input type="checkbox" checked={form.autoSendInvoices} onChange={(e) => persistAutomation({ autoSendInvoices: e.target.checked })} className="h-4 w-4 accent-emerald-800" />
            </label>

            <label className="flex items-center justify-between gap-6 border-b border-slate-100 py-4 dark:border-white/10">
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{isAr ? 'إرسال عرض السعر تلقائياً عند الإنشاء أو الاعتماد' : 'Auto-send Quotation on creation or approval'}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{isAr ? 'إرسال رابط عرض السعر للمراجعة مباشرة للعميل.' : 'Automatically dispatch quotation review link to customer.'}</span>
              </span>
              <input type="checkbox" checked={form.autoSendQuotations} onChange={(e) => persistAutomation({ autoSendQuotations: e.target.checked })} className="h-4 w-4 accent-emerald-800" />
            </label>

            <label className="flex items-center justify-between gap-6 py-4">
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{isAr ? 'إشعار حالة الطلب' : 'Order-status notifications'}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{isAr ? 'عند استلام الطلب أو جاهزيته أو تقديمه.' : 'When an order is placed, ready, or served.'}</span>
              </span>
              <input type="checkbox" checked={form.autoNotifyOrderStatus} onChange={(e) => persistAutomation({ autoNotifyOrderStatus: e.target.checked })} className="h-4 w-4 accent-emerald-800" />
            </label>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
              <label className={labelClass}>{isAr ? 'رقم تجريبي (مثل 05xxxxxxxx)' : 'Test mobile (e.g. 05xxxxxxxx)'}</label>
              <div className="flex gap-2">
                <input className={inputClass} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="9665…" />
                <button type="button" onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !testPhone} className="shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                  {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إرسال تجربة' : 'Send test')}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">{isAr ? 'يُستخدم آخر فاتورة لديك كمرفق PDF.' : 'Uses your latest invoice as the PDF attachment.'}</p>
            </div>
          </GuideCard>
        )}
      </AnimateStep>

      <div className="mt-8 flex items-center justify-between">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white">
          {isAr ? 'السابق' : 'Back'}
        </button>
        {step < officialSteps.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => Math.min(officialSteps.length - 1, s + 1))} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            {isAr ? 'التالي' : 'Continue'}
          </button>
        ) : config?.connected && onOpenInbox ? (
          <button type="button" onClick={onOpenInbox} className="rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            {isAr ? 'الذهاب إلى الصندوق' : 'Go to inbox'}
          </button>
        ) : (
          <Link to="/app/dashboard/app-store" className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-dark-800">
            {isAr ? 'متجر التطبيقات' : 'App Store'}
          </Link>
        )}
      </div>
    </>
  )
}

function GuideCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-6 dark:border-white/10 dark:bg-dark-800/50">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function AnimateStep({ step, children }) {
  return (
    <motion.div
      key={step}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}
