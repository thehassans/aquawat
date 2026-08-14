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
    { id: 'auto', icon: Receipt, en: 'Auto-send invoices', ar: 'إرسال الفواتير تلقائياً' },
  ]

  const qrSteps = [
    { id: 'intro', icon: Smartphone, en: 'How QR connect works', ar: 'كيف يعمل ربط رمز QR' },
    { id: 'phone', icon: Phone, en: 'Open WhatsApp on your phone', ar: 'افتح واتساب على الجوال' },
    { id: 'linked', icon: Link2, en: 'Linked devices', ar: 'الأجهزة المرتبطة' },
    { id: 'scan', icon: QrCode, en: 'Scan the QR code', ar: 'امسح رمز QR' },
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
  }

  const selectMode = (next) => {
    setMode(next)
    setStep(0)
    setQrStep(0)
    try { localStorage.setItem(MODE_KEY, next) } catch { /* ignore */ }
  }

  const saveConfig = useMutation({
    mutationFn: (payload) => api.put('/whatsapp/config', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] }),
  })

  const testConnection = useMutation({
    mutationFn: () => api.post('/whatsapp/config/test'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] })
      toast.success(
        isAr
          ? `تم الاتصال: ${res.data?.displayPhone || ''}`
          : `Connected: ${res.data?.displayPhone || 'WhatsApp Cloud API'}`
      )
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الاختبار' : 'Connection test failed')),
  })

  const syncTemplates = useMutation({
    mutationFn: () => api.post('/whatsapp/cloud/sync-templates'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] })
      toast.success(isAr ? `تمت مزامنة ${res.data?.synced || 0} قالباً` : `Synced ${res.data?.synced || 0} templates`)
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشلت المزامنة' : 'Sync failed')),
  })

  const createTemplates = useMutation({
    mutationFn: () => api.post('/whatsapp/cloud/create-invoice-templates'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] })
      const n = res.data?.created?.length || 0
      toast.success(isAr ? `تم إنشاء / العثور على ${n} قالب فاتورة` : `Created or found ${n} invoice templates`)
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'تعذر إنشاء القوالب' : 'Could not create templates')),
  })

  const sendTest = useMutation({
    mutationFn: () => api.post('/whatsapp/cloud/send-test-invoice', { phone: testPhone, language: isAr ? 'ar' : 'en' }),
    onSuccess: (res) => toast.success(isAr ? `أُرسلت عبر ${res.data?.channel || 'Cloud API'}` : `Sent via ${res.data?.channel || 'Cloud API'}`),
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الإرسال' : 'Send failed')),
  })

  const rotateToken = async () => {
    try {
      await api.put('/whatsapp/config', { rotateVerifyToken: true })
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] })
      toast.success(isAr ? 'تم توليد رمز تحقق جديد' : 'New verify token generated')
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'تعذر التدوير' : 'Could not rotate token'))
    }
  }

  const persistAndTest = async () => {
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
        autoNotifyOrderStatus: next.autoNotifyOrderStatus,
      })
      toast.success(isAr ? 'حُفظت الأتمتة' : 'Automation saved')
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'تعذر الحفظ' : 'Could not save'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    )
  }

  const shell = (sidebar, body) => (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white text-slate-900 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08),transparent_42%)]" />
      <div className="relative grid gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-100 bg-slate-50/70 p-6 lg:border-b-0 lg:border-e lg:border-slate-100">
          {sidebar}
        </aside>
        <section className="min-h-[70vh] p-6 sm:p-8">{body}</section>
      </div>
    </div>
  )

  const brandHeader = (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 shrink-0">
        <App3DIcon appId="whatsapp_cloud_auto" icon="whatsapp" label="WhatsApp" className="h-12 w-12" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
          {isAr ? 'متجر التطبيقات' : 'App Store'}
        </p>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{isAr ? 'واتساب' : 'WhatsApp'}</h1>
      </div>
    </div>
  )

  if (mode === 'choose') {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-6 py-10 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.28)] sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.09),transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto h-16 w-16">
            <App3DIcon appId="whatsapp_cloud_auto" icon="whatsapp" label="WhatsApp" className="h-16 w-16" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
            {isAr ? 'الخطوة الأولى' : 'Step 1 · Choose how to connect'}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {isAr ? 'كيف تريد ربط واتساب؟' : 'How do you want to connect WhatsApp?'}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
            {isAr
              ? 'اختر المسار المناسب. واجهة ميتا الرسمية للفواتير التلقائية، أو رمز QR للربط السريع من الجوال.'
              : 'Pick a path. Official Meta Cloud API for auto invoices, or a QR scan to link the WhatsApp app on your phone.'}
          </p>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => selectMode('official')}
            className="group rounded-[24px] border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_20px_40px_-28px_rgba(5,150,105,0.55)]"
          >
            <span className="inline-flex rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {isAr ? 'موصى به للفواتير' : 'Recommended for invoices'}
            </span>
            <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white ring-1 ring-emerald-100">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{isAr ? 'واجهة ميتا الرسمية' : 'Official Meta Cloud API'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {isAr
                ? 'حساب واتساب للأعمال، قوالب معتمدة، ويب هوك، وإرسال PDF تلقائي بعد الاعتماد أو التوقيع.'
                : 'WhatsApp Business Account, approved templates, webhooks, and automatic PDF send after approval or ZATCA signing.'}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
              {isAr ? 'ابدأ الدليل' : 'Start guided setup'} <ChevronRight className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectMode('qr')}
            className="group rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.35)]"
          >
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {isAr ? 'ربط سريع' : 'Quick personal link'}
            </span>
            <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
              <QrCode className="h-5 w-5 text-slate-700" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{isAr ? 'رمز QR من الجوال' : 'QR code from your phone'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {isAr
                ? 'امسح الرمز من واتساب → الأجهزة المرتبطة. مناسب للمحادثات اليدوية، وليس لإرسال فواتير الأعمال التلقائي.'
                : 'Scan from WhatsApp → Linked devices. Best for a personal inbox — not for automatic business invoices.'}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
              {isAr ? 'عرض خطوات المسح' : 'Show scan steps'} <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'qr') {
    return shell(
      <>
        {brandHeader}
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          {isAr
            ? 'ربط عبر واتساب على جوالك. هذا المسار لا يرسل فواتير PDF تلقائياً.'
            : 'Link the WhatsApp app on your phone. This path does not auto-send invoice PDFs.'}
        </p>
        {qrConnected ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <BadgeCheck className="h-4 w-4" />
              {isAr ? 'الجوال متصل' : 'Phone linked'}
            </div>
            {onOpenInbox ? (
              <button type="button" onClick={onOpenInbox} className="mt-3 w-full rounded-xl bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">
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
                    active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${qrDone[index] ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-400'}`}>
                    {qrDone[index] ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1">{isAr ? item.ar : item.en}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={() => selectMode('choose')} className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          {isAr ? 'تغيير طريقة الربط' : 'Change connection method'}
        </button>
      </>,
      <>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80">
          {isAr ? `الخطوة ${qrStep + 1} من ${qrSteps.length}` : `Step ${qrStep + 1} of ${qrSteps.length}`}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{isAr ? qrSteps[qrStep].ar : qrSteps[qrStep].en}</h2>
        <div className="mt-6">
          <AnimateStep step={qrStep}>
            {qrStep === 0 && (
              <GuideCard title={isAr ? 'ربط سريع من الجوال' : 'A quick link from your phone'}>
                <p className="text-sm leading-relaxed text-slate-600">
                  {isAr
                    ? 'يستخدم مقدر جلسة واتساب ويب على الخادم. تمسح الرمز مرة واحدة من الجوال، ثم يمكنك المحادثة يدوياً. لإرسال الفواتير تلقائياً استخدم واجهة ميتا الرسمية.'
                    : 'Maqder keeps a WhatsApp Web session on the server. You scan once from your phone, then you can chat manually. For automatic invoices, use the official Meta Cloud API instead.'}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{isAr ? 'لا تحتاج حساب مطوّرين في ميتا' : 'No Meta developer account required'}</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{isAr ? 'مناسب للمحادثات والمزامنة اليدوية' : 'Fine for inbox chat and manual PDFs'}</li>
                  <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{isAr ? 'قد ينقطع إذا فُصل الجهاز أو أعيد تشغيل الخادم' : 'The session can drop if the phone unlinks or the server restarts'}</li>
                </ul>
              </GuideCard>
            )}
            {qrStep === 1 && (
              <GuideCard title={isAr ? 'جهّز الجوال' : 'Prepare your phone'}>
                <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600">
                  <li>{isAr ? 'افتح تطبيق واتساب على نفس الرقم الذي تريد ربطه.' : 'Open the WhatsApp app on the phone number you want to link.'}</li>
                  <li>{isAr ? 'تأكد أن الجوال متصل بالإنترنت.' : 'Keep the phone online on Wi-Fi or mobile data.'}</li>
                  <li>{isAr ? 'لا تغلق واتساب أثناء المسح.' : 'Do not close WhatsApp while scanning.'}</li>
                </ol>
              </GuideCard>
            )}
            {qrStep === 2 && (
              <GuideCard title={isAr ? 'افتح الأجهزة المرتبطة' : 'Open Linked devices'}>
                <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600">
                  <li>{isAr ? 'اضغط القائمة ⋮ أو الإعدادات.' : 'Tap the menu ⋮ or Settings.'}</li>
                  <li>{isAr ? 'اختر الأجهزة المرتبطة.' : 'Choose Linked devices.'}</li>
                  <li>{isAr ? 'اضغط ربط جهاز ثم امسح الرمز في الخطوة التالية.' : 'Tap Link a device, then scan the code on the next step.'}</li>
                </ol>
              </GuideCard>
            )}
            {qrStep === 3 && (
              <GuideCard title={isAr ? 'امسح الرمز أدناه' : 'Scan the code below'}>
                <p className="mb-4 text-sm text-slate-600">
                  {isAr
                    ? 'اضغط توليد الرمز إن لم يظهر، ثم امسحه من الجوال. يبقى الرمز صالحاً لمدة قصيرة.'
                    : 'Generate the code if it is not visible, then scan it from your phone. Codes expire after a short time.'}
                </p>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <WhatsAppConnect variant="setup" />
                </div>
              </GuideCard>
            )}
          </AnimateStep>
        </div>
        <div className="mt-8 flex items-center justify-between">
          <button type="button" disabled={qrStep === 0} onClick={() => setQrStep((s) => Math.max(0, s - 1))} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-slate-700 disabled:opacity-30">
            {isAr ? 'السابق' : 'Back'}
          </button>
          {qrStep < qrSteps.length - 1 ? (
            <button type="button" onClick={() => setQrStep((s) => s + 1)} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
              {isAr ? 'التالي' : 'Continue'}
            </button>
          ) : qrConnected && onOpenInbox ? (
            <button type="button" onClick={onOpenInbox} className="rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white">
              {isAr ? 'الذهاب إلى الصندوق' : 'Go to inbox'}
            </button>
          ) : (
            <button type="button" onClick={() => selectMode('official')} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800">
              {isAr ? 'التبديل إلى الربط الرسمي' : 'Switch to official API'}
            </button>
          )}
        </div>
      </>
    )
  }

  return shell(
    <>
      {brandHeader}
      <p className="mt-1 text-xs text-slate-400">{isAr ? 'واجهة Cloud API الرسمية · Graph v21.0' : 'Official Cloud API · Graph v21.0'}</p>
      {config?.connected ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <BadgeCheck className="h-4 w-4" />
            {isAr ? 'متصل' : 'Connected'}
          </div>
          <p className="mt-1 font-mono text-sm text-slate-900">{config.displayPhoneNumber || config.phoneNumberId}</p>
          <p className="mt-0.5 text-xs text-slate-500">{config.verifiedName || config.businessName}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{isAr ? 'الجودة' : 'Quality'}</span>
            <QualityChip rating={config.qualityRating} />
          </div>
          {onOpenInbox ? (
            <button type="button" onClick={onOpenInbox} className="mt-3 w-full rounded-xl bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">
              {isAr ? 'فتح صندوق الوارد' : 'Open inbox'}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-slate-500">
          {isAr
            ? 'اتبع وثائق ميتا الرسمية. هذا المسار هو المعتمد لإرسال فواتير الأعمال.'
            : 'Follow Meta’s official docs. This is the supported path for business invoice delivery.'}
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
                  active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${officialDone[index] ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-400'}`}>
                  {officialDone[index] ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="flex-1">{isAr ? item.ar : item.en}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" onClick={() => selectMode('choose')} className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" />
        {isAr ? 'تغيير طريقة الربط' : 'Change connection method'}
      </button>
    </>,
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700/80">
            {isAr ? `الخطوة ${step + 1} من ${officialSteps.length}` : `Step ${step + 1} of ${officialSteps.length}`}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{isAr ? officialSteps[step].ar : officialSteps[step].en}</h2>
        </div>
        <DocLink href={DOCS.getStarted}><BookOpen className="h-3.5 w-3.5" /> {isAr ? 'وثائق Cloud API' : 'Cloud API docs'}</DocLink>
      </div>

      {config?.lastHealthError && step === 3 ? (
        <div className="mb-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {config.lastHealthError}
        </div>
      ) : null}

      <AnimateStep step={step}>
        {step === 0 && (
          <GuideCard title={isAr ? 'أنشئ محفظة أعمال وتطبيق مطوّرين' : 'Create a Meta Business portfolio and developer app'}>
            <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600">
              <li>
                {isAr ? 'افتح إعدادات Business Manager وأكمل التحقق من النشاط.' : 'Open Meta Business settings and complete business verification.'}
                {' '}<DocLink href={DOCS.business}>{isAr ? 'إعدادات الأعمال' : 'Business settings'}</DocLink>
              </li>
              <li>
                {isAr ? 'من لوحة المطوّرين أنشئ تطبيقاً من نوع Business وأضف منتج WhatsApp.' : 'In Meta for Developers create a Business-type app and add the WhatsApp product.'}
                {' '}<DocLink href={DOCS.apps}>{isAr ? 'تطبيقاتي' : 'My Apps'}</DocLink>
              </li>
              <li>
                {isAr ? 'لا تستخدم وضع الاختبار لإرسال فواتير العملاء الحقيقيين — انقل التطبيق إلى Live بعد الموافقة.' : 'Do not send live customer invoices from test numbers. Move the app Live after review.'}
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-400">
              {isAr
                ? 'الصلاحيات المطلوبة لاحقاً: whatsapp_business_messaging و whatsapp_business_management.'
                : 'You will later grant whatsapp_business_messaging and whatsapp_business_management.'}
            </p>
          </GuideCard>
        )}

        {step === 1 && (
          <GuideCard title={isAr ? 'أضف رقم واتساب للأعمال وانسخ المعرّفات' : 'Add a WhatsApp Business phone and copy the IDs'}>
            <p className="text-sm text-slate-600">
              {isAr
                ? 'من لوحة WhatsApp في التطبيق: أضف رقماً أو اربط حساب واتساب للأعمال (WABA). انسخ Phone Number ID و WhatsApp Business Account ID.'
                : 'In the app’s WhatsApp dashboard, add a phone or link a WhatsApp Business Account (WABA). Copy the Phone Number ID and WhatsApp Business Account ID.'}
            </p>
            <div className="mt-4"><DocLink href={DOCS.phone}>{isAr ? 'إضافة رقم هاتف' : 'Add a phone number'}</DocLink></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Phone Number ID</label>
                <input className={inputClass} value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="123456789012345" />
              </div>
              <div>
                <label className={labelClass}>WhatsApp Business Account ID</label>
                <input className={inputClass} value={form.businessAccountId} onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })} placeholder="WABA ID" />
              </div>
            </div>
          </GuideCard>
        )}

        {step === 2 && (
          <GuideCard title={isAr ? 'أنشئ رمز نظام دائم — ليس رمز الاختبار المؤقت' : 'Create a permanent system-user token — not the temporary test token'}>
            <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-600">
              <li>
                {isAr ? 'من Business settings افتح System users وأنشئ مستخدم نظام Admin.' : 'In Business settings open System users and create an Admin system user.'}
                {' '}<DocLink href={DOCS.systemUsers}>System users</DocLink>
              </li>
              <li>{isAr ? 'أضف تطبيق واتساب ومنح الأصول: WABA ورقم الهاتف.' : 'Assign your WhatsApp app and assets: the WABA and the phone number.'}</li>
              <li>{isAr ? 'ولّد توكن بصلاحيات whatsapp_business_messaging و whatsapp_business_management. لا تنتهِ صلاحيته.' : 'Generate a token with whatsapp_business_messaging and whatsapp_business_management. It must not expire.'}</li>
              <li>{isAr ? 'انسخ App Secret من إعدادات التطبيق — يُستخدم للتحقق من توقيع الويب هوك.' : 'Copy the App Secret from App settings — used to verify webhook HMAC signatures.'}</li>
            </ol>
            <div className="mt-4"><DocLink href={DOCS.tokens}>{isAr ? 'رموز الوصول' : 'Access tokens'}</DocLink></div>
          </GuideCard>
        )}

        {step === 3 && (
          <GuideCard title={isAr ? 'الصق بيانات Cloud API واختبر الاتصال' : 'Paste Cloud API credentials and test the connection'}>
            <div className="grid gap-4">
              <div>
                <label className={labelClass}>Phone Number ID</label>
                <input className={inputClass} value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>WhatsApp Business Account ID</label>
                <input className={inputClass} value={form.businessAccountId} onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{isAr ? 'رمز الوصول الدائم' : 'Permanent access token'}</label>
                <input type="password" className={inputClass} value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder={config?.hasAccessToken ? config.accessToken : 'EAAG…'} />
                {config?.hasAccessToken ? <p className="mt-1 text-[11px] text-slate-400">{isAr ? 'رمز محفوظ. اتركه فارغاً للإبقاء عليه.' : 'A token is stored. Leave blank to keep it.'}</p> : null}
              </div>
              <div>
                <label className={labelClass}>{isAr ? 'App Secret (للويب هوك)' : 'App Secret (webhook HMAC)'}</label>
                <input type="password" className={inputClass} value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder={config?.hasAppSecret ? config.appSecret : ''} />
              </div>
              <div>
                <label className={labelClass}>{isAr ? 'معرّف تطبيق ميتا (اختياري)' : 'Meta App ID (optional)'}</label>
                <input className={inputClass} value={form.metaAppId} onChange={(e) => setForm({ ...form, metaAppId: e.target.value })} placeholder={isAr ? 'يُستنتج من التوكن إن أمكن' : 'Resolved from the token when possible'} />
              </div>
            </div>
            <button
              type="button"
              onClick={persistAndTest}
              disabled={saveConfig.isPending || testConnection.isPending}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {(saveConfig.isPending || testConnection.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {isAr ? 'حفظ واختبار الاتصال' : 'Save & test connection'}
            </button>
          </GuideCard>
        )}

        {step === 4 && (
          <GuideCard title={isAr ? 'اشترك في الويب هوك: messages' : 'Subscribe the webhook to messages'}>
            <p className="text-sm text-slate-600">
              {isAr
                ? 'في منتج واتساب داخل تطبيق ميتا: Configuration → Callback URL. الصق الرابط ورمز التحقق، ثم اشترك في حقل messages و message_template_status_update.'
                : 'In the WhatsApp product → Configuration, set Callback URL and Verify token, then subscribe to messages and message_template_status_update.'}
            </p>
            <div className="mt-4"><DocLink href={DOCS.webhooks}>{isAr ? 'مكوّنات الويب هوك' : 'Webhook components'}</DocLink></div>
            <div className="mt-5 grid gap-4">
              <CopyField language={language} label="Callback URL" ar="رابط الويب هوك" value={config?.webhookUrl} />
              <CopyField language={language} label="Verify token" ar="رمز التحقق" value={config?.webhookVerifyToken} />
            </div>
            <button type="button" onClick={rotateToken} className="mt-4 text-xs font-medium text-emerald-700 hover:text-emerald-900">
              {isAr ? 'توليد رمز تحقق جديد' : 'Rotate verify token'}
            </button>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {isAr
                ? 'ميتا يوقّع الطلبات بـ X-Hub-Signature-256 باستخدام App Secret. أضف السر في الخطوة السابقة.'
                : 'Meta signs POST bodies with X-Hub-Signature-256 using your App Secret. Add it in the previous step.'}
            </p>
          </GuideCard>
        )}

        {step === 5 && (
          <GuideCard title={isAr ? 'قوالب الفواتير المعتمدة (خارج نافذة 24 ساعة)' : 'Approved invoice templates (outside the 24-hour window)'}>
            <p className="text-sm text-slate-600">
              {isAr
                ? 'رسائل الأعمال التي تبدأها أنت تتطلب قالباً من فئة UTILITY بعد موافقة ميتا. ينشئ مقدر maqder_invoice و maqder_invoice_ar برأس DOCUMENT لملف PDF.'
                : 'Business-initiated messages require an approved UTILITY template. Maqder creates maqder_invoice and maqder_invoice_ar with a DOCUMENT header for the PDF.'}
            </p>
            <div className="mt-4"><DocLink href={DOCS.templates}>{isAr ? 'قوالب الرسائل' : 'Message templates'}</DocLink></div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => createTemplates.mutate()} disabled={createTemplates.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {createTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAr ? 'إنشاء قوالب الفاتورة' : 'Create invoice templates'}
              </button>
              <button type="button" onClick={() => syncTemplates.mutate()} disabled={syncTemplates.isPending} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {syncTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isAr ? 'مزامنة الحالة' : 'Sync status'}
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {invoiceTemplates.length === 0 ? (
                <p className="text-sm text-slate-400">{isAr ? 'لا توجد قوالب فاتورة بعد.' : 'No invoice templates yet.'}</p>
              ) : invoiceTemplates.map((t) => (
                <div key={`${t.name}-${t.language}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.language}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    t.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : t.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {isAr
                ? 'داخل 24 ساعة من رسالة العميل يُرسل PDF كمستند جلسة دون انتظار القالب.'
                : 'Inside the 24-hour customer service window, the PDF is sent as a session document without a template.'}
            </p>
          </GuideCard>
        )}

        {step === 6 && (
          <GuideCard title={isAr ? 'تشغيل الإرسال التلقائي وتجربة فاتورة' : 'Turn on auto-send and try a live invoice'}>
            <label className="flex items-center justify-between gap-6 border-b border-slate-100 py-4">
              <span>
                <span className="block text-sm font-medium text-slate-900">{isAr ? 'إرسال PDF عند اعتماد أو توقيع الفاتورة' : 'Send PDF when an invoice is approved or ZATCA-signed'}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{isAr ? 'يتطلب Cloud API متصل وقالب معتمد خارج نافذة 24 ساعة.' : 'Requires a live Cloud API connection and an approved template outside the 24h window.'}</span>
              </span>
              <input type="checkbox" checked={form.autoSendInvoices} onChange={(e) => persistAutomation({ autoSendInvoices: e.target.checked })} className="h-4 w-4 accent-emerald-800" />
            </label>
            <label className="flex items-center justify-between gap-6 py-4">
              <span>
                <span className="block text-sm font-medium text-slate-900">{isAr ? 'إشعار حالة الطلب' : 'Order-status notifications'}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{isAr ? 'عند استلام الطلب أو جاهزيته أو تقديمه.' : 'When an order is placed, ready, or served.'}</span>
              </span>
              <input type="checkbox" checked={form.autoNotifyOrderStatus} onChange={(e) => persistAutomation({ autoNotifyOrderStatus: e.target.checked })} className="h-4 w-4 accent-emerald-800" />
            </label>
            <div className="mt-4">
              <label className={labelClass}>{isAr ? 'رقم تجريبي (مثل 05xxxxxxxx)' : 'Test mobile (e.g. 05xxxxxxxx)'}</label>
              <div className="flex gap-2">
                <input className={inputClass} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="9665…" />
                <button type="button" onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !testPhone} className="shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
                  {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إرسال تجربة' : 'Send test')}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">{isAr ? 'يُستخدم آخر فاتورة لديك كمرفق PDF.' : 'Uses your latest invoice as the PDF attachment.'}</p>
            </div>
            <div className="mt-6"><DocLink href={DOCS.send}>{isAr ? 'إرسال الرسائل' : 'Send messages'}</DocLink></div>
          </GuideCard>
        )}
      </AnimateStep>

      <div className="mt-8 flex items-center justify-between">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-slate-700 disabled:opacity-30">
          {isAr ? 'السابق' : 'Back'}
        </button>
        {step < officialSteps.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => Math.min(officialSteps.length - 1, s + 1))} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            {isAr ? 'التالي' : 'Continue'}
          </button>
        ) : config?.connected && onOpenInbox ? (
          <button type="button" onClick={onOpenInbox} className="rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white">
            {isAr ? 'الذهاب إلى الصندوق' : 'Go to inbox'}
          </button>
        ) : (
          <Link to="/app/dashboard/app-store" className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {isAr ? 'متجر التطبيقات' : 'App Store'}
          </Link>
        )}
      </div>
    </>
  )
}

function GuideCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-6">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
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
