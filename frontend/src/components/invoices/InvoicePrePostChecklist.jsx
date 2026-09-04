import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'

/**
 * Pre-post readiness checklist beside Confirm / Post.
 * @param {{ checks?: Array, canPost?: boolean, hasWarnings?: boolean, loading?: boolean, language?: string, className?: string }} props
 */
export default function InvoicePrePostChecklist({
  checks = [],
  canPost = false,
  hasWarnings = false,
  loading = false,
  language = 'en',
  className = '',
}) {
  const isAr = language === 'ar'
  const title = isAr ? 'قبل الترحيل' : 'Before posting'
  const readyLabel = isAr ? 'جاهز للترحيل' : 'Ready to post'
  const blockedLabel = isAr ? 'أصلح العناصر الحمراء قبل الترحيل' : 'Fix red items before posting'
  const warnLabel = isAr ? 'تحذير — يمكن الترحيل رغم ذلك' : 'Warning — you can still post'
  const emptyLabel = isAr ? 'أكمل الفاتورة لعرض الفحوصات' : 'Fill the invoice to see checks'

  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-left shadow-sm dark:border-white/10 dark:bg-dark-800/80 ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : checks.length ? (
          <span
            className={`text-[10px] font-semibold ${
              !canPost
                ? 'text-rose-600 dark:text-rose-400'
                : hasWarnings
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {!canPost ? blockedLabel : hasWarnings ? warnLabel : readyLabel}
          </span>
        ) : null}
      </div>

      {!checks.length && !loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {checks.map((c) => {
            const msg = isAr ? (c.messageAr || c.message) : c.message
            const isWarn = !c.blocking && !c.ok
            return (
              <li key={c.id} className="flex items-start gap-2 text-xs leading-snug">
                <span className="mt-0.5 shrink-0">
                  {c.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                  ) : isWarn ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" aria-hidden />
                  )}
                </span>
                <span
                  className={
                    c.ok
                      ? 'text-slate-600 dark:text-slate-300'
                      : isWarn
                        ? 'font-medium text-amber-700 dark:text-amber-300'
                        : 'font-medium text-rose-700 dark:text-rose-300'
                  }
                >
                  {msg}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
