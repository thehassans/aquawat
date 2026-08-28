import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { StatusChip, invTableWrapClass } from './inventoryUi'
import { formatInvError } from '../../lib/invError'
import ReverseTransferModal from './returns/ReverseTransferModal'
import { inventoryPathForOpCode } from './returns/returnPaths'

export function PackagesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('')
  const [typeName, setTypeName] = useState('')

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['inv-packages'],
    queryFn: () => api.get('/stock/packages').then((r) => asInvList(r.data)),
  })
  const { data: types = [] } = useQuery({
    queryKey: ['inv-package-types'],
    queryFn: () => api.get('/stock/package-types').then((r) => asInvList(r.data)),
  })

  const createType = useMutation({
    mutationFn: () => api.post('/stock/package-types', { name: typeName }),
    onSuccess: () => {
      toast.success(ar ? 'تم النوع' : 'Type created')
      setTypeName('')
      qc.invalidateQueries({ queryKey: ['inv-package-types'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const createPkg = useMutation({
    mutationFn: () => api.post('/stock/packages', { name, packageTypeId: typeId || undefined }),
    onSuccess: () => {
      toast.success(ar ? 'تم الطرد' : 'Package created')
      setName('')
      qc.invalidateQueries({ queryKey: ['inv-packages'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const list = Array.isArray(packages) ? packages : []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{ar ? 'الطرود' : 'Packages'}</h2>
        <p className="text-sm text-slate-500">
          {ar ? 'أنواع الطرود والطرود الفعلية — لا تغيّر الرصيد مباشرة' : 'Package types and packages — never write stock directly'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/80 p-3 dark:border-dark-600"
          onSubmit={(e) => { e.preventDefault(); createType.mutate() }}
        >
          <div className="grow">
            <label className="label text-xs">{ar ? 'نوع طرد جديد' : 'New package type'}</label>
            <input className="input input-sm" required value={typeName} onChange={(e) => setTypeName(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={createType.isPending}>
            <Plus className="h-4 w-4" /> {ar ? 'نوع' : 'Type'}
          </button>
        </form>
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/80 p-3 dark:border-dark-600"
          onSubmit={(e) => { e.preventDefault(); createPkg.mutate() }}
        >
          <div className="grow">
            <label className="label text-xs">{ar ? 'اسم الطرد' : 'Package name'}</label>
            <input className="input input-sm" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <select className="select select-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{ar ? '— نوع —' : '— Type —'}</option>
            {(Array.isArray(types) ? types : []).map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={createPkg.isPending}>
            <Plus className="h-4 w-4" /> {ar ? 'طرد' : 'Package'}
          </button>
        </form>
      </div>

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !list.length ? (
        <EmptyState title={ar ? 'لا طرود' : 'No packages'} />
      ) : (
        <div className={invTableWrapClass}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'التاريخ' : 'Packed'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {list.map((p) => (
                <tr key={p._id}>
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-slate-500">{p.packageTypeId?.name || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">
                    {p.packDate ? new Date(p.packDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReturnsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const [returnTarget, setReturnTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['returns-candidates'],
    queryFn: () => api.get('/stock/transfers', {
      params: { state: 'done', limit: 40 },
    }).then((r) => r.data),
  })

  const rows = data?.data || data?.items || asInvList(data) || []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{ar ? 'المرتجعات' : 'Returns'}</h2>
        <p className="text-sm text-slate-500">
          {ar ? 'إنشاء مرتجع جزئي أو كامل من تحويل مكتمل' : 'Create a partial or full return from a done transfer'}
        </p>
      </div>
      {isLoading ? <div className="text-sm text-slate-500">…</div> : !rows.length ? (
        <EmptyState title={ar ? 'لا تحويلات مكتملة' : 'No done transfers'} />
      ) : (
        <div className={invTableWrapClass}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'المرجع' : 'Reference'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'الأصل' : 'Origin'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'الحالة' : 'State'}</th>
                <th className="min-w-[150px] px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {rows.map((t) => (
                <tr key={t._id}>
                  <td className="px-3 py-2.5">
                    <Link className="font-medium text-primary-600 hover:underline" to={`/app/dashboard/inventory/receipts/${t._id}`}>
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{t.origin || '—'}</td>
                  <td className="px-3 py-2.5"><StatusChip status={t.state} language={language} /></td>
                  <td className="px-3 py-2.5 text-end">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReturnTarget(t)}
                    >
                      {ar ? 'مرتجع' : 'Return'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReverseTransferModal
        open={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
        transferId={returnTarget?._id}
        transfer={returnTarget}
        ar={ar}
        language={language}
        onCreated={(ret) => {
          setReturnTarget(null)
          const path = inventoryPathForOpCode(ret.operationTypeId?.code || 'internal')
          navigate(`/app/dashboard/inventory/${path}/${ret._id}`)
        }}
      />
    </div>
  )
}

export function ReferencesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [selectedId, setSelectedId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['procurement-groups'],
    queryFn: () => api.get('/stock/procurement-groups').then((r) => r.data),
  })
  const items = data?.items || data?.data || []

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['procurement-group', selectedId],
    queryFn: () => api.get(`/stock/procurement-groups/${selectedId}`).then((r) => r.data),
    enabled: Boolean(selectedId),
  })

  const statusTone = (status) => {
    if (status === 'done') return 'bg-emerald-50 text-emerald-800'
    if (status === 'in_progress') return 'bg-sky-50 text-sky-800'
    if (status === 'open') return 'bg-amber-50 text-amber-800'
    return 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'المراجع / مجموعات التوريد' : 'References / Procurement groups'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar ? 'انقر صفاً لعرض التحويلات المرتبطة' : 'Click a row to view linked transfers'}
        </p>
      </div>
      {isLoading ? <div className="text-sm text-slate-500">…</div> : !items.length ? (
        <EmptyState title={ar ? 'لا مجموعات بعد' : 'No procurement groups yet'} />
      ) : (
        <div className={invTableWrapClass}>
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[160px] px-3 py-2">{ar ? 'المرجع' : 'Group reference'}</th>
                <th className="min-w-[160px] px-3 py-2">{ar ? 'المصدر' : 'Origin'}</th>
                <th className="min-w-[140px] px-3 py-2">{ar ? 'تاريخ التسليم' : 'Delivery date'}</th>
                <th className="min-w-[100px] px-3 py-2">{ar ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((g) => (
                <tr
                  key={g._id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-800/60"
                  onClick={() => setSelectedId(g._id)}
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{g.name}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                    {g.origin || [g.originModel, g.originDocId].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">
                    {g.deliveryDate ? new Date(g.deliveryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(g.status)}`}>
                      {g.status || 'draft'}
                    </span>
                    {g.transferCount != null ? (
                      <span className="ms-2 text-[11px] text-slate-400">{g.transferCount} xfer</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" onClick={() => setSelectedId(null)}>
          <aside
            className="flex h-full w-full max-w-md flex-col border-s border-slate-200 bg-white shadow-xl dark:border-dark-600 dark:bg-dark-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-dark-600">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {ar ? 'مجموعة التوريد' : 'Procurement group'}
                </p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {detail?.name || '…'}
                </h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
                {ar ? 'إغلاق' : 'Close'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingDetail ? (
                <p className="text-sm text-slate-500">…</p>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                    {ar ? 'المصدر' : 'Origin'}: {detail?.originModel || '—'}{' '}
                    {detail?.originDocId ? String(detail.originDocId).slice(-8) : ''}
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {ar ? 'التحويلات المرتبطة' : 'Linked transfers'}
                    </h4>
                    {!detail?.transfers?.length ? (
                      <p className="text-sm text-slate-400">{ar ? 'لا تحويلات' : 'No transfers'}</p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.transfers.map((t) => {
                          const op = t.operationTypeId?.code || ''
                          const href = op === 'incoming'
                            ? `/app/dashboard/inventory/receipts/${t._id}`
                            : op === 'outgoing'
                              ? `/app/dashboard/inventory/deliveries/${t._id}`
                              : `/app/dashboard/inventory/transfers/${t._id}`
                          return (
                            <li key={t._id} className="rounded-xl border border-slate-100 px-3 py-2 dark:border-dark-600">
                              <Link to={href} className="text-sm font-medium text-sky-700 hover:underline">
                                {t.name || t.reference || t._id}
                              </Link>
                              <div className="text-[11px] text-slate-400">
                                {t.operationTypeId?.name || op || 'transfer'} · {t.state}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  {detail?.moves?.length ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-800">{ar ? 'الحركات' : 'Moves'}</h4>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {detail.moves.slice(0, 20).map((m) => (
                          <li key={m._id}>
                            {m.productId?.nameEn || m.productId?.sku || '—'} · {m.state} · {m.productQty ?? m.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export function DeliveryMethodsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [freeAbove, setFreeAbove] = useState('')
  const [rateOrderTotal, setRateOrderTotal] = useState('100')
  const [lastRate, setLastRate] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-carriers'],
    queryFn: () => api.get('/stock/delivery-carriers').then((r) => asInvList(r.data)),
  })
  const items = data || []

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/delivery-carriers', {
      name,
      carrierType: 'fixed',
      fixedPrice: price,
      freeAbove: freeAbove || undefined,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم' : 'Created')
      setName('')
      qc.invalidateQueries({ queryKey: ['delivery-carriers'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const rateMut = useMutation({
    mutationFn: (id) => api.post(`/stock/delivery-carriers/${id}/rate`, {
      orderTotal: rateOrderTotal || undefined,
    }).then((r) => r.data),
    onSuccess: (res) => {
      setLastRate(res)
      toast.success(`${res.price} ${res.currency} (${res.source})`)
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'طرق التسليم' : 'Delivery methods'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'تسعير ثابت محلي — أضف طريقة تسليم واربطها بتحويلات الصادر.'
            : 'Local fixed-price methods — add a method and link it on outgoing transfers.'}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); createMut.mutate() }}
      >
        <div>
          <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
          <input className="input input-sm" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'السعر' : 'Fixed price'}</label>
          <input className="input input-sm w-28" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'مجاني فوق' : 'Free above'}</label>
          <input className="input input-sm w-28" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} placeholder="—" />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>
          <Plus className="h-4 w-4" /> {ar ? 'إضافة' : 'Add'}
        </button>
      </form>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label text-xs">{ar ? 'إجمالي الطلب لاختبار السعر' : 'Order total for rate test'}</label>
          <input className="input input-sm w-32" value={rateOrderTotal} onChange={(e) => setRateOrderTotal(e.target.value)} />
        </div>
        {lastRate ? (
          <p className="text-sm text-slate-600">
            {lastRate.name}: <strong>{lastRate.price}</strong> {lastRate.currency} · {lastRate.source}
          </p>
        ) : null}
      </div>

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !items.length ? (
        <EmptyState title={ar ? 'لا طرق بعد' : 'No delivery methods'} />
      ) : (
        <div className={invTableWrapClass}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'السعر' : 'Fixed'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'مجاني فوق' : 'Free above'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'موصل' : 'Provider'}</th>
                <th className="min-w-[150px] px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((c) => (
                <tr key={c._id}>
                  <td className="px-3 py-2.5 font-medium">{ar && c.nameAr ? c.nameAr : c.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{c.fixedPrice}</td>
                  <td className="px-3 py-2.5 tabular-nums">{c.freeAbove ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {c.providerCode || 'fixed'}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={rateMut.isPending}
                      onClick={() => rateMut.mutate(c._id)}
                    >
                      {ar ? 'سعّر' : 'Rate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
