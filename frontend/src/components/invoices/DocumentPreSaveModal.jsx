import { createPortal } from 'react-dom'
import { useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ArrowUpRight, Edit3, Eye, FileText, Receipt, Save, X, XCircle } from 'lucide-react'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'
import { resolveCommercialDocumentNumber } from '../../lib/commercialDocumentLabels'

const InvoiceLivePreview = lazy(() => import('./InvoiceLivePreview'))
const ThermalReceipt = lazy(() => import('../ui/ThermalReceipt'))

/**
 * Full-viewport preview: portals to document.body so SalesComposerChrome
 * (sibling stacking context) cannot sit above the sheet.
 */
export default function DocumentPreSaveModal({
  isOpen,
  onClose,
  onConfirm,
  onSaveDraft,
  isPending = false,
  isDraftPending = false,
  document: previewDoc,
  tenant,
  language = 'en',
  documentType = 'invoice',
  templateId,
  title,
  confirmLabel,
  keepEditingLabel,
  saveDraftLabel,
  confirmDisabled = false,
  warningText,
  errorChecks = [],
  onFixCheck,
  printFormat = 'a4',
  onPrintFormatChange,
  showPrintFormatToggle = false,
}) {
  const isAr = language === 'ar'
  const isThermal = printFormat === 'thermal'
  const blockingErrors = Array.isArray(errorChecks) ? errorChecks.filter((c) => c && !c.ok) : []

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

  const segmentWrapClass =
    'inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-50/80 p-0.5 dark:border-white/10 dark:bg-dark-900/50'
  const segmentBtnClass = (active) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition inline-flex items-center gap-1.5 ${
      active
        ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-700 dark:text-white'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
    }`

  const thermalOrder = previewDoc
    ? {
        ...previewDoc,
        receiptNumber: resolveCommercialDocumentNumber(previewDoc, documentType, language) || previewDoc.invoiceNumber,
        customerName: previewDoc.buyer?.name || previewDoc.buyer?.nameAr,
        customerPhone: previewDoc.buyer?.contactPhone || previewDoc.buyer?.phone,
        grandTotal: previewDoc.grandTotal,
        totalVat: previewDoc.totalTax,
        subtotal: previewDoc.subTotal || ((previewDoc.grandTotal || 0) - (previewDoc.totalTax || 0)),
        zatcaQrCode: previewDoc.zatca?.qrCodeData,
        items: (previewDoc.lineItems || []).map((line) => ({
          name: line.productName || line.description || '',
          nameAr: line.productNameAr || line.descriptionAr || '',
          quantity: line.quantity,
          price: line.unitPrice,
          total: line.lineTotalWithTax ?? line.lineTotal,
        })),
      }
    : null

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
                    {isAr ? 'راجع المستند ثم احفظ كمسودة أو رحّل' : 'Review, then save as draft or post'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {showPrintFormatToggle && typeof onPrintFormatChange === 'function' ? (
                  <div className={segmentWrapClass} title={isAr ? 'تنسيق الطباعة' : 'Print format'}>
                    <button
                      type="button"
                      onClick={() => onPrintFormatChange('a4')}
                      className={segmentBtnClass(!isThermal)}
                    >
                      <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                      A4
                    </button>
                    <button
                      type="button"
                      onClick={() => onPrintFormatChange('thermal')}
                      className={segmentBtnClass(isThermal)}
                    >
                      <Receipt className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {isAr ? 'حراري' : 'Thermal'}
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={`mx-auto w-full overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 dark:bg-dark-800 dark:ring-white/10 ${
                  isThermal ? 'max-w-sm' : 'max-w-4xl'
                }`}
              >
                <Suspense
                  fallback={(
                    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
                      {isAr ? 'جارٍ تحميل المعاينة…' : 'Loading preview…'}
                    </div>
                  )}
                >
                  {isThermal && thermalOrder ? (
                    <div className="flex justify-center bg-slate-50 p-4 dark:bg-dark-900/40">
                      <ThermalReceipt
                        order={thermalOrder}
                        type={previewDoc?.businessContext || 'trading'}
                      />
                    </div>
                  ) : (
                    <InvoiceLivePreview
                      invoice={previewDoc}
                      tenant={tenant}
                      language={language}
                      templateId={templateId}
                      documentType={documentType}
                      bilingual={resolveInvoiceBilingual(tenant, true)}
                      secondaryLanguage={getInvoiceSecondaryLanguage(tenant) || undefined}
                    />
                  )}
                </Suspense>
              </motion.div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-slate-200/90 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0f16]/95">
              <div className="mx-auto flex max-w-4xl flex-col gap-2">
                {blockingErrors.length ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-500/30 dark:bg-rose-950/40">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {isAr
                        ? `أصلح هذه قبل التأكيد (${blockingErrors.length})`
                        : `Fix these before confirm (${blockingErrors.length})`}
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {blockingErrors.map((check) => {
                        const label = isAr
                          ? (check.messageAr || check.message || check.id)
                          : (check.message || check.messageAr || check.id)
                        return (
                          <li key={check.id || label} className="flex items-start justify-between gap-2">
                            <span className="text-[11px] leading-snug text-rose-800/90 dark:text-rose-100/90">
                              {label}
                            </span>
                            {typeof onFixCheck === 'function' ? (
                              <button
                                type="button"
                                onClick={() => onFixCheck(check)}
                                className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 transition hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40"
                              >
                                {isAr ? 'إصلاح' : 'Fix'}
                                <ArrowUpRight className="h-3 w-3" />
                              </button>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : warningText ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {warningText}
                    </span>
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={onClose}
                    className="order-3 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:order-1 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  >
                    <Edit3 className="h-4 w-4" strokeWidth={1.75} />
                    {keepEditingLabel || (isAr ? 'متابعة التعديل' : 'Keep editing')}
                  </button>

                  <div className="order-1 flex flex-1 flex-col gap-2 sm:order-2 sm:flex-row sm:justify-end">
                    {typeof onSaveDraft === 'function' ? (
                      <button
                        type="button"
                        onClick={onSaveDraft}
                        disabled={isPending || isDraftPending}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:flex-none dark:border-white/10 dark:bg-dark-800 dark:text-slate-100"
                      >
                        {isDraftPending ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                        ) : (
                          <FileText className="h-4 w-4" strokeWidth={1.75} />
                        )}
                        {saveDraftLabel || (isAr ? 'حفظ مسودة' : 'Save draft')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:flex-none dark:border-white/10 dark:bg-dark-800 dark:text-slate-100"
                      >
                        <Edit3 className="h-4 w-4" strokeWidth={1.75} />
                        {isAr ? 'تعديل' : 'Edit'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onConfirm}
                      disabled={isPending || isDraftPending || confirmDisabled}
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
