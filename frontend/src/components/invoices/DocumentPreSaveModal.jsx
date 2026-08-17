import { motion, AnimatePresence } from 'framer-motion'
import { Eye, Edit3, CheckCircle2, X, Printer, Download, Loader2 } from 'lucide-react'
import InvoiceLivePreview from './InvoiceLivePreview'
import { resolveInvoiceBilingual, getInvoiceSecondaryLanguage } from '../../lib/invoiceLanguage'

export default function DocumentPreSaveModal({
  isOpen,
  onClose,
  onConfirm,
  isPending = false,
  document,
  tenant,
  language = 'en',
  documentType = 'invoice',
  templateId,
  title,
}) {
  if (!isOpen) return null

  const defaultTitle = language === 'ar'
    ? (documentType === 'quotation'
        ? 'معاينة عرض السعر قبل الحفظ'
        : documentType === 'purchase_invoice'
        ? 'معاينة فاتورة الشراء قبل الحفظ'
        : 'معاينة الفاتورة قبل الحفظ')
    : (documentType === 'quotation'
        ? 'Quotation Live Preview'
        : documentType === 'purchase_invoice'
        ? 'Purchase Invoice Live Preview'
        : 'Invoice Live Preview')

  const handlePrint = () => {
    window.print()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-100 shadow-2xl dark:bg-[#0c111a] border border-slate-200 dark:border-white/10 flex flex-col"
        >
          {/* Modal Header */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0c111a]/95">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Eye className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {title || defaultTitle}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {language === 'ar' ? 'راجع بيانات وتفاصيل المستند قبل الاعتماد والحفظ' : 'Review document layout & line items before saving'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
                title={language === 'ar' ? 'طباعة' : 'Print'}
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal Body Preview */}
          <div className="p-4 sm:p-8 flex-1 overflow-y-auto flex justify-center bg-slate-100/70 dark:bg-dark-900/40">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-dark-800 dark:ring-white/10 overflow-hidden">
              <InvoiceLivePreview
                invoice={document}
                tenant={tenant}
                language={language}
                templateId={templateId}
                documentType={documentType}
                bilingual={resolveInvoiceBilingual(tenant, true)}
                secondaryLanguage={getInvoiceSecondaryLanguage(tenant) || undefined}
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="sticky bottom-0 z-30 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0c111a]/95">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{language === 'ar' ? 'هل كل شيء جاهز للحفظ؟' : 'Ready to save this document?'}</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
              >
                <Edit3 className="h-4 w-4" />
                {language === 'ar' ? 'تعديل البيانات' : 'Edit Details'}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{language === 'ar' ? 'تأكيد وحفظ المستند' : 'Confirm & Save Document'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
