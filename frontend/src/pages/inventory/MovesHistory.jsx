import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, useReportFilters, exportCsv } from './ReportShell'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import { formatInvError } from '../../lib/invError'

export default function MovesHistory() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [direction, setDirection] = useState('')
  const [exporting, setExporting] = useState(false)
  const { queryParams, filters } = useReportFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['moves-history', direction, queryParams],
    queryFn: () =>
      api.get('/stock/moves-history', {
        params: { ...queryParams, direction: direction || undefined, limit: 80 },
      }).then((r) => r.data),
  })

  const items = asInvList(data)
  const view = filters.view || 'list'

  const exportFull = async () => {
    setExporting(true)
    try {
      const res = await api.get('/stock/moves-history', {
        params: { ...queryParams, direction: direction || undefined, limit: 10000, page: 1 },
      })
      const rows = res.data?.items || []
      exportCsv('moves-history.csv', rows, [
        { label: 'Date', get: (r) => (r.updatedAt ? new Date(r.updatedAt).toISOString() : '') },
        { label: 'Reference', get: (r) => r.transferId?.name || r.reference || '' },
        { label: 'Product', get: (r) => r.productId?.nameEn || '' },
        { label: 'SKU', get: (r) => r.productId?.sku || '' },
        { label: 'Lot', get: (r) => r.lotId?.name || '' },
        { label: 'From', get: (r) => r.sourceLocationId?.completePath || r.sourceLocationId?.name || '' },
        { label: 'To', get: (r) => r.destLocationId?.completePath || r.destLocationId?.name || '' },
        { label: 'Qty', get: (r) => r.quantityInProductUom || r.quantity || '' },
      ])
      toast.success(ar ? `تم تصدير ${rows.length} سطر` : `Exported ${rows.length} rows`)
    } catch (e) {
      toast.error(formatInvError(e, language))
    } finally {
      setExporting(false)
    }
  }

  return (
    <ReportShell
      activeId="moves"
      title={ar ? 'سجل الحركات' : 'Moves History'}
      subtitle={ar ? 'حركات المخزون المكتملة — التصدير يشمل كل النتائج المصفّاة' : 'Completed move lines — export includes the full filtered set'}
      extraFilters={(
        <div className="flex gap-1">
          {[
            { id: '', en: 'All', ar: 'الكل' },
            { id: 'incoming', en: 'Incoming', ar: 'وارد' },
            { id: 'outgoing', en: 'Outgoing', ar: 'صادر' },
            { id: 'internal', en: 'Internal', ar: 'داخلي' },
          ].map((d) => (
            <button
              key={d.id || 'all'}
              type="button"
              className={`btn btn-sm ${direction === d.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDirection(d.id)}
            >
              {ar ? d.ar : d.en}
            </button>
          ))}
        </div>
      )}
      toolbar={(
        <div className="flex flex-wrap gap-2">
          <InventoryIeButtons
            model="moves_history"
            importable={false}
            ar={ar}
            filters={{ ...queryParams, direction: direction || undefined }}
          />
          <button type="button" className="btn btn-secondary btn-sm" disabled={exporting} onClick={exportFull}>
            {exporting ? '…' : (ar ? 'تصدير الكل' : 'Export all')}
          </button>
        </div>
      )}
    >
      {view === 'graph' && items.length > 0 && (
        <div className="rounded-xl border border-slate-200/80 p-4 text-sm text-slate-500 dark:border-dark-600">
          {ar ? 'استخدم تحليل الحركات للرسوم المحورية.' : 'Use Moves Analysis for pivot charts.'}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600">
            <tr>
              <th className="px-4 py-3 text-start">{ar ? 'التاريخ' : 'Date'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'المرجع' : 'Reference'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'دفعة' : 'Lot'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'من' : 'From'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'إلى' : 'To'}</th>
              <th className="px-4 py-3 text-start">{ar ? 'الكمية' : 'Qty'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={7} className="p-8"><EmptyState title={ar ? 'لا حركات' : 'No moves'} /></td></tr>
            )}
            {items.map((line) => (
              <tr key={line._id} className="border-b border-slate-50 dark:border-dark-700">
                <td className="px-4 py-3 tabular-nums text-slate-500">
                  {line.updatedAt ? new Date(line.updatedAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {line.transferId?._id ? (
                    <Link className="text-primary-700 hover:underline dark:text-primary-300" to={`/app/dashboard/inventory/receipts/${line.transferId._id}`}>
                      {line.transferId?.name || line.reference}
                    </Link>
                  ) : (
                    line.reference || '—'
                  )}
                </td>
                <td className="px-4 py-3">{ar && line.productId?.nameAr ? line.productId.nameAr : line.productId?.nameEn}</td>
                <td className="px-4 py-3">
                  {line.lotId?._id ? (
                    <Link className="hover:underline" to={`/app/dashboard/inventory/lots/${line.lotId._id}`}>{line.lotId.name}</Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{line.sourceLocationId?.completePath || line.sourceLocationId?.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{line.destLocationId?.completePath || line.destLocationId?.name}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{line.quantityInProductUom || line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.total != null && (
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-dark-600">
            1–{items.length} / {data.total}
          </div>
        )}
      </div>
    </ReportShell>
  )
}
