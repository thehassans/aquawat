import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { ghostBtn, primaryBtn, INVENTORY_PATH } from './inventoryUi'
import { InventoryPageHeader } from './InventoryChrome'

export default function LandedCostForm() {
  const { id } = useParams()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()

  const { data: lc, isLoading } = useQuery({
    queryKey: ['stock-landed-cost', id],
    queryFn: () => api.get(`/stock/landed-costs/${id}`).then((r) => r.data),
  })

  const compute = useMutation({
    mutationFn: () => api.post(`/stock/landed-costs/${id}/compute`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحساب' : 'Computed')
      queryClient.invalidateQueries(['stock-landed-cost', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const validate = useMutation({
    mutationFn: () => api.post(`/stock/landed-costs/${id}/validate`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الاعتماد' : 'Validated')
      queryClient.invalidateQueries(['stock-landed-cost', id])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isLoading) return <div className="text-slate-500">…</div>
  if (!lc) return <div>{isAr ? 'غير موجود' : 'Not found'}</div>

  return (
    <div className="space-y-8">
      <InventoryPageHeader
        title={lc.name}
        backTo={INVENTORY_PATH.landedCosts}
        backLabel={isAr ? 'التكاليف المرسية' : 'Landed costs'}
        actions={(
          <>
            <span className={`badge ${lc.state === 'done' ? 'badge-success' : 'badge-warning'}`}>{lc.state}</span>
            {lc.state === 'draft' && (
              <>
                <button type="button" className={ghostBtn} onClick={() => compute.mutate()}>{isAr ? 'حساب' : 'Compute'}</button>
                <button type="button" className={primaryBtn} onClick={() => validate.mutate()}>{isAr ? 'اعتماد' : 'Validate'}</button>
              </>
            )}
          </>
        )}
      />

      <div className="card p-4">
        <h3 className="font-medium mb-2">{isAr ? 'بنود التكلفة' : 'Cost lines'}</h3>
        <ul className="text-sm space-y-1">
          {(lc.costLines || []).map((c, i) => (
            <li key={i}>{c.name}: {c.price} ({c.splitMethod})</li>
          ))}
        </ul>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">{isAr ? 'تعديلات التقييم' : 'Valuation adjustments'}</div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Additional</th>
                <th>Unit add</th>
              </tr>
            </thead>
            <tbody>
              {(lc.valuationAdjustmentLines || []).map((a, i) => (
                <tr key={i}>
                  <td className="text-sm">{String(a.productId).slice(-8)}</td>
                  <td>{a.quantity}</td>
                  <td>{a.additionalCost}</td>
                  <td>{a.unitCostAdditional}</td>
                </tr>
              ))}
              {!lc.valuationAdjustmentLines?.length && (
                <tr><td colSpan={4} className="text-center text-slate-500 py-6">{isAr ? 'اضغط حساب أولاً' : 'Compute first'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
