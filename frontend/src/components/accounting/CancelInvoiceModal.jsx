import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Ban, Lock, X } from 'lucide-react'
import Money from '../ui/Money'
import { documentStatusLabel, isDraftDocument } from '../../lib/accountingDocumentStatus'

const REASON_CHIPS = [
  { id: 'wrong_values', en: 'Wrong values', ar: 'قيم خاطئة' },
  { id: 'duplicate', en: 'Duplicate', ar: 'مكررة' },
  { id: 'customer_request', en: 'Customer request', ar: 'طلب العميل' },
  { id: 'entry_error', en: 'Entry error', ar: 'خطأ إدخال' },
]

function resolveDocKind(invoice = {}) {
  const flow = String(invoice?.flow || 'sell')
  const type = String(invoice?.invoiceType || '388')
  if (flow === 'purchase' && type === '381') {
    return { en: 'vendor refund', ar: 'مرتجع المورد', titleEn: 'Cancel vendor refund', titleAr: 'إلغاء مرتجع المورد' }
  }
  if (flow === 'purchase') {
    return { en: 'vendor bill', ar: 'فاتورة المورد', titleEn: 'Cancel vendor bill', titleAr: 'إلغاء فاتورة المورد' }
  }
  if (type === '381') {
    return { en: 'credit note', ar: 'الإشعار الدائن', titleEn: 'Cancel credit note', titleAr: 'إلغاء الإشعار الدائن' }
  }
  return { en: 'invoice', ar: 'الفاتورة', titleEn: 'Cancel invoice', titleAr: 'إلغاء الفاتورة' }
}

/**
 * Premium cancel confirmation — replaces browser prompt/confirm.
 */
export default function CancelInvoiceModal({
  isOpen,
  onClose,
  onConfirm,
  isPending = false,
  invoice,
  language = 'en',
}) {
  const isAr = language === 'ar'
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const textareaRef = useRef(null)
  const kind = useMemo(() => resolveDocKind(invoice), [invoice])
  const isDraft = isDraftDocument(invoice)
  const trimmed = reason.trim()
  const canSubmit = trimmed.length > 0 && (isDraft || acknowledged) && !isPending

  useEffect(() => {
    if (!isOpen) return undefined
    setReason('')
    setAcknowledged(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => textareaRef.current?.focus(), 80)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
    }
  }, [isOpen, invoice?._id])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !isPending) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isPending, onClose])

  if (typeof document === 'undefined') return null

  const partyName = invoice?.flow === 'purchase'
    ? (invoice?.seller?.name || invoice?.seller?.nameAr || invoice?.supplierName || '—')
    : (invoice?.buyer?.name || invoice?.buyer?.nameAr || invoice?.customerName || '—')

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!canSubmit) return
    onConfirm?.(trimmed)
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-invoice-title"
        >
          <motion.button
            type="button"
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[10px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => { if (!isPending) onClose?.() }}
          />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340, mass: 0.8 }}
            className="relative z-10 flex max-h-[min(92vh,640px)] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200/80 bg-white shadow-[0_32px_90px_-28px_rgba(15,23,42,0.45)] sm:rounded-[1.75rem] dark:border-white/10 dark:bg-[#0f141c] dark:shadow-[0_32px_90px_-28px_rgba(0,0,0,0.75)]"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-rose-500/15 via-rose-500/[0.04] to-transparent dark:from-rose-500/20 dark:via-rose-500/5" />

            <div className="relative flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/80 shadow-[0_0_24px_-8px_rgba(244,63,94,0.45)] dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25">
                  <Ban className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-600/80 dark:text-rose-300/80">
                    {isAr ? 'إجراء نهائي' : 'Irreversible action'}
                  </p>
                  <h3 id="cancel-invoice-title" className="mt-0.5 truncate text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    {isAr ? kind.titleAr : kind.titleEn}
                  </h3>
                  <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                    {invoice?.invoiceNumber || '—'} · {partyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!isPending) onClose?.() }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-2">
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {isAr ? 'الحالة' : 'Status'}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {documentStatusLabel(invoice?.status, language)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {isAr ? 'الإجمالي' : 'Total'}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      <Money value={Number(invoice?.grandTotal || 0)} />
                    </span>
                  </div>
                  <div className="border-s border-slate-200/80 ps-2 dark:border-white/10">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {isAr ? 'المدفوع' : 'Paid'}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      <Money value={Number(invoice?.paidAmount || 0)} />
                    </span>
                  </div>
                </div>

                <div className={`flex gap-3 rounded-2xl border px-3.5 py-3 ${
                  isDraft
                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100'
                    : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100'
                }`}
                >
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${isDraft ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`} strokeWidth={1.75} />
                  <p className="text-[13px] leading-relaxed opacity-95">
                    {isDraft
                      ? (isAr
                        ? `سيتم وضع ${kind.ar} في حالة ملغاة ولن يمكن ترحيلها أو تسجيل دفعات عليها.`
                        : `This ${kind.en} will be marked cancelled and cannot be posted or paid.`)
                      : (isAr
                        ? `سيتم إلغاء ${kind.ar} وعكس جميع قيود اليومية المرتبطة (الفاتورة والمدفوعات). هذا الإجراء لا يمكن التراجع عنه.`
                        : `This ${kind.en} will be cancelled and all linked journal entries (document and payments) will be reversed. This cannot be undone.`)}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="cancel-invoice-reason" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {isAr ? 'سبب الإلغاء' : 'Cancellation reason'}
                      <span className="ms-1 text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] tabular-nums text-slate-400">{trimmed.length}/500</span>
                  </div>
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {REASON_CHIPS.map((chip) => {
                      const label = isAr ? chip.ar : chip.en
                      const active = trimmed === label
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => setReason(label)}
                          className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                            active
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    id="cancel-invoice-reason"
                    ref={textareaRef}
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder={isAr ? 'اكتب سبب الإلغاء…' : 'Describe why this document is being cancelled…'}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-500/15 dark:border-white/10 dark:bg-[#0a0e14] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-400/40 dark:focus:ring-rose-500/20"
                  />
                </div>

                {!isDraft ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-3 transition hover:bg-slate-100/80 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500/40 dark:border-white/20 dark:bg-transparent"
                    />
                    <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                      {isAr
                        ? 'أؤكد أنني راجعت الأثر المحاسبي وأريد المتابعة بالإلغاء.'
                        : 'I understand the accounting impact and want to proceed with cancellation.'}
                    </span>
                  </label>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-[#0c1118]/95">
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => { if (!isPending) onClose?.() }}
                    disabled={isPending}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                  >
                    {isAr ? 'رجوع' : 'Keep document'}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(244,63,94,0.65)] transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {isPending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
                    )}
                    {isPending
                      ? (isAr ? 'جارٍ الإلغاء…' : 'Cancelling…')
                      : (isAr ? `تأكيد إلغاء ${kind.ar}` : 'Confirm cancel')}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
