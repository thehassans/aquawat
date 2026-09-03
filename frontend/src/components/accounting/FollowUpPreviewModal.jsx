import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { X, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

/**
 * Preview before any bulk follow-up send. Always dry-run first.
 */
export default function FollowUpPreviewModal({
  isOpen,
  onClose,
  language = 'en',
  invoiceIds = [],
  asOf = null,
  onSent,
}) {
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [msgLang, setMsgLang] = useState(isAr ? 'ar' : 'en')
  const [channel, setChannel] = useState('whatsapp')
  const [copiedId, setCopiedId] = useState(null)

  const preview = useQuery({
    queryKey: ['follow-up-preview', invoiceIds, asOf, channel, language],
    enabled: isOpen && invoiceIds.length > 0,
    queryFn: () => api.post('/accounting/follow-ups/send', {
      invoiceIds,
      language,
      channel,
      asOf: asOf || undefined,
      dryRun: true,
    }).then((r) => r.data),
  })

  useEffect(() => {
    if (isOpen) setMsgLang(isAr ? 'ar' : 'en')
  }, [isOpen, isAr])

  const send = useMutation({
    mutationFn: () => api.post('/accounting/follow-ups/send', {
      invoiceIds,
      language,
      channel,
      asOf: asOf || undefined,
      dryRun: false,
    }).then((r) => r.data),
    onSuccess: (payload) => {
      const logs = payload?.logs || []
      // Open WhatsApp links for wa_link / whatsapp channel
      logs.slice(0, 5).forEach((row, idx) => {
        if (row.waLink && (row.status === 'wa_link' || channel === 'whatsapp')) {
          setTimeout(() => window.open(row.waLink, '_blank', 'noopener,noreferrer'), idx * 350)
        }
      })
      toast.success(
        isAr
          ? `تم تسجيل ${payload.sent || 0} تذكير${payload.failed ? ` · فشل ${payload.failed}` : ''}`
          : `Logged ${payload.sent || 0} reminder(s)${payload.failed ? ` · ${payload.failed} failed` : ''}`,
      )
      queryClient.invalidateQueries({ queryKey: ['follow-up-last'] })
      queryClient.invalidateQueries({ queryKey: ['follow-up-logs'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-follow-up'] })
      onSent?.(payload)
      onClose?.()
    },
    onError: (err) => toast.error(err?.response?.data?.error || (isAr ? 'فشل الإرسال' : 'Send failed')),
  })

  const results = preview.data?.results || []

  const copyMessage = async (row) => {
    const text = msgLang === 'ar' ? row.messageAr : row.messageEn
    try {
      await navigator.clipboard.writeText(text || row.bilingual || '')
      setCopiedId(String(row.invoiceId))
      toast.success(isAr ? 'تم النسخ' : 'Copied')
    } catch {
      toast.error(isAr ? 'تعذر النسخ' : 'Copy failed')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-dark-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isAr ? 'معاينة التذكيرات' : 'Preview reminders'}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {preview.isLoading
                ? (isAr ? 'جارٍ التحضير…' : 'Preparing…')
                : (isAr
                  ? `${preview.data?.customerCount || 0} عميل · ${preview.data?.count || 0} فاتورة · ${(preview.data?.totalResidual || 0).toFixed?.(2) || preview.data?.totalResidual || 0} ر.س`
                  : `${preview.data?.customerCount || 0} customers · ${preview.data?.count || 0} invoices · ${(preview.data?.totalResidual || 0).toFixed?.(2) || preview.data?.totalResidual || 0} SAR`)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-dark-600">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-900"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="call">Call</option>
          </select>
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-dark-600">
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${msgLang === 'en' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
              onClick={() => setMsgLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${msgLang === 'ar' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
              onClick={() => setMsgLang('ar')}
            >
              AR
            </button>
          </div>
          <Link
            to="/app/dashboard/accounting/follow-up-levels"
            className="ms-auto text-xs font-semibold text-emerald-700 hover:underline"
          >
            {isAr ? 'تعديل مستويات المتابعة' : 'Edit follow-up levels'}
          </Link>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {preview.isError ? (
            <p className="text-sm text-rose-600">{preview.error?.response?.data?.error || preview.error?.message}</p>
          ) : null}
          {results.map((row) => (
            <div key={String(row.invoiceId)} className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{row.partnerName}</p>
                  <p className="font-mono text-xs text-emerald-800 dark:text-emerald-300">{row.invoiceNumber}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {row.levelNameAr || row.levelName} · {row.followUpChannel} · {row.ageDays}d · <Money value={row.residual} />
                    {row.phone ? ` · ${row.phone}` : (isAr ? ' · بلا هاتف' : ' · no phone')}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold dark:border-dark-600"
                  onClick={() => copyMessage(row)}
                >
                  {copiedId === String(row.invoiceId) ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {isAr ? 'نسخ' : 'Copy'}
                </button>
              </div>
              <pre
                className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-700 dark:bg-dark-900 dark:text-slate-300"
                dir={msgLang === 'ar' ? 'rtl' : 'ltr'}
              >
                {msgLang === 'ar' ? row.messageAr : row.messageEn}
              </pre>
            </div>
          ))}
          {!preview.isLoading && !results.length ? (
            <p className="py-8 text-center text-sm text-slate-400">{isAr ? 'لا رسائل للمعاينة' : 'Nothing to preview'}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-dark-600">
          <p className="text-xs text-slate-500">
            {isAr
              ? `${results.length} تذكير سيُسجَّل / يُفتح`
              : `${results.length} reminder(s) will be logged / opened`}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!results.length || send.isPending || preview.isLoading}
              onClick={() => send.mutate()}
            >
              {send.isPending ? '…' : (isAr ? 'إرسال' : 'Send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
