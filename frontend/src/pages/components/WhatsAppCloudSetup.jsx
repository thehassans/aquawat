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
  MessageCircle,
  Phone,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Webhook,
  AlertTriangle,
  Building2,
} from 'lucide-react'
import api from '../../lib/api'
import WhatsAppConnect from './WhatsAppConnect'

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
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15'
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-100/55'

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
        <button type="button" onClick={copy} className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-white/80 hover:bg-white/10">
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
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-300 hover:text-white"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

function QualityChip({ rating }) {
  const value = String(rating || '').toUpperCase()
  const tone = value === 'GREEN'
    ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20'
    : value === 'YELLOW'
      ? 'bg-amber-500/15 text-amber-200 ring-amber-400/25'
      : value === 'RED'
        ? 'bg-rose-500/15 text-rose-300 ring-rose-400/25'
        : 'bg-white/10 text-white/60 ring-white/10'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ${tone}`}>
      {value || '—'}
    </span>
  )
}

export default function WhatsAppCloudSetup({ language, onOpenInbox }) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
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

  const invoiceTemplates = useMemo(
    () => (templates || []).filter((t) => String(t.name || '').startsWith('maqder_invoice')),
    [templates]
  )
  const approvedInvoice = invoiceTemplates.some((t) => String(t.status).toLowerCase() === 'approved')

  const steps = [
    { id: 'meta', icon: Building2, en: 'Meta Business & App', ar: 'حساب ميتا والتطبيق' },
    { id: 'phone', icon: Phone, en: 'WhatsApp phone & IDs', ar: 'رقم واتساب والمعرّفات' },
    { id: 'token', icon: KeyRound, en: 'Permanent access token', ar: 'رمز الوصول الدائم' },
    { id: 'connect', icon: ShieldCheck, en: 'Connect & test', ar: 'الربط والاختبار' },
    { id: 'webhook', icon: Webhook, en: 'Webhooks', ar: 'الويب هوك' },
    { id: 'templates', icon: FileText, en: 'Invoice templates', ar: 'قوالب الفواتير' },
    { id: 'auto', icon: Receipt, en: 'Auto-send invoices', ar: 'إرسال الفواتير تلقائياً' },
  ]

  const done = {
    0: true,
    1: Boolean(config?.phoneNumberId && config?.businessAccountId),
    2: Boolean(config?.hasAccessToken),
    3: Boolean(config?.connected),
    4: Boolean(config?.webhookVerifyToken),
    5: approvedInvoice,
    6: Boolean(config?.connected && config?.autoSendInvoices !== false),
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
      <div className="flex min-h-[70vh] items-center justify-center rounded-3xl bg-[#071510]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#06140f] text-white shadow-[0_40px_80px_-40px_rgba(6,78,59,0.65)] ring-1 ring-emerald-500/15">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_55%)]" />
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-white/10 p-6 lg:border-b-0 lg:border-e lg:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
            {isAr ? 'تطبيق متجر التطبيقات' : 'App Store · Official'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#25D366] to-[#075E54] shadow-lg shadow-emerald-900/40">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{isAr ? 'واتساب للأعمال' : 'WhatsApp Business'}</h1>
              <p className="text-xs text-white/50">{isAr ? 'واجهة Cloud API الرسمية من ميتا' : 'Meta Cloud API · Graph v21.0'}</p>
            </div>
          </div>

          {config?.connected ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                <BadgeCheck className="h-4 w-4" />
                {isAr ? 'متصل' : 'Connected'}
              </div>
              <p className="mt-1 font-mono text-sm text-white">{config.displayPhoneNumber || config.phoneNumberId}</p>
              <p className="mt-0.5 text-xs text-white/50">{config.verifiedName || config.businessName}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                <span>{isAr ? 'الجودة' : 'Quality'}</span>
                <QualityChip rating={config.qualityRating} />
              </div>
              {onOpenInbox ? (
                <button
                  type="button"
                  onClick={onOpenInbox}
                  className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-emerald-950"
                >
                  {isAr ? 'فتح صندوق الوارد' : 'Open inbox'}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-white/55">
              {isAr
                ? 'اتبع دليل ميتا الرسمي. لا نستخدم رمز QR أو عملاء غير رسميين لإرسال فواتير الأعمال.'
                : 'Follow Meta’s official Cloud API path. Business invoices are never sent through unofficial QR clients.'}
            </p>
          )}

          <ol className="mt-6 space-y-1">
            {steps.map((item, index) => {
              const Icon = item.icon
              const active = step === index
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStep(index)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${done[index] ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5'}`}>
                      {done[index] ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="flex-1">{isAr ? item.ar : item.en}</span>
                    {active ? <ChevronRight className="h-3.5 w-3.5 opacity-50" /> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className="min-h-[70vh] p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200/70">
                {isAr ? `الخطوة ${step + 1} من ${steps.length}` : `Step ${step + 1} of ${steps.length}`}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{isAr ? steps[step].ar : steps[step].en}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <DocLink href={DOCS.getStarted}><BookOpen className="h-3.5 w-3.5" /> {isAr ? 'وثائق Cloud API' : 'Cloud API docs'}</DocLink>
            </div>
          </div>

          {config?.lastHealthError && step === 3 ? (
            <div className="mb-5 flex gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {config.lastHealthError}
            </div>
          ) : null}

          <AnimateStep step={step}>
            {step === 0 && (
              <GuideCard isAr={isAr} title={isAr ? 'أنشئ محفظة أعمال وتطبيق مطوّرين' : 'Create a Meta Business portfolio and developer app'}>
                <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-white/75">
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
                <p className="mt-4 text-xs text-white/40">
                  {isAr
                    ? 'الصلاحيات المطلوبة لاحقاً: whatsapp_business_messaging و whatsapp_business_management.'
                    : 'You will later grant whatsapp_business_messaging and whatsapp_business_management.'}
                </p>
              </GuideCard>
            )}

            {step === 1 && (
              <GuideCard isAr={isAr} title={isAr ? 'أضف رقم واتساب للأعمال وانسخ المعرّفات' : 'Add a WhatsApp Business phone and copy the IDs'}>
                <p className="text-sm text-white/70">
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
              <GuideCard isAr={isAr} title={isAr ? 'أنشئ رمز نظام دائم — ليس رمز الاختبار المؤقت' : 'Create a permanent system-user token — not the temporary test token'}>
                <ol className="list-decimal space-y-3 ps-5 text-sm leading-relaxed text-white/75">
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
              <GuideCard isAr={isAr} title={isAr ? 'الصق بيانات Cloud API واختبر الاتصال' : 'Paste Cloud API credentials and test the connection'}>
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
                    {config?.hasAccessToken ? <p className="mt-1 text-[11px] text-white/35">{isAr ? 'رمز محفوظ. اتركه فارغاً للإبقاء عليه.' : 'A token is stored. Leave blank to keep it.'}</p> : null}
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
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#25D366] to-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-900/30 disabled:opacity-60"
                >
                  {(saveConfig.isPending || testConnection.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {isAr ? 'حفظ واختبار الاتصال' : 'Save & test connection'}
                </button>
              </GuideCard>
            )}

            {step === 4 && (
              <GuideCard isAr={isAr} title={isAr ? 'اشترك في الويب هوك: messages' : 'Subscribe the webhook to messages'}>
                <p className="text-sm text-white/70">
                  {isAr
                    ? 'في منتج واتساب داخل تطبيق ميتا: Configuration → Callback URL. الصق الرابط ورمز التحقق، ثم اشترك في حقل messages و message_template_status_update.'
                    : 'In the WhatsApp product → Configuration, set Callback URL and Verify token, then subscribe to messages and message_template_status_update.'}
                </p>
                <div className="mt-4"><DocLink href={DOCS.webhooks}>{isAr ? 'مكوّنات الويب هوك' : 'Webhook components'}</DocLink></div>
                <div className="mt-5 grid gap-4">
                  <CopyField language={language} label="Callback URL" ar="رابط الويب هوك" value={config?.webhookUrl} />
                  <CopyField language={language} label="Verify token" ar="رمز التحقق" value={config?.webhookVerifyToken} />
                </div>
                <button type="button" onClick={rotateToken} className="mt-4 text-xs font-medium text-emerald-300 hover:text-white">
                  {isAr ? 'توليد رمز تحقق جديد' : 'Rotate verify token'}
                </button>
                <p className="mt-3 flex items-start gap-2 text-xs text-white/40">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {isAr
                    ? 'ميتا يوقّع الطلبات بـ X-Hub-Signature-256 باستخدام App Secret. أضف السر في الخطوة السابقة.'
                    : 'Meta signs POST bodies with X-Hub-Signature-256 using your App Secret. Add it in the previous step.'}
                </p>
              </GuideCard>
            )}

            {step === 5 && (
              <GuideCard isAr={isAr} title={isAr ? 'قوالب الفواتير المعتمدة (خارج نافذة 24 ساعة)' : 'Approved invoice templates (outside the 24-hour window)'}>
                <p className="text-sm text-white/70">
                  {isAr
                    ? 'رسائل الأعمال التي تبدأها أنت تتطلب قالباً من فئة UTILITY بعد موافقة ميتا. ينشئ مقدر maqder_invoice و maqder_invoice_ar برأس DOCUMENT لملف PDF.'
                    : 'Business-initiated messages require an approved UTILITY template. Maqder creates maqder_invoice and maqder_invoice_ar with a DOCUMENT header for the PDF.'}
                </p>
                <div className="mt-4"><DocLink href={DOCS.templates}>{isAr ? 'قوالب الرسائل' : 'Message templates'}</DocLink></div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => createTemplates.mutate()}
                    disabled={createTemplates.isPending}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 disabled:opacity-60"
                  >
                    {createTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isAr ? 'إنشاء قوالب الفاتورة' : 'Create invoice templates'}
                  </button>
                  <button
                    type="button"
                    onClick={() => syncTemplates.mutate()}
                    disabled={syncTemplates.isPending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-60"
                  >
                    {syncTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isAr ? 'مزامنة الحالة' : 'Sync status'}
                  </button>
                </div>
                <div className="mt-5 space-y-2">
                  {invoiceTemplates.length === 0 ? (
                    <p className="text-sm text-white/40">{isAr ? 'لا توجد قوالب فاتورة بعد.' : 'No invoice templates yet.'}</p>
                  ) : invoiceTemplates.map((t) => (
                    <div key={`${t.name}-${t.language}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div>
                        <p className="font-mono text-sm">{t.name}</p>
                        <p className="text-xs text-white/40">{t.language}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        t.status === 'approved' ? 'bg-emerald-500/20 text-emerald-200' : t.status === 'rejected' ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-500/20 text-amber-100'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-white/40">
                  {isAr
                    ? 'داخل 24 ساعة من رسالة العميل يُرسل PDF كمستند جلسة دون انتظار القالب.'
                    : 'Inside the 24-hour customer service window, the PDF is sent as a session document without a template.'}
                </p>
              </GuideCard>
            )}

            {step === 6 && (
              <GuideCard isAr={isAr} title={isAr ? 'تشغيل الإرسال التلقائي وتجربة فاتورة' : 'Turn on auto-send and try a live invoice'}>
                <label className="flex items-center justify-between gap-6 border-b border-white/10 py-4">
                  <span>
                    <span className="block text-sm font-medium">{isAr ? 'إرسال PDF عند اعتماد أو توقيع الفاتورة' : 'Send PDF when an invoice is approved or ZATCA-signed'}</span>
                    <span className="mt-0.5 block text-xs text-white/40">{isAr ? 'يتطلب Cloud API متصل وقالب معتمد خارج نافذة 24 ساعة.' : 'Requires a live Cloud API connection and an approved template outside the 24h window.'}</span>
                  </span>
                  <input type="checkbox" checked={form.autoSendInvoices} onChange={(e) => persistAutomation({ autoSendInvoices: e.target.checked })} className="h-4 w-4 accent-emerald-400" />
                </label>
                <label className="flex items-center justify-between gap-6 py-4">
                  <span>
                    <span className="block text-sm font-medium">{isAr ? 'إشعار حالة الطلب' : 'Order-status notifications'}</span>
                    <span className="mt-0.5 block text-xs text-white/40">{isAr ? 'عند استلام الطلب أو جاهزيته أو تقديمه.' : 'When an order is placed, ready, or served.'}</span>
                  </span>
                  <input type="checkbox" checked={form.autoNotifyOrderStatus} onChange={(e) => persistAutomation({ autoNotifyOrderStatus: e.target.checked })} className="h-4 w-4 accent-emerald-400" />
                </label>
                <div className="mt-4">
                  <label className={labelClass}>{isAr ? 'رقم تجريبي (مثل 05xxxxxxxx)' : 'Test mobile (e.g. 05xxxxxxxx)'}</label>
                  <div className="flex gap-2">
                    <input className={inputClass} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="9665…" />
                    <button
                      type="button"
                      onClick={() => sendTest.mutate()}
                      disabled={sendTest.isPending || !testPhone}
                      className="shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                    >
                      {sendTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إرسال تجربة' : 'Send test')}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-white/35">{isAr ? 'يُستخدم آخر فاتورة لديك كمرفق PDF.' : 'Uses your latest invoice as the PDF attachment.'}</p>
                </div>
                <div className="mt-6"><DocLink href={DOCS.send}>{isAr ? 'إرسال الرسائل' : 'Send messages'}</DocLink></div>
              </GuideCard>
            )}
          </AnimateStep>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white disabled:opacity-30"
            >
              {isAr ? 'السابق' : 'Back'}
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                className="rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/15"
              >
                {isAr ? 'التالي' : 'Continue'}
              </button>
            ) : config?.connected && onOpenInbox ? (
              <button type="button" onClick={onOpenInbox} className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-emerald-950">
                {isAr ? 'الذهاب إلى الصندوق' : 'Go to inbox'}
              </button>
            ) : (
              <Link to="/app/dashboard/app-store" className="rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/15">
                {isAr ? 'متجر التطبيقات' : 'App Store'}
              </Link>
            )}
          </div>

          <details className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-medium text-white/50">
              {isAr ? 'وضع قديم: اتصال QR غير رسمي (غير مُوصى به للفواتير)' : 'Legacy: unofficial QR connect (not used for invoices)'}
            </summary>
            <div className="mt-4 opacity-80">
              <WhatsAppConnect />
            </div>
          </details>
        </section>
      </div>
    </div>
  )
}

function GuideCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function AnimateStep({ step, children }) {
  return (
    <motion.div
      key={step}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {children}
    </motion.div>
  )
}
