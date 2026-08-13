import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const templateVariables = ['{{invoiceNumber}}', '{{companyName}}', '{{customerName}}', '{{invoiceDate}}', '{{invoiceTotal}}']

const SMTP_PRESETS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, smtpSecure: false, hintEn: 'Use an App Password (Google Account → Security → 2-Step Verification → App passwords).', hintAr: 'استخدم كلمة مرور التطبيق من حساب Google.' },
  { id: 'microsoft', label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, smtpSecure: false, hintEn: 'Enable Authenticated SMTP for the mailbox in Exchange admin.', hintAr: 'فعّل SMTP المصادق عليه لصندوق البريد في Exchange.' },
  { id: 'yahoo', label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, smtpSecure: true, hintEn: 'Generate an app password, then use port 465 SSL.', hintAr: 'أنشئ كلمة مرور للتطبيق واستخدم المنفذ 465.' },
  { id: 'custom', label: 'Custom', host: '', port: 587, smtpSecure: false, hintEn: 'Use your provider’s SMTP host. 587 = STARTTLS, 465 = implicit SSL.', hintAr: 'استخدم مضيف SMTP الخاص بك. 587 لـ STARTTLS و 465 لـ SSL.' },
]

const inputClass = 'w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'
const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400'

export default function EmailSettingsModal({
  open,
  onClose,
  onSave,
  isSaving,
  language,
  initialSettings,
  tenant,
  variant = 'modal',
  required = false,
}) {
  const isArabic = language === 'ar'
  const isPage = variant === 'page'
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      enabled: true,
      autoSendInvoices: false,
      autoSendQuotations: false,
      identityType: 'custom_smtp',
      identityStatus: 'not_requested',
      requestedSenderName: '',
      requestedSenderEmail: '',
      senderName: '',
      fromEmail: '',
      replyTo: '',
      inboundAddress: '',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      smtpPass: '',
      subjectEn: '',
      subjectAr: '',
      bodyEn: '',
      bodyAr: '',
      signatureEn: '',
      signatureAr: '',
    },
  })

  useEffect(() => {
    const company = tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || ''
    const contact = tenant?.business?.contactEmail || ''
    const configured = !!initialSettings?.enabled && String(initialSettings?.fromEmail || '').includes('@')
    reset({
      enabled: configured ? !!initialSettings?.enabled : true,
      autoSendInvoices: !!initialSettings?.autoSendInvoices,
      autoSendQuotations: !!initialSettings?.autoSendQuotations,
      identityType: initialSettings?.identityType || 'custom_smtp',
      identityStatus: initialSettings?.identityStatus || 'not_requested',
      requestedSenderName: initialSettings?.requestedSenderName || company,
      requestedSenderEmail: initialSettings?.requestedSenderEmail || contact,
      senderName: initialSettings?.senderName || company,
      fromEmail: initialSettings?.fromEmail || initialSettings?.requestedSenderEmail || contact,
      replyTo: initialSettings?.replyTo || contact,
      inboundAddress: initialSettings?.inboundAddress || `${tenant?.slug || 'tenant'}@inbound.maqder.local`,
      smtpHost: initialSettings?.smtpHost || '',
      smtpPort: Number(initialSettings?.smtpPort || 587),
      smtpSecure: !!initialSettings?.smtpSecure,
      smtpUser: initialSettings?.smtpUser || '',
      smtpPass: '',
      subjectEn: initialSettings?.subjectEn || '',
      subjectAr: initialSettings?.subjectAr || '',
      bodyEn: initialSettings?.bodyEn || '',
      bodyAr: initialSettings?.bodyAr || '',
      signatureEn: initialSettings?.signatureEn || '',
      signatureAr: initialSettings?.signatureAr || '',
    })
  }, [initialSettings, reset, tenant])

  const identityType = watch('identityType')
  const hasStoredPassword = initialSettings?.hasSmtpPass
  const [testing, setTesting] = useState(false)

  const applyPreset = (preset) => {
    setValue('identityType', 'custom_smtp', { shouldDirty: true })
    if (preset.host) setValue('smtpHost', preset.host, { shouldDirty: true })
    setValue('smtpPort', preset.port, { shouldDirty: true })
    setValue('smtpSecure', preset.smtpSecure, { shouldDirty: true })
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      await api.post('/email/settings/test')
      toast.success(isArabic ? 'تم التحقق من اتصال SMTP' : 'SMTP connection verified')
    } catch (err) {
      toast.error(err.response?.data?.error || (isArabic ? 'فشل اختبار SMTP' : 'SMTP test failed'))
    } finally {
      setTesting(false)
    }
  }

  const formBody = (
    <form onSubmit={handleSubmit((values) => onSave(values))} className="flex max-h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-white/10">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            {isArabic ? 'التسويق عبر البريد' : 'Email Marketing'}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {required
              ? (isArabic ? 'إعداد الإرسال' : 'Set up sending')
              : (isArabic ? 'إعدادات البريد' : 'Mail settings')}
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {isArabic
              ? 'فعّل الإرسال، حدّد هوية المرسل، ثم احفظ.'
              : 'Enable sending, set your from identity, then save.'}
          </p>
        </div>
        {!required && !isPage ? (
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-8 overflow-y-auto px-6 py-6">
        <section className="space-y-3">
          {[
            { name: 'enabled', titleEn: 'Enable email', titleAr: 'تفعيل البريد', hintEn: 'Manual and automated sending from this mailbox.', hintAr: 'الإرسال اليدوي والآلي من هذا الصندوق.' },
            { name: 'autoSendQuotations', titleEn: 'Send quotations on approval', titleAr: 'إرسال عروض الأسعار عند الاعتماد', hintEn: 'Email the quotation as soon as it is approved.', hintAr: 'إرسال العرض فور اعتماده.' },
            { name: 'autoSendInvoices', titleEn: 'Send invoices on approval', titleAr: 'إرسال الفواتير عند الاعتماد', hintEn: 'Send invoices after approval or signing.', hintAr: 'إرسال الفاتورة بعد الاعتماد أو التوقيع.' },
          ].map((row) => (
            <label key={row.name} className="flex items-center justify-between gap-6 border-b border-slate-100 py-3 last:border-0 dark:border-white/10">
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{isArabic ? row.titleAr : row.titleEn}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{isArabic ? row.hintAr : row.hintEn}</span>
              </span>
              <input type="checkbox" {...register(row.name)} className="h-4 w-4 accent-emerald-800" />
            </label>
          ))}
        </section>

        <section>
          <p className={labelClass}>{isArabic ? 'الهوية' : 'Identity'}</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {[
              { value: 'platform', labelEn: 'Platform-hosted', labelAr: 'مستضاف من مقدر' },
              { value: 'custom_smtp', labelEn: 'Your SMTP', labelAr: 'SMTP الخاص بك' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('identityType', opt.value, { shouldDirty: true })}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  identityType === opt.value
                    ? 'border-emerald-800 bg-emerald-800 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
                }`}
              >
                {isArabic ? opt.labelAr : opt.labelEn}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{isArabic ? 'اسم المرسل' : 'Sender name'}</label>
              <input {...register('senderName')} className={inputClass} placeholder={tenant?.business?.legalNameEn || 'Company'} />
            </div>
            <div>
              <label className={labelClass}>From</label>
              <input type="email" {...register('fromEmail')} className={inputClass} placeholder="billing@company.com" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Reply-To</label>
              <input type="email" {...register('replyTo')} className={inputClass} placeholder="accounts@company.com" />
            </div>
          </div>
        </section>

        {identityType === 'custom_smtp' ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className={labelClass} style={{ marginBottom: 0 }}>{isArabic ? 'SMTP' : 'SMTP'}</p>
              <button type="button" onClick={handleTest} disabled={testing} className="text-xs font-medium text-emerald-800 hover:underline">
                {testing ? (isArabic ? 'جاري الاختبار…' : 'Testing…') : (isArabic ? 'اختبار الاتصال' : 'Test connection')}
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {SMTP_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-emerald-800/40 dark:border-white/10 dark:text-slate-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="mb-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" />
              {isArabic
                ? 'جيميل: فعّل التحقق بخطوتين ثم أنشئ كلمة مرور للتطبيق. مايكروسوفت 365: فعّل SMTP المصادق عليه. 587 لـ STARTTLS و 465 لـ SSL.'
                : 'Gmail: App Password after 2-Step Verification. Microsoft 365: enable Authenticated SMTP. Port 587 STARTTLS or 465 SSL.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Host</label>
                <input {...register('smtpHost')} className={inputClass} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className={labelClass}>Port</label>
                <input type="number" {...register('smtpPort', { valueAsNumber: true })} className={inputClass} placeholder="587" />
              </div>
              <div>
                <label className={labelClass}>User</label>
                <input {...register('smtpUser')} className={inputClass} placeholder="mailer@company.com" />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input type="password" {...register('smtpPass')} className={inputClass} placeholder={hasStoredPassword ? '••••••••' : ''} />
                {hasStoredPassword ? (
                  <p className="mt-1 text-[11px] text-slate-400">{isArabic ? 'اتركه فارغاً للإبقاء على كلمة المرور.' : 'Leave blank to keep the current password.'}</p>
                ) : null}
              </div>
              <label className="flex items-center justify-between gap-4 sm:col-span-2">
                <span className="text-sm text-slate-700 dark:text-slate-200">{isArabic ? 'اتصال آمن (SSL/TLS)' : 'Secure connection (SSL/TLS)'}</span>
                <input type="checkbox" {...register('smtpSecure')} className="h-4 w-4 accent-emerald-800" />
              </label>
            </div>
          </section>
        ) : (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isArabic ? 'سيتم الإرسال عبر هوية مقدر المستضافة.' : 'Sending uses the platform-hosted identity.'}
          </p>
        )}

        <details className="group rounded-2xl border border-slate-100 dark:border-white/10">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-200">
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {isArabic ? 'قوالب الفاتورة' : 'Invoice templates'}
            </span>
          </summary>
          <div className="space-y-4 border-t border-slate-100 px-4 py-4 dark:border-white/10">
            <p className="text-xs text-slate-400">{isArabic ? 'المتغيرات:' : 'Variables:'} {templateVariables.join('  ')}</p>
            <div>
              <label className={labelClass}>English subject</label>
              <input {...register('subjectEn')} className={inputClass} placeholder="Invoice {{invoiceNumber}} from {{companyName}}" />
            </div>
            <div>
              <label className={labelClass}>English body</label>
              <textarea {...register('bodyEn')} rows={4} className={`${inputClass} min-h-[96px]`} />
            </div>
            <div>
              <label className={labelClass}>English signature</label>
              <textarea {...register('signatureEn')} rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Arabic subject</label>
              <input {...register('subjectAr')} dir="rtl" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Arabic body</label>
              <textarea {...register('bodyAr')} dir="rtl" rows={4} className={`${inputClass} min-h-[96px]`} />
            </div>
            <div>
              <label className={labelClass}>Arabic signature</label>
              <textarea {...register('signatureAr')} dir="rtl" rows={2} className={inputClass} />
            </div>
          </div>
        </details>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-white/10">
        {!required ? (
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5">
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d28] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#163322] disabled:opacity-60"
        >
          {isSaving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isArabic ? 'حفظ' : 'Save'}
        </button>
      </div>
    </form>
  )

  if (isPage) {
    if (!open) return null
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#0c111a]">
          {formBody}
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={required ? undefined : onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-4 top-6 z-50 mx-auto max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c111a]"
          >
            {formBody}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
