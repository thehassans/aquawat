import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { fieldControlClass, ghostBtn, primaryBtn } from './inventoryUi'

export default function RoutesList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['stock-routes'],
    queryFn: () => api.get('/stock/routes').then((r) => r.data),
  })

  const { data: rules = [] } = useQuery({
    queryKey: ['stock-rules'],
    queryFn: () => api.get('/stock/rules').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/routes', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم' : 'Created')
      setName('')
      queryClient.invalidateQueries(['stock-routes'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'المسارات' : 'Routes'}</h1>
        <p className="text-gray-500 mt-1">{isAr ? 'مجموعات قواعد السحب/الدفع' : 'Ordered sets of pull/push rules'}</p>
      </div>

      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          create.mutate({ name: name.trim() })
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <label className="label">{isAr ? 'اسم المسار' : 'Route name'}</label>
          <input className={fieldControlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className={primaryBtn}><Plus className="w-4 h-4" />{isAr ? 'إضافة' : 'Add'}</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && <div className="text-slate-500">…</div>}
        {routes.map((route) => {
          const routeRules = rules.filter((r) => String(r.routeId?._id || r.routeId) === String(route._id))
          return (
            <div key={route._id} className="card p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{route.name}</h3>
                  <p className="text-xs text-slate-500">seq {route.sequence}</p>
                </div>
                <span className={`badge ${route.active ? 'badge-success' : 'badge-neutral'}`}>
                  {route.active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مؤرشف' : 'Archived')}
                </span>
              </div>
              <ul className="text-sm space-y-1">
                {routeRules.length === 0 && <li className="text-slate-400">{isAr ? 'لا قواعد' : 'No rules'}</li>}
                {routeRules.map((rule) => (
                  <li key={rule._id} className="border-s-2 border-teal-500 ps-2">
                    <span className="font-medium">{rule.action}</span>
                    {' · '}
                    {rule.locationSrcId?.completeName || '—'}
                    {' → '}
                    {rule.locationDestId?.completeName || '—'}
                    <span className="text-xs text-slate-400"> ({rule.procureMethod})</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
