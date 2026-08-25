import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

const TYPE_LABEL = {
  waiting_past_deadline: { en: 'Waiting past deadline', ar: 'متأخر عن الموعد' },
  no_rule: { en: 'No rule found', ar: 'لا قاعدة' },
  procurement_failed: { en: 'Procurement failed', ar: 'فشل التوريد' },
  negative_forecast: { en: 'Negative forecast', ar: 'توقع سالب' },
  expired_lot_on_hand: { en: 'Expired lot on hand', ar: 'دفعة منتهية بالمخزن' },
}

export default function ExceptionsQueuePage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'

  const { data, isLoading } = useQuery({
    queryKey: ['inv-exceptions'],
    queryFn: () => api.get('/stock/exceptions').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const items = data?.items || []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'قائمة الاستثناءات' : 'Exception queue'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'حركات متأخرة، فشل التوريد، توقع سالب، دفعات منتهية'
            : 'Late moves, failed procurements, negative forecast, expired lots'}
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={ar ? 'لا استثناءات' : 'No exceptions'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2">{ar ? 'الرسالة' : 'Message'}</th>
                <th className="px-3 py-2">{ar ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2">{ar ? 'الوقت' : 'When'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row, i) => (
                <tr key={`${row.type}-${i}`}>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium ${row.severity === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>
                      {ar ? TYPE_LABEL[row.type]?.ar : TYPE_LABEL[row.type]?.en || row.type}
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
