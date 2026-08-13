import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Save, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const templateVariables = ['{{invoiceNumber}}', '{{companyName}}', '{{customerName}}', '{{invoiceDate}}', '{{invoiceTotal}}']

const SMTP_PRESETS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, smtpSecure: false, hintEn: 'Use an App Password (Google Account → Security → 2-Step Verification → App passwords). Port 587 STARTTLS.', hintAr: 'استخدم كلمة مرور التطبيق من حساب Google. المنفذ 587.' },
  { id: 'microsoft', label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, smtpSecure: false, hintEn: 'Enable Authenticated SMTP for the mailbox in Exchange admin. Port 587 STARTTLS.', hintAr: 'فعّل SMTP المصادق عليه لصندوق البريد في Exchange. المنفذ 587.' },
  { id: 'yahoo', label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, smtpSecure: true, hintEn: 'Generate an app password, then use port 465 SSL.', hintAr: 'أنشئ كلمة مرور للتطبيق واستخدم المنفذ 465.' },
  { id: 'custom', label: 'Custom', host: '', port: 587, smtpSecure: false, hintEn: 'Use your provider’s SMTP host. 587 = STARTTLS, 465 = implicit SSL.', hintAr: 'استخدم مضيف SMTP الخاص بك. 587 لـ STARTTLS و 465 لـ SSL.' },
]

