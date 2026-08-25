import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { fieldControlClass } from './inventoryUi'

export default function OperationTypesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-operation-types'],
    queryFn: () => api.get('/stock/operation-types').then((r) => r.data),
  })

  const patch = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/stock/operation-types/${id}`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Updated')
      queryClient.invalidateQueries(['stock-operation-types'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{isAr ? 'أنواع العمليات' : 'Operation Types'}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isAr ? 'الحجز، المرتجعات الجزئية، وإنشاء الدفعات' : 'Reservation, backorders, and lot creation'}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الكود' : 'Code'}</th>
                <th>{isAr ? 'المستودع' : 'Warehouse'}</th>
                <th>{isAr ? 'الحجز' : 'Reservation'}</th>
                <th>{isAr ? 'المرتجع' : 'Backorder'}</th>
                <th>{isAr ? 'إنشاء دفعات' : 'Create lots'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-6">…</td></tr>}
              {items.map((t) => (
                <tr key={t._id}>
                  <td>{t.name}</td>
                  <td>{t.code}</td>
                  <td>{t.warehouseId?.name || t.warehouseId?.code || '—'}</td>
                  <td>
                    <select
                      className={fieldControlClass}
                      value={t.reservationMethod || 'at_confirm'}
                      onChange={(e) => patch.mutate({ id: t._id, reservationMethod: e.target.value })}
                    >
                      <option value="at_confirm">at_confirm</option>
                      <option value="manual">manual</option>
                      <option value="by_date">by_date</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className={fieldControlClass}
                      value={t.createBackorder || 'ask'}
                      onChange={(e) => patch.mutate({ id: t._id, createBackorder: e.target.value })}
                    >
                      <option value="ask">ask</option>
                      <option value="always">always</option>
                      <option value="never">never</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(t.useCreateLots)}
                      onChange={(e) => patch.mutate({ id: t._id, useCreateLots: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
              {!isLoading && !items.length && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-500">{isAr ? 'لا أنواع' : 'No operation types'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
