import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import {
  History, MessageSquare, PenSquare, Save, Send,
  Settings2, ShieldCheck, Smartphone, Sparkles, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { tenantHasSmsAddon } from '../lib/smsAddon'

const PROVIDERS = [
  { id: 'twilio', en: 'Twilio', ar: 'تويليو', hintEn: 'Account SID, Auth Token, and a Twilio From number in E.164 (+9665...).', hintAr: 'Account SID و Auth Token ورقم المرسل بصيغة دولية.' },
  { id: 'unifonic', en: 'Unifonic', ar: 'يونيفونك', hintEn: 'App SID and Sender ID from the Unifonic console. Common for KSA traffic.', hintAr: 'App SID ومعرّف المرسل من لوحة يونيفونك.' },
  { id: 'custom', en: 'Custom gateway', ar: 'بوابة مخصصة', hintEn: 'POST JSON { to, body } to your URL. Optional API key header.', hintAr: 'أرسل JSON إلى رابطك مع مفتاح اختياري.' },
]

export default function SmsMarketing() {
  const queryClient = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const hasSms = tenantHasSmsAddon(tenant)
  const [tab, setTab] = useState('compose')
  const [compose, setCompose] = useState({ to: '', body: '' })

  const settingsQuery = useQuery({
    queryKey: ['tenant-sms-settings'],
    queryFn: () => api.get('/sms/settings').then((r) => r.data),
    enabled: hasSms,
    staleTime: 60 * 1000,
  })
  const messagesQuery = useQuery({
    queryKey: ['tenant-sms-messages'],
    queryFn: () => api.get('/sms/messages', { params: { limit: 40 } }).then((r) => r.data),
    enabled: hasSms,
  })
  const statsQuery = useQuery({
    queryKey: ['tenant-sms-stats'],
    queryFn: () => api.get('/sms/stats').then((r) => r.data),
    enabled: hasSms,
  })

  const sms = settingsQuery.data?.sms || {}
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      enabled: false,
      autoSendInvoices: false,
      provider: 'twilio',
      fromNumber: '',
      twilioAccountSid: '',
      twilioAuthToken: '',
      unifonicAppSid: '',
      unifonicSenderId: '',
      unifonicToken: '',
      customUrl: '',
      customApiKey: '',
      customAuthHeader: '',
      invoiceTemplateEn: '',
      invoiceTemplateAr: '',
    },
  })

  useEffect(() => {
    if (!sms || Object.keys(sms).length === 0) return
    reset({
      enabled: !!sms.enabled,
      autoSendInvoices: !!sms.autoSendInvoices,
      provider: sms.provider || 'twilio',
      fromNumber: sms.fromNumber || '',
      twilioAccountSid: sms.twilioAccountSid || '',
      twilioAuthToken: '',
      unifonicAppSid: sms.unifonicAppSid || '',
      unifonicSenderId: sms.unifonicSenderId || '',
      unifonicToken: '',
      customUrl: sms.customUrl || '',
      customApiKey: '',
      customAuthHeader: sms.customAuthHeader || '',
      invoiceTemplateEn: sms.invoiceTemplateEn || '',
      invoiceTemplateAr: sms.invoiceTemplateAr || '',
    })
  }, [sms, reset])

  const provider = watch('provider')

  const saveMutation = useMutation({
    mutationFn: (values) => api.put('/sms/settings', { sms: values }).then((r) => r.data),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ إعدادات الرسائل' : 'SMS settings saved')
      queryClient.invalidateQueries({ queryKey: ['tenant-sms-settings'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save'),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post('/sms/send', {
      to: compose.to.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean),
      body: compose.body,
    }).then((r) => r.data),
    onSuccess: (data) => {
      const ok = (data.deliveries || []).filter((d) => d.sent).length
      toast.success(isAr ? `تم إرسال ${ok} رسالة` : `Sent ${ok} message(s)`)
      setCompose({ to: '', body: '' })
      queryClient.invalidateQueries({ queryKey: ['tenant-sms-messages'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-sms-stats'] })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to send SMS'),
  })

  const testMutation = useMutation({
    mutationFn: () => api.post('/sms/test', { to: compose.to.trim() || undefined, body: 'Maqder SMS Marketing test.' }).then((r) => r.data),
    onSuccess: () => toast.success(isAr ? 'تم إرسال رسالة الاختبار' : 'Test SMS sent'),
    onError: (err) => toast.error(err.response?.data?.error || 'Test failed'),
  })

  if (!hasSms) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'التسويق عبر الرسائل' : 'SMS Marketing'}</h1>
            <p className="text-sm text-gray-400">{isAr ? 'حملات، فواتير، وإرسال تلقائي' : 'Campaigns, invoice notices, and auto-send'}</p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-[#140a1f] via-[#1a0d2a] to-[#0d0716] p-8 md:p-12"
        >
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
              <Zap className="h-3.5 w-3.5" />
              {isAr ? 'ثبّت من المتجر' : 'Install from App Store'}
            </div>
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">{isAr ? 'رسائل نصية بمستوى المؤسسات' : 'Enterprise SMS for ERP'}</h2>
            <p className="mb-8 max-w-xl text-sm leading-7 text-gray-400">
              {isAr
                ? 'ثبّت التسويق عبر الرسائل لإرسال الفواتير، وإنشاء الحملات، وربط تويليو أو يونيفونك أو بوابة خاصة.'
                : 'Install SMS Marketing to send invoice notices, run campaigns, and connect Twilio, Unifonic, or your own gateway.'}
            </p>
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { en: 'Invoice SMS', ar: 'رسائل الفواتير', desc_en: 'Amount, number, link', desc_ar: 'المبلغ والرقم والرابط' },
                { en: 'Auto-send', ar: 'إرسال تلقائي', desc_en: 'After issue or sign', desc_ar: 'بعد الإصدار أو التوقيع' },
                { en: 'Gateways', ar: 'البوابات', desc_en: 'Twilio · Unifonic · HTTP', desc_ar: 'تويليو · يونيفونك · HTTP' },
              ].map((f) => (
                <div key={f.en} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{isAr ? f.ar : f.en}</p>
                  <p className="mt-1 text-xs text-gray-500">{isAr ? f.desc_ar : f.desc_en}</p>
                </div>
              ))}
            </div>
            <Link
              to="/app/dashboard/app-store"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30"
            >
              {isAr ? 'فتح متجر التطبيقات' : 'Open App Store'}
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  const tabs = [
    { id: 'compose', icon: PenSquare, en: 'Compose', ar: 'إنشاء' },
    { id: 'history', icon: History, en: 'History', ar: 'السجل' },
    { id: 'settings', icon: Settings2, en: 'Setup', ar: 'الإعداد' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'التسويق عبر الرسائل' : 'SMS Marketing'}</h1>
            <p className="text-sm text-gray-400">{isAr ? 'حملات، فواتير، وبوابات الإرسال' : 'Campaigns, invoices, and delivery gateways'}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {sms.enabled ? (isAr ? 'الإرسال مفعّل' : 'Sending on') : (isAr ? 'الإرسال متوقف' : 'Sending off')}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: isAr ? 'مرسلة (30 يوم)' : 'Sent (30d)', value: statsQuery.data?.sent || 0 },
          { label: isAr ? 'فواتير' : 'Invoice SMS', value: statsQuery.data?.invoices || 0 },
          { label: isAr ? 'فشل' : 'Failed', value: statsQuery.data?.failed || 0 },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-dark-700 dark:bg-dark-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-dark-700 dark:bg-dark-900">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              tab === item.id ? 'bg-white text-gray-900 shadow-sm dark:bg-dark-800 dark:text-white' : 'text-gray-500'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {isAr ? item.ar : item.en}
          </button>
        ))}
      </div>

      {tab === 'compose' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-dark-700 dark:bg-dark-800">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">{isAr ? 'رسالة جديدة' : 'New message'}</h2>
          </div>
          <label className="label">{isAr ? 'الأرقام (مفصولة بفاصلة)' : 'Mobiles (comma separated)'}</label>
          <input
            className="input mb-4"
            value={compose.to}
            onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
            placeholder="+9665..., 05..."
          />
          <label className="label">{isAr ? 'النص' : 'Message'}</label>
          <textarea
            className="input mb-2 min-h-[140px]"
            maxLength={1000}
            value={compose.body}
            onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
            placeholder={isAr ? 'اكتب رسالتك التسويقية أو إشعار الفاتورة...' : 'Write a campaign or invoice notice...'}
          />
          <div className="mb-4 flex items-center justify-between text-xs text-gray-400">
            <span>{compose.body.length}/1000</span>
            <span>{isAr ? 'يُفضَّل أقل من 160 حرفاً للرسالة الواحدة' : 'Stay under 160 characters per segment'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-action-dark" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال' : 'Send SMS')}
            </button>
            <button type="button" className="btn btn-secondary" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
              {isAr ? 'رسالة اختبار' : 'Send test'}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-dark-700 dark:bg-dark-800">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-dark-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">{isAr ? 'سجل الإرسال' : 'Delivery history'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-gray-400 dark:bg-dark-900">
                <tr>
                  <th className="px-5 py-3">{isAr ? 'إلى' : 'To'}</th>
                  <th className="px-5 py-3">{isAr ? 'الرسالة' : 'Message'}</th>
                  <th className="px-5 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-5 py-3">{isAr ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {(messagesQuery.data?.messages || []).map((row) => (
                  <tr key={row._id} className="border-t border-slate-100 dark:border-dark-700">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{row.to}</td>
                    <td className="max-w-md truncate px-5 py-3 text-gray-500">{row.body}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : row.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{row.createdAt ? new Date(row.createdAt).toLocaleString(isAr ? 'ar-SA' : 'en-GB') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(messagesQuery.data?.messages || []).length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">{isAr ? 'لا توجد رسائل بعد' : 'No messages yet'}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'settings' ? (
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 dark:border-dark-700 dark:bg-dark-800">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-600 dark:bg-dark-900">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{isAr ? 'تفعيل الإرسال' : 'Enable sending'}</p>
                <p className="mt-1 text-sm text-gray-500">{isAr ? 'السماح بالإرسال اليدوي والتلقائي' : 'Allow manual and automatic SMS'}</p>
              </div>
              <input type="checkbox" {...register('enabled')} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-dark-600 dark:bg-dark-900">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{isAr ? 'إرسال تلقائي للفواتير' : 'Auto-send invoices'}</p>
                <p className="mt-1 text-sm text-gray-500">{isAr ? 'بعد اعتماد أو توقيع الفاتورة إذا وُجد رقم الجوال' : 'After invoice issue or sign when a mobile exists'}</p>
              </div>
              <input type="checkbox" {...register('autoSendInvoices')} className="h-4 w-4" />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{isAr ? 'بوابة الإرسال' : 'Gateway'}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {PROVIDERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setValue('provider', item.id, { shouldDirty: true })}
                  className={`rounded-2xl border p-4 text-start ${
                    provider === item.id
                      ? 'border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-dark-600'
                  }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-white">{isAr ? item.ar : item.en}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{isAr ? item.hintAr : item.hintEn}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 text-sm leading-6 text-gray-600 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-gray-300">
            <p className="mb-1 inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              {isAr ? 'دليل الربط' : 'Integration guide'}
            </p>
            <p>
              {isAr
                ? 'تويليو: انسخ Account SID و Auth Token من console.twilio.com واستخدم رقم مرسل مفعّل. يونيفونك: App SID ومعرّف المرسل من لوحة السعودية. البوابة المخصصة: يستقبل الخادم POST JSON بالحقول to و body.'
                : 'Twilio: copy Account SID and Auth Token from console.twilio.com and use a provisioned From number. Unifonic: App SID plus Sender ID from the KSA console. Custom: your URL receives POST JSON with to and body.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">{isAr ? 'رقم المرسل' : 'From number'}</label>
              <input {...register('fromNumber')} className="input" placeholder="+9665..." />
            </div>
            {provider === 'twilio' ? (
              <>
                <div>
                  <label className="label">Twilio Account SID</label>
                  <input {...register('twilioAccountSid')} className="input" />
                </div>
                <div>
                  <label className="label">Twilio Auth Token</label>
                  <input type="password" {...register('twilioAuthToken')} className="input" placeholder={sms.hasTwilioAuthToken ? '••••••••' : ''} />
                </div>
              </>
            ) : null}
            {provider === 'unifonic' ? (
              <>
                <div>
                  <label className="label">Unifonic App SID</label>
                  <input {...register('unifonicAppSid')} className="input" />
                </div>
                <div>
                  <label className="label">{isAr ? 'معرّف المرسل' : 'Sender ID'}</label>
                  <input {...register('unifonicSenderId')} className="input" />
                </div>
                <div>
                  <label className="label">Unifonic token</label>
                  <input type="password" {...register('unifonicToken')} className="input" placeholder={sms.hasUnifonicToken ? '••••••••' : ''} />
                </div>
              </>
            ) : null}
            {provider === 'custom' ? (
              <>
                <div className="md:col-span-2">
                  <label className="label">{isAr ? 'رابط البوابة' : 'Gateway URL'}</label>
                  <input {...register('customUrl')} className="input" placeholder="https://sms.example.com/send" />
                </div>
                <div>
                  <label className="label">API key</label>
                  <input type="password" {...register('customApiKey')} className="input" placeholder={sms.hasCustomApiKey ? '••••••••' : ''} />
                </div>
                <div>
                  <label className="label">{isAr ? 'رأس المصادقة' : 'Auth header'}</label>
                  <input {...register('customAuthHeader')} className="input" placeholder="Authorization" />
                </div>
              </>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">{isAr ? 'قالب الفاتورة EN' : 'Invoice template EN'}</label>
              <textarea {...register('invoiceTemplateEn')} rows={4} className="input" placeholder="Dear {{customerName}}, invoice {{invoiceNumber}} totaling {{total}} {{currency}} is ready. {{link}}" />
            </div>
            <div>
              <label className="label">{isAr ? 'قالب الفاتورة AR' : 'Invoice template AR'}</label>
              <textarea {...register('invoiceTemplateAr')} dir="rtl" rows={4} className="input" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saveMutation.isPending} className="btn btn-action-dark">
              {saveMutation.isPending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="h-4 w-4" />{isAr ? 'حفظ' : 'Save setup'}</>}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
