import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import { INVENTORY_PATH } from './inventoryUi'
import { InventoryPageHeader } from './InventoryChrome'

export default function LotTraceability() {
  const { id } = useParams()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const { data, isLoading } = useQuery({
    queryKey: ['stock-lot-trace', id],
    queryFn: () => api.get(`/stock/lots/${id}/traceability`).then((r) => r.data),
  })

  if (isLoading) return <div className="text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
  if (!data) return <div>{isAr ? 'غير موجود' : 'Not found'}</div>

  const Tree = ({ title, nodes }) => (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {!nodes?.length && <p className="text-sm text-slate-500">{isAr ? 'لا يوجد' : 'None'}</p>}
      <ul className="space-y-2">
        {nodes?.map((n) => (
          <li key={n.moveLineId} className="text-sm border-s-2 border-teal-500 ps-3">
            <div className="font-medium">{n.date ? new Date(n.date).toLocaleString() : '—'}</div>
            <div className="text-slate-600 dark:text-slate-300">
              {n.from} → {n.to} · qty {n.quantity}
            </div>
            <div className="text-xs text-slate-400">
              {n.picking || n.reference}{n.origin ? ` · ${n.origin}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="space-y-8">
      <InventoryPageHeader
        title={data.lot?.name}
        subtitle={isAr ? 'تتبع المنشأ والمصير' : 'Upstream & downstream traceability'}
        backTo={INVENTORY_PATH.lots}
        backLabel={isAr ? 'الدفعات' : 'Lots'}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Tree title={isAr ? 'المنشأ (Upstream)' : 'Upstream'} nodes={data.upstream} />
        <Tree title={isAr ? 'المصير (Downstream)' : 'Downstream'} nodes={data.downstream} />
      </div>
    </div>
  )
}
