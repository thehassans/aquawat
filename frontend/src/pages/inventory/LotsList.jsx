import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

export default function LotsList() {
  const { language } = useSelector((s) => s.ui)
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['stock-lots', q],
    queryFn: () => api.get('/stock/lots', { params: { q: q || undefined, limit: 80 } }).then((r) => r.data),
  })
  const items = data?.items || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'الدفعات والأرقام التسلسلية' : 'Lots / Serials'}
        </h2>
        <div className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input w-full ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={language === 'ar' ? 'بحث…' : 'Search…'} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-dark-600">
            <tr>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'انتهاء' : 'Expiry'}</th>
              <th className="px-4 py-3 text-start">{language === 'ar' ? 'إزالة' : 'Removal'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={4} className="p-8"><EmptyState title={language === 'ar' ? 'لا دفعات' : 'No lots'} /></td></tr>
            )}
            {items.map((lot) => (
              <tr key={lot._id} className="border-b border-slate-50 dark:border-dark-700">
                <td className="px-4 py-3">
                  <Link to={`/app/dashboard/inventory/lots/${lot._id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                    {lot.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{language === 'ar' && lot.productId?.nameAr ? lot.productId.nameAr : lot.productId?.nameEn}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{lot.removalDate ? new Date(lot.removalDate).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function LotTraceability() {
  const { language } = useSelector((s) => s.ui)
  const { id } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['lot-trace', id],
    enabled: Boolean(id),
    queryFn: () => api.get(`/stock/lots/${id}/traceability`).then((r) => r.data),
  })

  if (isLoading) return <div className="text-slate-400">…</div>
  if (!data) return <EmptyState title={language === 'ar' ? 'غير موجود' : 'Not found'} />

  const Section = ({ title, nodes }) => (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-dark-600 dark:bg-dark-800">
      <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">{title}</h3>
      <ul className="space-y-2 text-sm">
        {(nodes || []).map((n) => (
          <li key={n.moveLineId} className="flex flex-wrap gap-2 border-b border-slate-50 pb-2 dark:border-dark-700">
            <span className="tabular-nums text-slate-500">{n.date ? new Date(n.date).toLocaleString() : ''}</span>
            <span className="font-medium">{n.quantity}</span>
            <span className="text-slate-600">{n.from} → {n.to}</span>
            <span className="text-primary-700">{n.transfer || n.reference}</span>
          </li>
        ))}
        {!nodes?.length && <li className="text-slate-400">—</li>}
      </ul>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <Link to="/app/dashboard/inventory/lots" className="text-sm text-primary-700 hover:underline">{language === 'ar' ? '← الدفعات' : '← Lots'}</Link>
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
          {data.lot?.name} · {data.lot?.productId?.nameEn}
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={language === 'ar' ? 'منبع' : 'Upstream'} nodes={data.upstream} />
        <Section title={language === 'ar' ? 'مصب' : 'Downstream'} nodes={data.downstream} />
      </div>
    </div>
  )
}
