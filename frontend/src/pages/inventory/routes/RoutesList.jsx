import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import { invTableClass, invTableWrapClass, invThClass, invTdClass } from '../inventoryUi'
import { ConfigModal } from '../ConfigModal'

/**
 * Master list of inventory routes.
 */
export default function RoutesList() {
  const { language } = useSelector((s) => s.ui)
  const auth = useSelector((s) => s.auth)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')

  const companyName = auth?.user?.tenant?.name
    || auth?.tenant?.name
    || auth?.user?.companyName
    || (ar ? 'الشركة' : 'Company')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-routes'],
    queryFn: () => api.get('/stock/routes').then((r) => asInvList(r.data)),
  })

  const routes = data || []

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return routes
    return routes.filter((r) => {
      const hay = [r.name, r.nameAr].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [routes, q])

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/routes', {
      name,
      productSelectable: true,
      categorySelectable: true,
      warehouseSelectable: true,
      saleOrderSelectable: false,
    }),
    onSuccess: (res) => {
      toast.success(ar ? 'تم إنشاء المسار' : 'Route created')
      setModalOpen(false)
      setName('')
      qc.invalidateQueries({ queryKey: ['inv-routes'] })
      const id = res.data?._id
      if (id) navigate(`/app/dashboard/inventory/routes/${id}`)
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="flex min-h-[60vh] flex-col gap-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'المسارات' : 'Routes'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'مسارات لوجستية تتحكم بتدفق المخزون عبر القواعد.'
              : 'Logistics routes that drive inventory flow through nested rules.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          {ar ? 'مسار جديد' : 'New route'}
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm outline-none focus:border-sky-600/40 focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-800"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? 'بحث…' : 'Search…'}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !filtered.length ? (
        <EmptyState
          title={ar ? 'لا مسارات' : 'No routes yet'}
          description={ar
            ? 'أنشئ مسارًا أو أعد حساب مسارات المستودع من الإعدادات'
            : 'Create a route or recompute warehouse routes from settings'}
        />
      ) : (
        <div className={`${invTableWrapClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className={`${invTableClass} min-w-[640px]`}>
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-start text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
                <tr>
                  <th className={invThClass}>{ar ? 'اسم المسار' : 'Route name'}</th>
                  <th className={invThClass}>{ar ? 'الشركة' : 'Company'}</th>
                  <th className={invThClass}>{ar ? 'نشط' : 'Active'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r._id}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-700/40"
                    onClick={() => navigate(`/app/dashboard/inventory/routes/${r._id}`)}
                  >
                    <td className={invTdClass}>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {ar && r.nameAr ? r.nameAr : r.name}
                      </span>
                      {r.nameAr && !ar ? <div className="text-xs text-slate-400">{r.nameAr}</div> : null}
                    </td>
                    <td className={`${invTdClass} text-slate-600 dark:text-slate-300`}>{companyName}</td>
                    <td className={invTdClass}>
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          r.active !== false
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                            : 'bg-slate-100 text-slate-500 line-through'
                        }`}
                      >
                        {r.active !== false ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Inactive')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ar={ar}
        title={ar ? 'مسار جديد' : 'New route'}
        subtitle={ar ? 'مثال: Cross-Dock أو Dropship' : 'e.g. Cross-Dock or Dropship'}
        footer={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createMut.isPending || !name.trim()}
              onClick={() => createMut.mutate()}
            >
              {ar ? 'إنشاء' : 'Create'}
            </button>
          </>
        )}
      >
        <div>
          <label className="label text-xs">{ar ? 'اسم المسار' : 'Route name'}</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ar ? 'Cross-Dock' : 'Cross-Dock'}
            autoFocus
          />
        </div>
      </ConfigModal>

      <p className="text-xs text-slate-400">
        <Link to="/app/dashboard/inventory/reordering-rules" className="text-sky-800 hover:underline dark:text-sky-300">
          {ar ? 'قواعد إعادة الطلب' : 'Reordering rules'}
        </Link>
      </p>
    </div>
  )
}
