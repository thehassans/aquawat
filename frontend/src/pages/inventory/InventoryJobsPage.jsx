import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { RefreshCw, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { formatInvError } from '../../lib/invError'

const TYPE_LABEL = {
  integrity: { en: 'Integrity', ar: 'سلامة البيانات' },
  scheduler: { en: 'Scheduler', ar: 'المجدول' },
  export: { en: 'Export', ar: 'تصدير' },
  import: { en: 'Import', ar: 'استيراد' },
  cache_reconcile: { en: 'Cache reconcile', ar: 'مطابقة الكاش' },
  expiry_alerts: { en: 'Expiry alerts', ar: 'تنبيهات انتهاء' },
  reservation_retry: { en: 'Reservation retry', ar: 'إعادة الحجز' },
  cyclic_count: { en: 'Cyclic count', ar: 'جرد دوري' },
  count_plan_due: { en: 'Count plan', ar: 'خطة الجرد' },
  delivery_notify: { en: 'Delivery notify', ar: 'إشعار التسليم' },
  other: { en: 'Other', ar: 'أخرى' },
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'ok' || s === 'done') {
    return { label: 'Done', className: 'bg-emerald-50 text-emerald-800 ring-emerald-100' }
  }
  if (s === 'failed') {
    return { label: 'Failed', className: 'bg-rose-50 text-rose-800 ring-rose-100' }
  }
  if (s === 'running' || s === 'partial') {
    return { label: s === 'partial' ? 'Partial' : 'Running', className: 'bg-sky-50 text-sky-800 ring-sky-100' }
  }
  // queued / pending
  return { label: s === 'queued' ? 'Pending' : (status || 'Pending'), className: 'bg-slate-100 text-slate-600 ring-slate-200' }
}

export default function InventoryJobsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inv-jobs'],
    queryFn: () => api.get('/stock/jobs', { params: { limit: 50 } }).then((r) => r.data),
    refetchInterval: 15_000,
  })

  const enqueue = useMutation({
    mutationFn: ({ jobType, payload }) =>
      api.post('/stock/jobs/enqueue', { jobType, payload }).then((r) => r.data),
    onSuccess: () => {
      toast.success(ar ? 'أُعيدت المهمة للطابور' : 'Job re-queued')
      qc.invalidateQueries({ queryKey: ['inv-jobs'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const items = asInvList(data)
  const queue = data?._links?.queue

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'مراقب المهام' : 'Jobs monitor'}
          </h2>
          <p className="text-sm text-slate-500">
            {ar ? 'طوابير الخلفية والحالة' : 'Background queues and status'}
            {queue?.mode ? ` · ${queue.mode}` : ''}
            {queue?.waiting != null ? ` · waiting ${queue.waiting}` : ''}
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {ar ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState
          title={ar ? 'لا مهام بعد' : 'No jobs yet'}
          description={ar ? 'شغّل المجدول من قائمة العمليات' : 'Run the scheduler from Operations'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[160px] px-3 py-2">{ar ? 'المهمة' : 'Job name'}</th>
                <th className="min-w-[140px] px-3 py-2">{ar ? 'أُنشئت' : 'Created at'}</th>
                <th className="min-w-[140px] px-3 py-2">{ar ? 'نُفّذت' : 'Executed at'}</th>
                <th className="min-w-[110px] px-3 py-2">{ar ? 'الحالة' : 'Status'}</th>
                <th className="min-w-[70px] px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => {
                const badge = statusBadge(row.status)
                const failed = String(row.status).toLowerCase() === 'failed'
                return (
                  <tr key={row._id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {ar ? TYPE_LABEL[row.jobType]?.ar : TYPE_LABEL[row.jobType]?.en || row.jobType}
                      </div>
                      <div className="text-[11px] text-slate-400">{row.trigger}</div>
                      {row.errors?.length > 0 && (
                        <div className="mt-1 text-xs text-rose-600">
                          {row.errors[0].message}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleString()
                        : row.startedAt
                          ? new Date(row.startedAt).toLocaleString()
                          : '—'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">
                      {row.finishedAt
                        ? new Date(row.finishedAt).toLocaleString()
                        : String(row.status).toLowerCase() === 'running'
                          ? (ar ? 'جاري…' : 'Running…')
                          : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {failed ? (
                        <button
                          type="button"
                          title={ar ? 'إعادة المحاولة' : 'Retry'}
                          className="inline-flex rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-dark-600 dark:hover:bg-dark-800"
                          disabled={enqueue.isPending}
                          onClick={() => enqueue.mutate({ jobType: row.jobType, payload: {} })}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
