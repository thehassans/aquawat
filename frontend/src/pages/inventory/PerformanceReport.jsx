import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'

function pct(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${(Number(n) * 100).toFixed(1)}%`
}

function days(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Number(n).toFixed(1)}d`
}

export default function PerformanceReport() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const { data, isLoading } = useQuery({
    queryKey: ['stock-performance'],
    queryFn: () => api.get('/stock/reports/performance').then((r) => r.data),
  })

  const cards = [
    { en: 'On-time delivery', ar: 'التسليم في الموعد', value: pct(data?.onTimeDeliveryRate) },
    { en: 'Late transfers', ar: 'عمليات متأخرة', value: data?.lateTransfers ?? '—' },
    { en: 'Avg delivery lead', ar: 'متوسط مهلة التسليم', value: days(data?.averageDeliveryLeadDays) },
    { en: 'Avg days to receive', ar: 'متوسط أيام الاستلام', value: days(data?.averageDaysToReceive) },
    { en: 'Backorder rate', ar: 'نسبة الطلبات المتبقية', value: pct(data?.backorderRate) },
    { en: 'Total done', ar: 'إجمالي المنجز', value: data?.totalTransfers ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'الأداء' : 'Performance'}</h1>
        <p className="text-gray-500 mt-1">{isAr ? 'مؤشرات عمليات المخزون' : 'Inventory operation KPIs'}</p>
      </div>
      {isLoading ? (
        <div className="text-slate-500">…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.en} className="card p-5">
              <p className="text-sm text-slate-500">{isAr ? c.ar : c.en}</p>
              <p className="text-2xl font-bold mt-2 tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
