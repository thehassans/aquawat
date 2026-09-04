import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit3, Eye, Save, X } from 'lucide-react'
import InvoiceLivePreview from './InvoiceLivePreview'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'

/**
 * Full-viewport preview: portals to document.body so SalesComposerChrome
 * (sibling stacking context) cannot sit above the sheet.
 */
export default function DocumentPreSaveModal({
  isOpen,
  onClose,
  onConfirm,
  isPending = false,
  document: previewDoc,
  tenant,
  language = 'en',
  documentType = 'invoice',
  templateId,
  title,
  confirmLabel,
  confirmDisabled = false,
  warningText,
}) {
  const isAr = language === 'ar'

  useEffect(() => {
    if (!isOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const defaultTitle = isAr
    ? (documentType === 'quotation'
        ? 'معاينة عرض السعر'
        : documentType === 'purchase_invoice'
          ? 'معاينة فاتورة الشراء'
          : 'معاينة الفاتورة')
    : (documentType === 'quotation'
        ? 'Quotation preview'
        : documentType === 'purchase_invoice'
          ? 'Purchase invoice preview'
          : 'Invoice preview')

  const saveLabel = isAr
    ? (documentType === 'quotation' ? 'حفظ العرض' : 'حفظ الفاتورة')
    : (documentType === 'quotation' ? 'Save quotation' : 'Save invoice')

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[9999] flex flex-col" role="dialog" aria-modal="true">
          <motion.button
            type="button"
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-[8px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.85 }}
            className="relative z-10 flex h-full max-h-none w-full flex-col overflow-hidden bg-[#f4f5f7] dark:bg-[#0b0f16] sm:m-3 sm:h-auto sm:max-h-[calc(100vh-1.5rem)] sm:rounded-[1.75rem] sm:border sm:border-slate-200/80 sm:shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] dark:sm:border-white/10"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-white dark:text-slate-900">
                  <Eye className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    {title || defaultTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isAr ? 'راجع المستند ثم احفظ أو عدّل' : 'Review, then save or keep editing'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 dark:bg-dark-800 dark:ring-white/10"
              >
                <InvoiceLivePreview
                  invoice={previewDoc}
                  tenant={tenant}
                  language={language}
                  templateId={templateId}
                  documentType={documentType}
                  bilingual={resolveInvoiceBilingual(tenant, true)}
                  secondaryLanguage={getInvoiceSecondaryLanguage(tenant) || undefined}
                />
              </motion.div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-slate-200/90 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0f16]/95">
              <div className="mx-auto flex max-w-4xl flex-col gap-2">
                {warningText ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
                    {warningText}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="order-3 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:order-1 dark:hover:bg-white/5 dark:hover:text-slate-200"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>

                <div className="order-1 flex flex-1 gap-2 sm:order-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:flex-none dark:border-white/10 dark:bg-dark-800 dark:text-slate-100"
                  >
                    <Edit3 className="h-4 w-4" strokeWidth={1.75} />
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isPending || confirmDisabled}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.55)] transition hover:bg-slate-800 disabled:opacity-50 sm:flex-none dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    {isPending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    {confirmLabel || saveLabel}
                  </button>
                </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined' || !document.body) return null
  return createPortal(modal, document.body)
}
