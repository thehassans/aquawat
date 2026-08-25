import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, useReportFilters, exportCsv } from './ReportShell'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'

export default function StockReport() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const { filters, setFilter, queryParams } = useReportFilters()
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
    staleTime: 10 * 60 * 1000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['stock-report', queryParams.warehouseId],
    queryFn: () =>
      api.get('/stock/report/stock', {
        params: queryParams.warehouseId ? { warehouseId: queryParams.warehouseId } : {},
      }).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const adjust = useMutation({
    mutationFn: ({ productId, onHand }) =>
      api.post(`/stock/report/stock/${productId}/adjust`, {
        warehouseId: filters.warehouseId || warehouses[0]?._id,
        onHand,
        reason: 'Stock report inline edit',
      }),
    onSuccess: () => {
      toast.success(ar ? 'تم عبر حركة تسوية' : 'Adjusted via ledger move')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['stock-report'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const rows = data?.data || []
  const whList = Array.isArray(warehouses) ? warehouses : []

  return (
    <ReportShell
      activeId="stock"
      title={ar ? 'تقرير المخزون' : 'Stock report'}
      subtitle={ar
        ? 'تعديل الكمية ينشئ حركة تسوية — لا كتابة مباشرة على الرصيد.'
        : 'Editing On Hand creates an adjustment transfer — never a direct quantity write.'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {data?.valueTotal != null && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {ar ? 'إجمالي القيمة' : 'Total value'}:{' '}
            <span className="font-semibold tabular-nums">{data.valueTotal}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <InventoryIeButtons
            model="stock"
            importable={false}
            ar={ar}
            filters={{ warehouseId: filters.warehouseId || undefined }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!rows.length}
            onClick={() => exportCsv('stock-report.csv', rows, [
              { label: 'SKU', get: (r) => r.product?.sku },
              { label: 'Name', get: (r) => r.product?.nameEn },
              { label: 'OnHand', get: (r) => r.onHand },
              { label: 'Free', get: (r) => r.freeToUse },
              { label: 'Forecast', get: (r) => r.forecast },
              { label: 'UnitCost', get: (r) => r.unitCost },
              { label: 'Value', get: (r) => r.value },
            ])}
          >
            CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
            <tr>
              <th className="px-4 py-3 text-start">{ar ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'التكلفة' : 'Unit cost'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'القيمة' : 'Value'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'المتاح' : 'On hand'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'حر' : 'Free'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'وارد' : 'In'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'صادر' : 'Out'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'متوقع' : 'Forecast'}</th>
            </tr>
          </thead>
          <tbody className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
            {isLoading && !rows.length && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8">
                  <EmptyState
                    title={ar ? 'لا مخزون بعد' : 'No stock yet'}
                    description={ar ? 'رحّل الأرصدة أو استلم بضاعة' : 'Migrate balances or validate a receipt'}
                  />
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.productId} className="border-b border-slate-50 dark:border-dark-700">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {ar && row.product?.nameAr ? row.product.nameAr : row.product?.nameEn}
                  </div>
                  <div className="text-xs text-slate-400">{row.product?.sku}</div>
                </td>
                <td className="px-4 py-3 tabular-nums">{row.unitCost ?? '—'}</td>
                <td className="px-4 py-3 tabular-nums">{row.value ?? '—'}</td>
                <td className="px-4 py-3">
                  {editing === row.productId ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!filters.warehouseId && !whList[0]?._id) {
                          toast.error(ar ? 'اختر مستودعاً' : 'Select a warehouse')
                          return
                        }
                        adjust.mutate({ productId: row.productId, onHand: editValue })
                      }}
                    >
                      <input
                        className="input w-24"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-primary btn-sm">OK</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>×</button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="tabular-nums font-medium text-primary-700 hover:underline dark:text-primary-300"
                      onClick={() => {
                        if (!filters.warehouseId) setFilter('warehouseId', whList[0]?._id || '')
                        setEditing(row.productId)
                        setEditValue(row.onHand)
                      }}
                    >
                      {row.onHand}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.freeToUse}</td>
                <td className="px-4 py-3 tabular-nums text-emerald-600">{row.incoming}</td>
                <td className="px-4 py-3 tabular-nums text-rose-600">{row.outgoing}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{row.forecast}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}
