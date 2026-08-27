import { Link } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'

/**
 * Shared inventory list chrome.
 * Children (filters + table) always render when not loading —
 * empty states must live inside children so the filter bar stays visible.
 */
export default function InvListShell({
  title,
  subtitle,
  action,
  children,
  empty,
  loading,
  filtersActive = false,
  meta,
  page = 1,
  pageSize = 50,
  total,
  onPageChange,
  language = 'en',
}) {
  const ar = language === 'ar'
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : 1

  // Prefer explicit filtersActive; fall back to meta only when caller opts in via truthy non-code keys
  const showFiltersBadge = filtersActive === true
    || (filtersActive !== false && meta?.appliedFilters && (() => {
      const af = meta.appliedFilters
      // Ignore always-on `code` filter — that is the page context, not a user filter
      return Boolean(af.state || af.search || af.q || af.emptyOperationTypeMatch)
    })())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          {showFiltersBadge && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {ar ? 'فلاتر نشطة' : 'Filters active'}
            </p>
          )}
        </div>
        {action}
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">…</div>
      ) : (
        <>
          {children}
          {empty ? (
            typeof empty === 'boolean' ? (
              <EmptyState title={ar ? 'لا سجلات' : 'No records'} />
            ) : null
          ) : null}
        </>
      )}
      {onPageChange && total > pageSize && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-500">
            {ar ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
            {' · '}
            {total} {ar ? 'سجل' : 'records'}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              {ar ? 'السابق' : 'Prev'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              {ar ? 'التالي' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function InvRecordPager({ prev, next, language = 'en' }) {
  const ar = language === 'ar'
  return (
    <div className="flex gap-2">
      {prev && (
        <Link to={prev} className="btn btn-secondary btn-sm">{ar ? '← السابق' : '← Previous'}</Link>
      )}
      {next && (
        <Link to={next} className="btn btn-secondary btn-sm">{ar ? 'التالي →' : 'Next →'}</Link>
      )}
    </div>
  )
}
