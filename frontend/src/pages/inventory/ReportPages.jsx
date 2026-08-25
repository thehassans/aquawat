import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, useReportFilters, exportCsv } from './ReportShell'

export function LocationsReportPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { queryParams } = useReportFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['report-locations', queryParams],
    queryFn: () => api.get('/stock/report/locations', { params: queryParams }).then((r) => r.data),
  })
  const items = data?.items || []

  return (
    <ReportShell
      activeId="locations"
      title={ar ? 'تقرير المواقع' : 'Locations report'}
      subtitle={ar ? 'الكميات حسب شجرة المواقع' : 'On-hand rolled up by location tree'}
    >
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!items.length}
          onClick={() => exportCsv('locations-report.csv', items, [
            { label: 'Path', get: (r) => r.completePath },
            { label: 'Usage', get: (r) => r.usage },
            { label: 'OnHand', get: (r) => r.onHand },
            { label: 'Reserved', get: (r) => r.reserved },
            { label: 'Products', get: (r) => r.productCount },
          ])}
        >
          CSV
        </button>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={ar ? 'لا بيانات' : 'No location stock'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'المسار' : 'Path'}</th>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Usage'}</th>
                <th className="px-3 py-2 text-right">{ar ? 'بالمخزن' : 'On hand'}</th>
                <th className="px-3 py-2 text-right">{ar ? 'محجوز' : 'Reserved'}</th>
                <th className="px-3 py-2 text-right">{ar ? 'منتجات' : 'Products'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => (
                <tr key={row.locationId}>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{row.completePath}</td>
                  <td className="px-3 py-2.5 text-slate-500">{row.usage}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.onHand}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.reserved}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.productCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  )
}

export function ReconcileReportPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const { queryParams } = useReportFilters()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['report-reconcile', queryParams],
    queryFn: () => api.get('/stock/report/reconcile', { params: queryParams }).then((r) => r.data),
  })

  const repairMut = useMutation({
    mutationFn: () => api.post('/stock/report/reconcile/repair-cache', {
      warehouseId: queryParams.warehouseId || undefined,
      productIds: (data?.mismatches || [])
        .filter((m) => m.issues?.some((i) => i.code === 'CACHE_VS_LEDGER'))
        .map((m) => m.productId),
    }),
    onSuccess: (res) => {
      toast.success(ar
        ? `تمت مزامنة ${res.data.repair?.synced ?? 0} · فروقات ${res.data.after?.mismatchCount ?? 0}`
        : `Synced ${res.data.repair?.synced ?? 0} · mismatches ${res.data.after?.mismatchCount ?? 0}`)
      qc.invalidateQueries({ queryKey: ['report-reconcile'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <ReportShell
      activeId="reconcile"
      title={ar ? 'مطابقة المخزون والتقييم' : 'Stock ↔ Valuation reconcile'}
      subtitle={ar
        ? 'التحقق من تطابق قيمة تقرير المخزون مع طبقات التقييم والكاش'
        : 'Assert stock report value equals valuation layers; cache vs ledger'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
          {ar ? 'إعادة الفحص' : 'Re-run'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={repairMut.isPending || !data?.mismatches?.length}
          onClick={() => repairMut.mutate()}
        >
          {ar ? 'إصلاح الكاش' : 'Repair cache'}
        </button>
        {data && (
          <span className={`text-sm font-medium ${data.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
            {data.ok
              ? (ar ? `سليم · ${data.matched} منتج` : `OK · ${data.matched} products`)
              : (ar ? `${data.mismatchCount} فرق` : `${data.mismatchCount} mismatch(es)`)}
          </span>
        )}
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
            <div className="text-xs text-slate-500">{ar ? 'قيمة المخزون' : 'Stock value total'}</div>
            <div className="text-lg font-semibold tabular-nums">{data.stockValueTotal}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
            <div className="text-xs text-slate-500">{ar ? 'قيمة التقييم' : 'Valuation total'}</div>
            <div className="text-lg font-semibold tabular-nums">{data.valuationValueTotal}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
            <div className="text-xs text-slate-500">{ar ? 'الفرق' : 'Drift'}</div>
            <div className="text-lg font-semibold tabular-nums">{data.valueDrift}</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !data?.mismatches?.length ? (
        <EmptyState
          title={ar ? 'لا فروقات' : 'No mismatches'}
          description={ar ? 'تقرير المخزون وطبقات التقييم متطابقان' : 'Stock report and valuation layers agree'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2">{ar ? 'الطريقة' : 'Method'}</th>
                <th className="px-3 py-2 text-right">{ar ? 'دفتر' : 'Ledger qty'}</th>
                <th className="px-3 py-2 text-right">{ar ? 'قيمة' : 'Value'}</th>
                <th className="px-3 py-2">{ar ? 'المشاكل' : 'Issues'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {data.mismatches.map((m) => (
                <tr key={String(m.productId)}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.sku}</div>
                  </td>
                  <td className="px-3 py-2.5">{m.costMethod}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.ledgerQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.stockValue}</td>
                  <td className="px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    {(m.issues || []).map((i) => i.code).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  )
}
