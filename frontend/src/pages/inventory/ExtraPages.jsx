import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { StatusChip } from './inventoryUi'

export function PackagesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState('')
  const [typeName, setTypeName] = useState('')

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['inv-packages'],
    queryFn: () => api.get('/stock/packages').then((r) => r.data),
  })
  const { data: types = [] } = useQuery({
    queryKey: ['inv-package-types'],
    queryFn: () => api.get('/stock/package-types').then((r) => r.data),
  })

  const createType = useMutation({
    mutationFn: () => api.post('/stock/package-types', { name: typeName }),
    onSuccess: () => {
      toast.success(ar ? 'تم النوع' : 'Type created')
      setTypeName('')
      qc.invalidateQueries({ queryKey: ['inv-package-types'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const createPkg = useMutation({
    mutationFn: () => api.post('/stock/packages', { name, packageTypeId: typeId || undefined }),
    onSuccess: () => {
      toast.success(ar ? 'تم الطرد' : 'Package created')
      setName('')
      qc.invalidateQueries({ queryKey: ['inv-packages'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
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
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Type'}</th>
                <th className="px-3 py-2">{ar ? 'التاريخ' : 'Packed'}</th>
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
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['returns-candidates'],
    queryFn: () => api.get('/stock/transfers', {
      params: { state: 'done', limit: 40 },
    }).then((r) => r.data),
  })

  const returnMut = useMutation({
    mutationFn: async (id) => {
      const wiz = await api.get(`/stock/transfers/${id}/return-wizard`).then((r) => r.data)
      const lines = (wiz.lines || []).map((l) => ({ moveId: l.moveId, quantity: l.quantity }))
      return api.post(`/stock/transfers/${id}/return`, { lines }).then((r) => r.data)
    },
    onSuccess: (ret) => {
      toast.success(ar ? 'تم إنشاء المرتجع' : 'Return created')
      qc.invalidateQueries({ queryKey: ['returns-candidates'] })
      const code = ret.operationTypeId?.code
      const path = code === 'incoming' ? 'receipts' : code === 'outgoing' ? 'deliveries' : 'internal'
      window.location.href = `/app/dashboard/inventory/${path}/${ret._id}`
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const rows = data?.data || []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{ar ? 'المرتجعات' : 'Returns'}</h2>
        <p className="text-sm text-slate-500">
          {ar ? 'إنشاء مرتجع من تحويل مكتمل — يعكس الحركة عبر المحرك' : 'Create a return from a done transfer — reverses via the engine'}
        </p>
      </div>
      {isLoading ? <div className="text-sm text-slate-500">…</div> : !rows.length ? (
        <EmptyState title={ar ? 'لا تحويلات مكتملة' : 'No done transfers'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'المرجع' : 'Reference'}</th>
                <th className="px-3 py-2">{ar ? 'الأصل' : 'Origin'}</th>
                <th className="px-3 py-2">{ar ? 'الحالة' : 'State'}</th>
                <th className="px-3 py-2" />
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
                      disabled={returnMut.isPending}
                      onClick={() => {
                        if (window.confirm(ar ? 'إنشاء مرتجع كامل؟' : 'Create a full return?')) {
                          returnMut.mutate(t._id)
                        }
                      }}
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
    </div>
  )
}

export function ReferencesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'

  const { data, isLoading } = useQuery({
    queryKey: ['procurement-groups'],
    queryFn: () => api.get('/stock/procurement-groups').then((r) => r.data),
  })
  const items = data?.items || []

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'المراجع / مجموعات التوريد' : 'References / Procurement groups'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar ? 'مجموعات الشراء الناتجة عن المجدول والقواعد' : 'Procurement groups created by the scheduler and rules'}
        </p>
      </div>
      {isLoading ? <div className="text-sm text-slate-500">…</div> : !items.length ? (
        <EmptyState title={ar ? 'لا مجموعات بعد' : 'No procurement groups yet'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2">{ar ? 'النوع' : 'Move type'}</th>
                <th className="px-3 py-2">{ar ? 'المصدر' : 'Origin'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((g) => (
                <tr key={g._id}>
                  <td className="px-3 py-2.5 font-medium">{g.name}</td>
                  <td className="px-3 py-2.5">{g.moveType}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{g.originModel || '—'} {g.originDocId ? String(g.originDocId).slice(-6) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    queryFn: () => api.get('/stock/delivery-carriers').then((r) => r.data),
  })
  const items = data?.items || []

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
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const rateMut = useMutation({
    mutationFn: (id) => api.post(`/stock/delivery-carriers/${id}/rate`, {
      orderTotal: rateOrderTotal || undefined,
    }).then((r) => r.data),
    onSuccess: (res) => {
      setLastRate(res)
      toast.success(`${res.price} ${res.currency} (${res.source})`)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'طرق التسليم' : 'Delivery methods'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'تسعير ثابت محليًا — الموصلات الحية تبقى غير مثبتة'
            : 'Local fixed-price rating — live connectors stay not installed'}
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
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                <th className="px-3 py-2">{ar ? 'السعر' : 'Fixed'}</th>
                <th className="px-3 py-2">{ar ? 'مجاني فوق' : 'Free above'}</th>
                <th className="px-3 py-2">{ar ? 'موصل' : 'Provider'}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((c) => (
                <tr key={c._id}>
                  <td className="px-3 py-2.5 font-medium">{ar && c.nameAr ? c.nameAr : c.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{c.fixedPrice}</td>
                  <td className="px-3 py-2.5 tabular-nums">{c.freeAbove ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {c.providerCode}
                    {c.installed ? '' : (ar ? ' (وهمي)' : ' (stub)')}
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

export function ShippingConnectorsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'

  const { data: settings } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
  })
  const { data } = useQuery({
    queryKey: ['delivery-carriers'],
    queryFn: () => api.get('/stock/delivery-carriers').then((r) => r.data),
  })

  const flags = [
    ['moduleCarrierSmsa', 'SMSA'],
    ['moduleCarrierAramex', 'Aramex'],
    ['moduleCarrierNaqel', 'Naqel'],
    ['moduleCarrierUps', 'UPS'],
    ['moduleCarrierDhl', 'DHL'],
    ['moduleCarrierFedex', 'FedEx'],
    ['moduleCarrierUsps', 'USPS'],
    ['moduleCarrierEasypost', 'Easypost'],
    ['moduleCarrierSendcloud', 'Sendcloud'],
  ]

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'موصلات الشحن' : 'Shipping connectors'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'العلم يفعّل صفًا وهميًا فقط — لا واجهات حية حتى يُؤكَّد'
            : 'Flags only create stub carrier rows — no live APIs until confirmed'}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {flags.map(([key, label]) => (
          <div key={key} className="rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-dark-600">
            <div className="font-medium">{label}</div>
            <div className={`text-xs ${settings?.[key] ? 'text-emerald-600' : 'text-slate-400'}`}>
              {settings?.[key]
                ? (ar ? 'مفعّل (وهمي)' : 'Enabled (stub)')
                : (ar ? 'متوقف — من الإعدادات' : 'Off — enable in Settings')}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {(data?.items || []).filter((c) => c.providerCode && c.providerCode !== 'none').length}{' '}
        {ar ? 'صف موصل في القاعدة' : 'provider stub row(s) in DB'}
        {' · '}
        <Link to="/app/dashboard/inventory/settings" className="text-primary-600 hover:underline">
          {ar ? 'الإعدادات' : 'Settings'}
        </Link>
      </p>
    </div>
  )
}

export function ProductPackagingPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [barcode, setBarcode] = useState('')
  const [typeId, setTypeId] = useState('')
  const [filterProductId, setFilterProductId] = useState('')
  const [productQ, setProductQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-product-packagings', filterProductId],
    queryFn: () => api.get('/stock/product-packagings', {
      params: filterProductId ? { productId: filterProductId } : undefined,
    }).then((r) => r.data),
  })

  const { data: types = [] } = useQuery({
    queryKey: ['inv-package-types'],
    queryFn: () => api.get('/stock/package-types').then((r) => r.data),
  })

  const { data: productsRaw } = useQuery({
    queryKey: ['products-packaging-picker', productQ],
    queryFn: () => api.get('/products', {
      params: { search: productQ || undefined, limit: 40, productType: 'goods' },
    }).then((r) => r.data),
  })

  const products = productsRaw?.products || productsRaw?.data || (Array.isArray(productsRaw) ? productsRaw : [])
  const items = data?.items || (Array.isArray(data) ? data : [])

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/product-packagings', {
      productId,
      name,
      qty: qty || '1',
      barcode: barcode || undefined,
      packageTypeId: typeId || undefined,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم إنشاء التعبئة' : 'Packaging created')
      setName('')
      setQty('1')
      setBarcode('')
      qc.invalidateQueries({ queryKey: ['inv-product-packagings'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/stock/product-packagings/${id}`, body),
    onSuccess: () => {
      toast.success(ar ? 'تم التحديث' : 'Updated')
      qc.invalidateQueries({ queryKey: ['inv-product-packagings'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const productLabel = (p) => {
    if (!p) return '—'
    const n = ar ? (p.nameAr || p.nameEn) : (p.nameEn || p.nameAr)
    return p.sku ? `${n} (${p.sku})` : n
  }

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'تعبئة المنتجات' : 'Product packagings'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'عبوات البيع/الشراء (مثل صندوق = 12) — لا تكتب الرصيد مباشرة'
            : 'Sales/purchase pack sizes (e.g. box of 12) — never write stock directly'}
        </p>
      </div>

      <form
        className="grid gap-2 rounded-xl border border-slate-200/80 p-3 sm:grid-cols-2 lg:grid-cols-6 dark:border-dark-600"
        onSubmit={(e) => {
          e.preventDefault()
          if (!productId || !name) return
          createMut.mutate()
        }}
      >
        <div className="lg:col-span-2">
          <label className="label text-xs">{ar ? 'المنتج' : 'Product'}</label>
          <input
            className="input input-sm mb-1"
            placeholder={ar ? 'بحث…' : 'Search…'}
            value={productQ}
            onChange={(e) => setProductQ(e.target.value)}
          />
          <select className="select select-sm w-full" required value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{ar ? '— اختر —' : '— Select —'}</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>{productLabel(p)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
          <input className="input input-sm" required value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? 'صندوق' : 'Box'} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'الكمية' : 'Qty'}</label>
          <input className="input input-sm" required value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'باركود' : 'Barcode'}</label>
          <input className="input input-sm" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <select className="select select-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{ar ? '— نوع طرد —' : '— Package type —'}</option>
            {(Array.isArray(types) ? types : []).map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>
            <Plus className="h-4 w-4" /> {ar ? 'إضافة' : 'Add'}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label text-xs">{ar ? 'تصفية بالمنتج' : 'Filter by product'}</label>
          <select className="select select-sm" value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)}>
            <option value="">{ar ? 'الكل' : 'All'}</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>{productLabel(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !items.length ? (
        <EmptyState title={ar ? 'لا تعبئة' : 'No packagings'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2">{ar ? 'التعبئة' : 'Packaging'}</th>
                <th className="px-3 py-2">{ar ? 'الكمية' : 'Qty'}</th>
                <th className="px-3 py-2">{ar ? 'باركود' : 'Barcode'}</th>
                <th className="px-3 py-2">{ar ? 'الحالة' : 'Active'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => (
                <tr key={row._id}>
                  <td className="px-3 py-2.5">{productLabel(row.productId)}</td>
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.qty}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{row.barcode || '—'}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-xs text-primary-600 hover:underline"
                      onClick={() => patchMut.mutate({ id: row._id, active: row.active === false })}
                    >
                      {row.active === false
                        ? (ar ? 'تفعيل' : 'Activate')
                        : (ar ? 'إيقاف' : 'Deactivate')}
                    </button>
                    {' · '}
                    <StatusChip status={row.active === false ? 'cancelled' : 'done'} language={language} />
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
