/**
 * Loading skeleton + error banner for accounting report panels.
 * Prefer this over rendering Money 0.00 when the query failed.
 */
export default function AccountingQueryState({
  language = 'en',
  isLoading,
  isError,
  error,
  onRetry,
  children,
  skeletonRows = 4,
}) {
  const isAr = language === 'ar'
  const status = error?.response?.status
  const retryAfter = Number(error?.response?.data?.retryAfterSeconds)
    || parseInt(error?.response?.headers?.['retry-after'] || '0', 10)
    || 0
  const message = error?.userMessage
    || error?.response?.data?.error
    || error?.message
    || (isAr ? 'تعذر تحميل التقرير' : 'Could not load this report')

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-4 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
      >
        <p className="font-semibold">
          {status === 429
            ? (isAr ? 'تم تجاوز حد الطلبات مؤقتاً' : 'Temporarily rate limited')
            : (isAr ? 'خطأ في التحميل' : 'Load error')}
        </p>
        <p className="mt-1 text-rose-800/90 dark:text-rose-200/90">{String(message)}</p>
        {status === 429 && retryAfter > 0 ? (
          <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
            {isAr ? `أعد المحاولة خلال ${retryAfter} ثانية` : `Retry in about ${retryAfter}s`}
          </p>
        ) : null}
        {typeof onRetry === 'function' ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl bg-rose-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-900 dark:bg-rose-700"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        ) : null}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200/80 dark:bg-dark-600" />
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-dark-600">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-white/5"
            >
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70 dark:bg-dark-600" />
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200/70 dark:bg-dark-600" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return children
}
