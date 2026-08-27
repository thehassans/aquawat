import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'

const TYPE_LABEL = {
  waiting_past_deadline: { en: 'Waiting past deadline', ar: 'متأخر عن الموعد' },
  no_rule: { en: 'No rule found', ar: 'لا قاعدة' },
  procurement_failed: { en: 'Procurement failed', ar: 'فشل التوريد' },
  negative_forecast: { en: 'Negative forecast', ar: 'توقع سالب' },
  expired_lot_on_hand: { en: 'Expired lot on hand', ar: 'دفعة منتهية بالمخزن' },
  integrity: { en: 'Integrity', ar: 'سلامة البيانات' },
}

export default function ExceptionsQueuePage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['inv-exceptions'],
    queryFn: () => api.get('/stock/exceptions').then((r) => asInvList(r.data)),
    refetchInterval: 60_000,
  })

  const runChecks = useMutation({
    mutationFn: () => api.post('/stock/integrity/run').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-exceptions'] })
      qc.invalidateQueries({ queryKey: ['inv-jobs'] })
    },
  })

  const items = data || []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'قائمة الاستثناءات' : 'Exception queue'}
          </h2>
          <p className="text-sm text-slate-500">
            {ar
              ? 'حركات متأخرة، فشل التوريد، توقع سالب، دفعات منتهية، سلامة البيانات'
              : 'Late moves, failed procurements, negative forecast, expired lots, integrity'}
          </p>
        </div>
        <button
          type="button"
          disabled={runChecks.isPending}
          onClick={() => runChecks.mutate()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {runChecks.isPending
            ? (ar ? 'جاري الفحص…' : 'Running…')
            : (ar ? 'تشغيل الفحوصات' : 'Run checks')}
        </button>
      </div>

      {runChecks.isError && (
        <p className="text-sm text-rose-600">
          {runChecks.error?.response?.data?.error || runChecks.error?.message || 'Failed'}
        </p>
      )}
      {runChecks.isSuccess && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {ar
            ? `اكتمل الفحص — ${runChecks.data.failureCount || 0} مشكلة`
            : `Checks finished — ${runChecks.data.failureCount || 0} failure(s)`}
        </p>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={ar ? 'لا استثناءات' : 'No exceptions'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'الرسالة' : 'Message'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'المنتج' : 'Product'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'الوقت' : 'When'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row, i) => (
                <tr key={`${row.type}-${row.code || ''}-${i}`}>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium ${row.severity === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>
                      {ar ? TYPE_LABEL[row.type]?.ar : TYPE_LABEL[row.type]?.en || row.type}
                      {row.code ? ` · ${row.code}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                    {ar && row.messageAr ? row.messageAr : row.message}
                    {row.ref?.transferId && (
                      <div>
                        <Link
                          className="text-xs text-primary-600 hover:underline"
                          to={`/app/dashboard/inventory/receipts/${row.ref.transferId}`}
                        >
                          {ar ? 'فتح التحويل' : 'Open transfer'}
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{row.productName || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">
                    {row.at ? new Date(row.at).toLocaleString() : '—'}
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
