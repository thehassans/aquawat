import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

export function AttributesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [valueName, setValueName] = useState('')
  const [valueNameAr, setValueNameAr] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-attributes'],
    queryFn: () => api.get('/stock/attributes', { params: { active: 'false' } }).then((r) => r.data),
  })
  const attrs = data?.items || []

  const { data: valuesData, isLoading: valuesLoading } = useQuery({
    queryKey: ['inv-attribute-values', selectedId],
    queryFn: () => api.get(`/stock/attributes/${selectedId}/values`).then((r) => r.data),
    enabled: Boolean(selectedId),
  })
  const values = valuesData?.items || []

  const createAttr = useMutation({
    mutationFn: () => api.post('/stock/attributes', { name, nameAr: nameAr || undefined }),
    onSuccess: (res) => {
      toast.success(ar ? 'تم إنشاء السمة' : 'Attribute created')
      setName('')
      setNameAr('')
      setSelectedId(res.data._id)
      qc.invalidateQueries({ queryKey: ['inv-attributes'] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const createVal = useMutation({
    mutationFn: () => api.post(`/stock/attributes/${selectedId}/values`, {
      name: valueName,
      nameAr: valueNameAr || undefined,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم القيمة' : 'Value added')
      setValueName('')
      setValueNameAr('')
      qc.invalidateQueries({ queryKey: ['inv-attribute-values', selectedId] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'سمات المنتج' : 'Product attributes'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'السمات والقيم لتوليد المتغيرات — الرصيد يبقى على productId + variantId'
            : 'Attributes and values for variant generation — stock stays on productId + variantId'}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); createAttr.mutate() }}
      >
        <div>
          <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
          <input className="input input-sm" required value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? 'اللون' : 'Color'} />
        </div>
        <div>
          <label className="label text-xs">{ar ? 'عربي' : 'Arabic'}</label>
          <input className="input input-sm" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={createAttr.isPending}>
          <Plus className="h-4 w-4" /> {ar ? 'سمة' : 'Attribute'}
        </button>
      </form>

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !attrs.length ? (
        <EmptyState title={ar ? 'لا سمات' : 'No attributes'} description={ar ? 'فعّل المتغيرات من الإعدادات أولاً' : 'Enable Variants in Settings first'} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
                <tr>
                  <th className="px-3 py-2">{ar ? 'السمة' : 'Attribute'}</th>
                  <th className="px-3 py-2">{ar ? 'متغير' : 'Creates variants'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                {attrs.map((a) => (
                  <tr
                    key={a._id}
                    className={`cursor-pointer ${selectedId === a._id ? 'bg-primary-50/50 dark:bg-primary-950/20' : ''}`}
                    onClick={() => setSelectedId(a._id)}
                  >
                    <td className="px-3 py-2.5 font-medium">
                      {ar && a.nameAr ? a.nameAr : a.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{a.createVariant !== false ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
            <h3 className="text-sm font-semibold">
              {selectedId
                ? (ar ? 'قيم السمة' : 'Attribute values')
                : (ar ? 'اختر سمة' : 'Select an attribute')}
            </h3>
            {selectedId && (
              <>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => { e.preventDefault(); createVal.mutate() }}
                >
                  <input className="input input-sm" required value={valueName} onChange={(e) => setValueName(e.target.value)} placeholder={ar ? 'أحمر' : 'Red'} />
                  <input className="input input-sm" value={valueNameAr} onChange={(e) => setValueNameAr(e.target.value)} placeholder={ar ? 'عربي' : 'AR'} />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={createVal.isPending}>
                    <Plus className="h-4 w-4" />
                  </button>
                </form>
                {valuesLoading ? <div className="text-xs text-slate-500">…</div> : !values.length ? (
                  <p className="text-sm text-slate-500">{ar ? 'لا قيم بعد' : 'No values yet'}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {values.map((v) => (
                      <li key={v._id} className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-dark-800">
                        {ar && v.nameAr ? v.nameAr : v.name}
                        {!v.active ? <span className="ms-2 text-xs text-slate-400">(off)</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Link to="/app/dashboard/inventory/variants" className="inline-block text-sm text-primary-600 hover:underline">
              {ar ? '← توليد المتغيرات' : '← Generate variants'}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export function VariantsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [productId, setProductId] = useState('')
  const [productQ, setProductQ] = useState('')
  const [attrIds, setAttrIds] = useState([])
  const [manualName, setManualName] = useState('')

  const { data: products = [] } = useQuery({
    queryKey: ['products-lite', productQ],
    queryFn: () => api.get('/products', { params: { search: productQ || undefined, limit: 30 } }).then((r) => {
      const d = r.data
      return d?.products || d?.data || (Array.isArray(d) ? d : [])
    }),
  })

  const { data: attrsData } = useQuery({
    queryKey: ['inv-attributes'],
    queryFn: () => api.get('/stock/attributes').then((r) => r.data),
  })
  const attrs = attrsData?.items || []

  const { data: variantsData, isLoading } = useQuery({
    queryKey: ['inv-variants', productId],
    queryFn: () => api.get('/stock/variants', {
      params: { productId: productId || undefined, active: 'false', limit: 300 },
    }).then((r) => r.data),
    enabled: Boolean(productId),
  })
  const variants = variantsData?.items || []

  const generateMut = useMutation({
    mutationFn: () => api.post('/stock/variants/generate', {
      productId,
      attributeIds: attrIds.length ? attrIds : undefined,
    }),
    onSuccess: (res) => {
      toast.success(ar
        ? `أُنشئ ${res.data.created} · تخطّي ${res.data.skipped}`
        : `Created ${res.data.created} · skipped ${res.data.skipped}`)
      qc.invalidateQueries({ queryKey: ['inv-variants', productId] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/variants', { productId, name: manualName }),
    onSuccess: () => {
      toast.success(ar ? 'تم المتغير' : 'Variant created')
      setManualName('')
      qc.invalidateQueries({ queryKey: ['inv-variants', productId] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/stock/variants/${id}`, body),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-variants', productId] })
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const selectedAttrsLabel = useMemo(() => {
    if (!attrIds.length) return ar ? 'كل السمات النشطة' : 'All active attributes'
    return attrs.filter((a) => attrIds.includes(a._id)).map((a) => a.name).join(', ')
  }, [attrIds, attrs, ar])

  const toggleAttr = (id) => {
    setAttrIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'متغيرات المنتج' : 'Product variants'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'توليد توافقي من السمات أو إضافة يدوية — المحرك يخزّن variantId على الكميات'
            : 'Cartesian generate from attributes or add manually — engine stores variantId on quants'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="label text-xs">{ar ? 'بحث منتج' : 'Find product'}</label>
          <input className="input input-sm" value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder={ar ? 'اسم أو SKU' : 'Name or SKU'} />
        </div>
        <div className="min-w-[14rem]">
          <label className="label text-xs">{ar ? 'المنتج' : 'Product'}</label>
          <select className="select select-sm w-full" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{ar ? '— اختر —' : '— Select —'}</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {(ar && p.nameAr) || p.nameEn || p.name} {p.sku ? `(${p.sku})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {productId && (
        <>
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
            <p className="mb-2 text-xs text-slate-500">{ar ? 'سمات التوليد' : 'Attributes for generate'}: {selectedAttrsLabel}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {attrs.map((a) => (
                <label key={a._id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-dark-600">
                  <input type="checkbox" checked={attrIds.includes(a._id)} onChange={() => toggleAttr(a._id)} />
                  {ar && a.nameAr ? a.nameAr : a.name}
                </label>
              ))}
              {!attrs.length && (
                <Link to="/app/dashboard/inventory/attributes" className="text-xs text-primary-600 hover:underline">
                  {ar ? 'أضف سمات أولاً' : 'Add attributes first'}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={generateMut.isPending || !attrs.length}
                onClick={() => generateMut.mutate()}
              >
                {ar ? 'توليد التوافيق' : 'Generate combinations'}
              </button>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => { e.preventDefault(); createMut.mutate() }}
              >
                <input
                  className="input input-sm"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={ar ? 'متغير يدوي' : 'Manual variant name'}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={createMut.isPending}>
                  <Plus className="h-4 w-4" /> {ar ? 'يدوي' : 'Manual'}
                </button>
              </form>
            </div>
          </div>

          {isLoading ? <div className="text-sm text-slate-500">…</div> : !variants.length ? (
            <EmptyState title={ar ? 'لا متغيرات بعد' : 'No variants yet'} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
                  <tr>
                    <th className="px-3 py-2">{ar ? 'الاسم' : 'Name'}</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">{ar ? 'باركود' : 'Barcode'}</th>
                    <th className="px-3 py-2">{ar ? 'نشط' : 'Active'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                  {variants.map((v) => (
                    <tr key={v._id}>
                      <td className="px-3 py-2.5 font-medium">{ar && v.nameAr ? v.nameAr : v.name}</td>
                      <td className="px-3 py-2.5">
                        <input
                          className="input input-sm w-28"
                          defaultValue={v.sku || ''}
                          placeholder="SKU"
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            if (next !== (v.sku || '')) patchMut.mutate({ id: v._id, sku: next })
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          className="input input-sm w-36"
                          defaultValue={v.barcode || ''}
                          placeholder="Barcode"
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            if (next !== (v.barcode || '')) patchMut.mutate({ id: v._id, barcode: next })
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <label className="inline-flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={v.active !== false}
                            onChange={(e) => patchMut.mutate({ id: v._id, active: e.target.checked })}
                          />
                          {v.active !== false ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No')}
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