export default function EmailSettingsModal({ open, onClose, onSave, isSaving, language, initialSettings, tenant }) {
  const isArabic = language === 'ar'
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      enabled: false,
      autoSendInvoices: false,
      autoSendQuotations: false,
      identityType: 'platform',
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
    reset({
      enabled: !!initialSettings?.enabled,
      autoSendInvoices: !!initialSettings?.autoSendInvoices,
      autoSendQuotations: !!initialSettings?.autoSendQuotations,
      identityType: initialSettings?.identityType || 'platform',
      identityStatus: initialSettings?.identityStatus || 'not_requested',
      requestedSenderName: initialSettings?.requestedSenderName || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || '',
      requestedSenderEmail: initialSettings?.requestedSenderEmail || tenant?.business?.contactEmail || '',
      senderName: initialSettings?.senderName || tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || '',
      fromEmail: initialSettings?.fromEmail || initialSettings?.requestedSenderEmail || tenant?.business?.contactEmail || '',
      replyTo: initialSettings?.replyTo || tenant?.business?.contactEmail || '',
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

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-4 top-4 z-50 mx-auto max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-dark-700 dark:bg-dark-900"
          >
            <form onSubmit={handleSubmit((values) => onSave(values))} className="flex max-h-[calc(100vh-2rem)] flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary-100 p-3 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isArabic ? 'التسويق عبر البريد وSMTP' : 'Email Marketing & SMTP'}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'فعّل الإرسال التلقائي، واضبط هوية المرسل، واتبع دليل SMTP لجيميل أو مايكروسوفت 365.' : 'Enable auto-send, set your sender identity, and follow the SMTP guide for Gmail or Microsoft 365.'}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="btn btn-secondary">{isArabic ? 'إغلاق' : 'Close'}</button>
              </div>

              <div className="grid gap-6 overflow-y-auto p-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-dark-700 dark:bg-dark-800/60 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{isArabic ? 'تفعيل البريد' : 'Enable Email'}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'السماح بالإرسال اليدوي والآلي من صندوق بريد الشركة.' : 'Allow manual and automated sending from the tenant mailbox.'}</p>
                      </div>
                      <input type="checkbox" {...register('enabled')} className="h-4 w-4" />
                    </label>
                    <label className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-dark-700 dark:bg-dark-800/60 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{isArabic ? 'إرسال تلقائي للفواتير' : 'Automatic Invoice Delivery'}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'إرسال الفاتورة مباشرة بعد اعتمادها أو توقيعها.' : 'Send invoices automatically after approval or signing.'}</p>
                      </div>
                      <input type="checkbox" {...register('autoSendInvoices')} className="h-4 w-4" />
                    </label>
                    <label className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-dark-700 dark:bg-dark-800/60 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{isArabic ? 'إرسال تلقائي لعروض الأسعار' : 'Automatic Quotation Delivery'}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'إرسال العرض للعميل مباشرة بعد اعتماده.' : 'Email the quotation as soon as it is approved.'}</p>
                      </div>
                      <input type="checkbox" {...register('autoSendQuotations')} className="h-4 w-4" />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">{isArabic ? 'نوع الهوية' : 'Identity Type'}</label>
                      <select {...register('identityType')} className="select">
                        <option value="platform">{isArabic ? 'عنوان مستضاف من Maqder' : 'Platform-hosted identity'}</option>
                        <option value="custom_smtp">{isArabic ? 'SMTP مخصص' : 'Custom SMTP'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'حالة الهوية' : 'Identity Status'}</label>
                      <select {...register('identityStatus')} className="select">
                        <option value="not_requested">{isArabic ? 'غير مطلوب' : 'Not Requested'}</option>
                        <option value="requested">{isArabic ? 'تم الطلب' : 'Requested'}</option>
                        <option value="configured">{isArabic ? 'تم الإعداد' : 'Configured'}</option>
                        <option value="verified">{isArabic ? 'تم التحقق' : 'Verified'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'اسم المرسل المطلوب' : 'Requested Sender Name'}</label>
                      <input {...register('requestedSenderName')} className="input" placeholder="Finance Team" />
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'البريد المطلوب' : 'Requested Sender Email'}</label>
                      <input type="email" {...register('requestedSenderEmail')} className="input" placeholder="company@maqder.com" />
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'اسم المرسل الفعلي' : 'Sender Name'}</label>
                      <input {...register('senderName')} className="input" placeholder={tenant?.business?.legalNameEn || 'Maqder ERP'} />
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'From Email' : 'From Email'}</label>
                      <input type="email" {...register('fromEmail')} className="input" placeholder="billing@company.com" />
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'Reply-To' : 'Reply-To'}</label>
                      <input type="email" {...register('replyTo')} className="input" placeholder="accounts@company.com" />
                    </div>
                    <div>
                      <label className="label">{isArabic ? 'عنوان الوارد' : 'Inbound Address'}</label>
                      <input {...register('inboundAddress')} className="input" placeholder={`${tenant?.slug || 'tenant'}@inbound.maqder.local`} />
                    </div>
                  </div>

                  {identityType === 'custom_smtp' ? (
                    <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5 dark:border-dark-700 dark:bg-dark-800/50">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary-600" />
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{isArabic ? 'معالج SMTP' : 'SMTP wizard'}</h3>
                        </div>
                        <button type="button" onClick={handleTest} disabled={testing} className="btn btn-secondary btn-sm">
                          {testing ? (isArabic ? 'جاري الاختبار...' : 'Testing...') : (isArabic ? 'اختبار الاتصال' : 'Test connection')}
                        </button>
                      </div>
                      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                        {SMTP_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:border-primary-400 dark:border-dark-600 dark:bg-dark-900 dark:text-white"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="mb-4 rounded-2xl border border-primary-200/70 bg-primary-50/60 p-4 text-sm leading-6 text-gray-600 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-gray-300">
                        <p className="mb-1 inline-flex items-center gap-1 font-semibold text-primary-700 dark:text-primary-300">
                          <Sparkles className="h-3.5 w-3.5" />
                          {isArabic ? 'دليل الإعداد' : 'Setup guide'}
                        </p>
                        <p>{isArabic ? 'جيميل: فعّل التحقق بخطوتين ثم أنشئ كلمة مرور للتطبيق. مايكروسوفت 365: فعّل SMTP المصادق عليه للبريد. المنفذ 587 لـ STARTTLS و 465 لـ SSL.' : 'Gmail: turn on 2-Step Verification, then create an App Password. Microsoft 365: enable Authenticated SMTP on the mailbox. Use port 587 for STARTTLS or 465 for SSL.'}</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="label">SMTP Host</label>
                          <input {...register('smtpHost')} className="input" placeholder="smtp.office365.com" />
                        </div>
                        <div>
                          <label className="label">SMTP Port</label>
                          <input type="number" {...register('smtpPort', { valueAsNumber: true })} className="input" placeholder="587" />
                        </div>
                        <div>
                          <label className="label">SMTP User</label>
                          <input {...register('smtpUser')} className="input" placeholder="mailer@company.com" />
                        </div>
                        <div>
                          <label className="label">SMTP Password</label>
                          <input type="password" {...register('smtpPass')} className="input" placeholder={hasStoredPassword ? initialSettings?.smtpPassMasked || '••••••••' : '••••••••'} />
                          {hasStoredPassword ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{isArabic ? 'اترك الحقل فارغاً للاحتفاظ بكلمة المرور الحالية.' : 'Leave blank to keep the current SMTP password.'}</p> : null}
                        </div>
                        <label className="md:col-span-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-dark-600 dark:bg-dark-900 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{isArabic ? 'اتصال آمن' : 'Secure Connection'}</p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'فعّل SSL/TLS عندما يطلب مزود البريد ذلك.' : 'Enable SSL/TLS when required by your mail provider.'}</p>
                          </div>
                          <input type="checkbox" {...register('smtpSecure')} className="h-4 w-4" />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5 dark:border-dark-700 dark:bg-dark-800/50">
                    <div className="mb-4 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary-600" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{isArabic ? 'قوالب الفاتورة الثنائية' : 'Bilingual Invoice Templates'}</h3>
                    </div>
                    <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{isArabic ? 'المتغيرات المتاحة:' : 'Available variables:'} {templateVariables.join(', ')}</p>
                    <div className="space-y-4">
                      <div>
                        <label className="label">English Subject</label>
                        <input {...register('subjectEn')} className="input" placeholder="Invoice {{invoiceNumber}} from {{companyName}}" />
                      </div>
                      <div>
                        <label className="label">English Body</label>
                        <textarea {...register('bodyEn')} rows={8} className="input min-h-[180px]" placeholder="Hello {{customerName}},&#10;&#10;Please find your invoice {{invoiceNumber}} dated {{invoiceDate}} with a total of {{invoiceTotal}}." />
                      </div>
                      <div>
                        <label className="label">English Signature</label>
                        <textarea {...register('signatureEn')} rows={3} className="input" placeholder="Regards,&#10;Finance Team" />
                      </div>
                      <div>
                        <label className="label">Arabic Subject</label>
                        <input {...register('subjectAr')} dir="rtl" className="input" placeholder="الفاتورة {{invoiceNumber}} من {{companyName}}" />
                      </div>
                      <div>
                        <label className="label">Arabic Body</label>
                        <textarea {...register('bodyAr')} dir="rtl" rows={8} className="input min-h-[180px]" placeholder="مرحباً {{customerName}}،&#10;&#10;نرفق لكم الفاتورة رقم {{invoiceNumber}} بتاريخ {{invoiceDate}} بإجمالي {{invoiceTotal}}." />
                      </div>
                      <div>
                        <label className="label">Arabic Signature</label>
                        <textarea {...register('signatureAr')} dir="rtl" rows={3} className="input" placeholder="مع التحية،&#10;فريق المالية" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-dark-700">
                <button type="button" onClick={onClose} className="btn btn-secondary">{isArabic ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" disabled={isSaving} className="btn btn-action-dark">
                  {isSaving ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save className="h-4 w-4" />{isArabic ? 'حفظ الإعدادات' : 'Save Settings'}</>}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
