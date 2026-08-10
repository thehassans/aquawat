import React, { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Sparkles, Check
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'

export default function ZatcaPreValidationPanel({ invoiceData, language = 'en' }) {
  const { t } = useTranslation(language)
  const { tenant } = useSelector((state) => state.auth)
  const [expanded, setExpanded] = useState(false)
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'

  const validateMutation = useMutation({
    mutationFn: () => api.post('/tenant/compliance/config/zatca-validate', { invoiceData }).then(res => res.data),
  })

  const handleValidate = useCallback(() => {
    validateMutation.mutate()
    if (!expanded) setExpanded(true)
  }, [validateMutation, expanded])

  const result = validateMutation.data
  const isValidating = validateMutation.isPending
  const hasResult = !!result

  const isCompliant = hasResult && result.valid
  const hasErrors = hasResult && result.errors && result.errors.length > 0
  const hasWarnings = hasResult && result.warnings && result.warnings.length > 0

  if (!isSarCurrencyTenant) return null

  return (
    <div className="rounded-2xl border border-gray-200/90 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-xs transition-all">
      <div className="flex items-center justify-between p-3.5 sm:p-4">
        {/* Left: Icon & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            !hasResult
              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40'
              : isCompliant
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40'
              : hasErrors
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40'
          }`}>
            {!hasResult ? (
              <ShieldCheck className="w-5 h-5" />
            ) : isCompliant ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : hasErrors ? (
              <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'فحص امتثال هيئة الزكاة (ZATCA)' : 'ZATCA Pre-Compliance Validation'}
              </span>

              {hasResult && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isCompliant
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                    : hasErrors
                    ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
                    : 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isCompliant ? 'bg-emerald-500' : hasErrors ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  {isCompliant
                    ? (language === 'ar' ? 'مطابق لمتطلبات الفوترة' : 'Fully Compliant')
                    : hasErrors
                    ? `${result.errors.length} ${language === 'ar' ? 'أخطاء حرجة' : 'Errors'}`
                    : `${result.warnings.length} ${language === 'ar' ? 'تنبيهات' : 'Warnings'}`}
                </span>
              )}
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {language === 'ar'
                ? 'التحقق الاستباقي من صحة الحقول الإلزامية وتوافق UBL 2.1 قبل الحفظ'
                : 'Pre-check mandatory UBL 2.1 fields and ZATCA compliance rules'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ms-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-dark-700 dark:hover:bg-dark-600 dark:text-gray-200 border border-gray-200/80 dark:border-dark-600 transition-all hover:border-gray-300 active:scale-95 disabled:opacity-50 shadow-2xs"
          >
            {isValidating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            )}
            <span>{isValidating ? (language === 'ar' ? 'جارِ الفحص...' : 'Checking...') : (language === 'ar' ? 'فحص الامتثال' : 'Validate')}</span>
          </button>

          {hasResult && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
              title={expanded ? (language === 'ar' ? 'إخفاء التفاصيل' : 'Hide details') : (language === 'ar' ? 'عرض التفاصيل' : 'Show details')}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Result Details */}
      {expanded && hasResult && (
        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1 space-y-2 border-t border-gray-100 dark:border-dark-700/80 animate-fade-in">
          {hasErrors && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                <XCircle className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'الأخطاء التي يجب معالجتها قبل الإرسال:' : 'Mandatory fixes required:'}</span>
              </div>
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100/80 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                    <span className="leading-relaxed">{err}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasWarnings && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'تنبيهات وتوصيات تحسين:' : 'Recommendations & warnings:'}</span>
              </div>
              <div className="space-y-1">
                {result.warnings.map((warn, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span className="leading-relaxed">{warn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCompliant && !hasWarnings && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{language === 'ar' ? 'الفاتورة مطابقة تماماً لكافة قواعد واشتراطات هيئة الزكاة والضريبة والجمارك (ZATCA).' : 'Invoice is fully compliant with all ZATCA Phase 2 validation rules.'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
