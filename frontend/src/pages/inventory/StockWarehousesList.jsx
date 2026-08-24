import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function StockWarehousesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['stock-warehouses'],
    queryFn: () => api.get('/stock/warehouses').then((r) => r.data),
  })

  const { data: locations } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data),
  })

  const save = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/stock/warehouses/${id}`, body),
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث الخطوات والمسارات' : 'Steps & routes updated')
      setEditing(null)
      queryClient.invalidateQueries(['stock-warehouses'])
      queryClient.invalidateQueries(['stock-locations'])
      queryClient.invalidateQueries(['stock-routes'])
      queryClient.invalidateQueries(['stock-op-types'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  if (isLoading) return <div className="text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {(warehouses || []).map((wh) => (
          <div key={wh._id} className="card p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{wh.name}</h3>
                <p className="text-sm text-slate-500">{wh.code}</p>
              </div>
              <button type="button" className={ghostBtn} onClick={() => setEditing(editing === wh._id ? null : wh._id)}>
                {isAr ? 'خطوات' : 'Steps'}
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {wh.receptionSteps} / {wh.deliverySteps}
            </p>

            {editing === wh._id && (
              <form
                className="space-y-3 border-t border-slate-200 dark:border-dark-600 pt-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  save.mutate({
                    id: wh._id,
                    receptionSteps: fd.get('receptionSteps'),
                    deliverySteps: fd.get('deliverySteps'),
                  })
                }}
              >
                <div>
                  <label className="label">{isAr ? 'خطوات الاستلام' : 'Reception steps'}</label>
                  <select name="receptionSteps" className={fieldControlClass} defaultValue={wh.receptionSteps}>
                    <option value="one_step">1-step</option>
                    <option value="two_steps">2-steps (Input → Stock)</option>
                    <option value="three_steps">3-steps (Input → QC → Stock)</option>
                  </select>
                </div>
                <div>
                  <label className="label">{isAr ? 'خطوات التسليم' : 'Delivery steps'}</label>
                  <select name="deliverySteps" className={fieldControlClass} defaultValue={wh.deliverySteps}>
                    <option value="ship_only">Ship only</option>
                    <option value="pick_ship">Pick + Ship</option>
                    <option value="pick_pack_ship">Pick + Pack + Ship</option>
                  </select>
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? 'العمليات الجارية تحتفظ بسلاسلها الأصلية. التغيير يطبق على العمليات الجديدة.'
                    : 'In-flight pickings keep original chains. Changes apply to new transfers.'}
                </p>
                <button type="submit" className={primaryBtn} disabled={save.isPending}>
                  {isAr ? 'حفظ وإعادة حساب المسارات' : 'Save & recompute routes'}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">{isAr ? 'المواقع' : 'Locations'}</div>
        <div className="table-container max-h-96 overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الاستخدام' : 'Usage'}</th>
              </tr>
            </thead>
            <tbody>
              {(locations || []).map((loc) => (
                <tr key={loc._id}>
                  <td>{loc.completeName}</td>
                  <td><span className="badge badge-neutral">{loc.usage}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
