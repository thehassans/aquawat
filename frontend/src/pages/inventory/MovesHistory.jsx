import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, useReportFilters } from './ReportShell'

export default function MovesHistory() {
  const { language } = useSelector((s) => s.ui)
  const [direction, setDirection] = useState('')
  const { queryParams } = useReportFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['moves-history', direction, queryParams],
    queryFn: () =>
      api.get('/stock/moves-history', {
        params: { ...queryParams, direction: direction || undefined, limit: 80 },
      }).then((r) => r.data),
  })

  const items = data?.items || []

  return (
    <ReportShell
      activeId="moves"
      title={language === 'ar' ? 'سجل الحركات' : 'Moves History'}
      subtitle={language === 'ar' ? 'حركات المخزون المكتملة' : 'Completed inventory move lines'}
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
              {language === 'ar' ? d.ar : d.en}
            </button>
          ))}
        </div>
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600">
            <tr>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المرجع' : 'Reference'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'دفعة' : 'Lot'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'من' : 'From'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'إلى' : 'To'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={7} className="p-8"><EmptyState title={language === 'ar' ? 'لا حركات' : 'No moves'} /></td></tr>
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
                <td className="px-4 py-3">{language === 'ar' && line.productId?.nameAr ? line.productId.nameAr : line.productId?.nameEn}</td>
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
