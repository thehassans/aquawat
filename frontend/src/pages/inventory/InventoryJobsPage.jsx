import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

const TYPE_LABEL = {
  integrity: { en: 'Integrity', ar: 'سلامة البيانات' },
  scheduler: { en: 'Scheduler', ar: 'المجدول' },
  export: { en: 'Export', ar: 'تصدير' },
  import: { en: 'Import', ar: 'استيراد' },
  cache_reconcile: { en: 'Cache reconcile', ar: 'مطابقة الكاش' },
  expiry_alerts: { en: 'Expiry alerts', ar: 'تنبيهات انتهاء' },
  other: { en: 'Other', ar: 'أخرى' },
}

function statusClass(status) {
  if (status === 'ok' || status === 'done') return 'text-emerald-600'
  if (status === 'failed') return 'text-rose-600'
  if (status === 'partial' || status === 'running') return 'text-amber-600'
  return 'text-slate-500'
}

export default function InventoryJobsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inv-jobs'],
    queryFn: () => api.get('/stock/jobs', { params: { limit: 50 } }).then((r) => r.data),
    refetchInterval: 30_000,
  })

  const items = data?.data || data?.items || []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'مهام الخلفية' : 'Background jobs'}
          </h2>
          <p className="text-sm text-slate-500">
            {ar
              ? 'سجل تشغيل المجدول، سلامة البيانات، والتصدير'
              : 'Run log for scheduler, integrity checks, and exports'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/dashboard/inventory/exceptions"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-dark-600 dark:hover:bg-dark-800"
          >
            {ar ? 'الاستثناءات' : 'Exceptions'}
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {ar ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState
          title={ar ? 'لا مهام بعد' : 'No jobs yet'}
          description={ar
            ? 'شغّل الفحوصات من قائمة الاستثناءات أو المجدول'
            : 'Run integrity checks from Exceptions or start the scheduler'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2">{ar ? 'الحالة' : 'Status'}</th>
                <th className="px-3 py-2">{ar ? 'البداية' : 'Started'}</th>
                <th className="px-3 py-2">{ar ? 'المدة' : 'Duration'}</th>
                <th className="px-3 py-2">{ar ? 'ملخص' : 'Summary'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => (
                <tr key={row._id}>
                  <td className="px-3 py-2.5">
                    {ar ? TYPE_LABEL[row.jobType]?.ar : TYPE_LABEL[row.jobType]?.en || row.jobType}
                    <div className="text-xs text-slate-400">{row.trigger}</div>
                  </td>
                  <td className={`px-3 py-2.5 font-medium ${statusClass(row.status)}`}>
                    {row.status}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">
                    {row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">
                    {row.durationMs != null ? `${row.durationMs} ms` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                    {row.counts && Object.keys(row.counts).length
                      ? Object.entries(row.counts).map(([k, v]) => `${k}=${v}`).join(' · ')
                      : '—'}
                    {row.errors?.length > 0 && (
                      <div className="mt-1 text-xs text-rose-600">
                        {row.errors[0].code || 'ERR'}: {row.errors[0].message}
                        {row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ''}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
