import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import Money from '../../components/ui/Money'
import { formatInvError } from '../../lib/invError'

export function AttributesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [mode, setMode] = useState('always')
  const [selectedId, setSelectedId] = useState('')
  const [valueName, setValueName] = useState('')
  const [valueNameAr, setValueNameAr] = useState('')
  const [extraPrice, setExtraPrice] = useState('0')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-attributes'],
    queryFn: () => api.get('/stock/attributes', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
  })
  const attrs = data || []

  const { data: valuesData, isLoading: valuesLoading } = useQuery({
    queryKey: ['inv-attribute-values', selectedId],
    queryFn: () => api.get(`/stock/attributes/${selectedId}/values`).then((r) => asInvList(r.data)),
    enabled: Boolean(selectedId),
  })
  const values = valuesData || []

  const createAttr = useMutation({
    mutationFn: () => api.post('/stock/attributes', {
      name,
      nameAr: nameAr || undefined,
      createVariantMode: mode,
    }),
    onSuccess: (res) => {
      toast.success(ar ? 'تم إنشاء السمة' : 'Attribute created')
      setName('')
      setNameAr('')
      setSelectedId(res.data._id)
      qc.invalidateQueries({ queryKey: ['inv-attributes'] })
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  const createVal = useMutation({
    mutationFn: () => api.post(`/stock/attributes/${selectedId}/values`, {
      name: valueName,
      nameAr: valueNameAr || undefined,
      extraPrice: Number(extraPrice) || 0,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تم القيمة' : 'Value added')
      setValueName('')
      setValueNameAr('')
      setExtraPrice('0')
      qc.invalidateQueries({ queryKey: ['inv-attribute-values', selectedId] })
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'سمات المنتج' : 'Product attributes'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'Always / Dynamically / Never — الرصيد يبقى على productId + variantId'
            : 'Always / Dynamically / Never — stock stays on productId + variantId'}
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
        <div>
          <label className="label text-xs">{ar ? 'إنشاء متغير' : 'Create variant'}</label>
          <select className="select select-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="always">{ar ? 'دائماً' : 'Always'}</option>
            <option value="dynamic">{ar ? 'ديناميكي' : 'Dynamically'}</option>
            <option value="never">{ar ? 'أبداً' : 'Never'}</option>
          </select>
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
                  <th className="px-3 py-2">{ar ? 'الوضع' : 'Mode'}</th>
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
                    <td className="px-3 py-2.5 text-slate-500">{a.createVariantMode || (a.createVariant !== false ? 'always' : 'never')}</td>
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
                  <input className="input input-sm w-24" type="number" step="0.01" value={extraPrice} onChange={(e) => setExtraPrice(e.target.value)} placeholder={ar ? 'سعر إضافي' : 'Extra'} />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={createVal.isPending}>
                    <Plus className="h-4 w-4" />
                  </button>
                </form>
                {valuesLoading ? <div className="text-xs text-slate-500">…</div> : !values.length ? (
                  <p className="text-sm text-slate-500">{ar ? 'لا قيم بعد' : 'No values yet'}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {values.map((v) => (
                      <li key={v._id} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-dark-800">
                        <span>{ar && v.nameAr ? v.nameAr : v.name}</span>
                        <span className="tabular-nums text-slate-400">+{v.extraPrice || 0}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Link to="/app/dashboard/inventory/variants" className="inline-block text-sm text-primary-600 hover:underline">
              {ar ? '← المتغيرات' : '← Variants'}
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
  const [attrFilter, setAttrFilter] = useState('')
  const [q, setQ] = useState('')
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
    queryFn: () => api.get('/stock/attributes').then((r) => asInvList(r.data)),
  })
  const attrs = attrsData?.items || []

  const { data: variantsData, isLoading } = useQuery({
    queryKey: ['inv-variants', productId, q, attrFilter],
    queryFn: () => api.get('/stock/variants', {
      params: {
        productId: productId || undefined,
        q: q || undefined,
        attributeId: attrFilter || undefined,
        active: 'false',
        limit: 300,
        enrich: '1',
      },
    }).then((r) => r.data),
  })
  const variants = variantsData?.items || []

  const generateMut = useMutation({
    mutationFn: () => api.post('/stock/variants/generate', {
      productId,
      attributeIds: attrIds.length ? attrIds : undefined,
    }),
    onSuccess: (res) => {
      toast.success(ar
        ? `أُنشئ ${res.data.created} · تخطّي ${res.data.skipped} · أرشفة ${res.data.archived || 0}`
        : `Created ${res.data.created} · skipped ${res.data.skipped} · archived ${res.data.archived || 0}`)
      qc.invalidateQueries({ queryKey: ['inv-variants'] })
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/variants', { productId, name: manualName }),
    onSuccess: () => {
      toast.success(ar ? 'تم المتغير' : 'Variant created')
      setManualName('')
      qc.invalidateQueries({ queryKey: ['inv-variants'] })
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/stock/variants/${id}`, body),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['inv-variants'] })
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {ar ? 'متغيرات المنتج' : 'Product variants'}
          </h2>
          <p className="text-sm text-slate-500">
            {ar
              ? 'Product ID · السمات · SKU · الرصيد · المتوقع · التكلفة · السعر'
              : 'Product ID · attributes · SKU · on hand · forecasted · cost · price'}
          </p>
        </div>
        <InventoryIeButtons
          model="product_variants"
          ar={ar}
          filters={{ productId: productId || undefined, search: q || undefined }}
          onImported={() => qc.invalidateQueries({ queryKey: ['inv-variants'] })}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="label text-xs">{ar ? 'بحث' : 'Search'}</label>
          <input className="input input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'اسم / SKU / باركود' : 'Name / SKU / barcode'} />
        </div>
        <div className="grow">
          <label className="label text-xs">{ar ? 'بحث منتج' : 'Find product'}</label>
          <input className="input input-sm" value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder={ar ? 'اسم أو SKU' : 'Name or SKU'} />
        </div>
        <div className="min-w-[12rem]">
          <label className="label text-xs">{ar ? 'القالب' : 'Template'}</label>
          <select className="select select-sm w-full" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{ar ? '— الكل —' : '— All —'}</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.productId ? `${p.productId} · ` : ''}{(ar && p.nameAr) || p.nameEn || p.name} {p.sku ? `(${p.sku})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[10rem]">
          <label className="label text-xs">{ar ? 'سمة' : 'Attribute'}</label>
          <select className="select select-sm w-full" value={attrFilter} onChange={(e) => setAttrFilter(e.target.value)}>
            <option value="">—</option>
            {attrs.map((a) => (
              <option key={a._id} value={a._id}>{ar && a.nameAr ? a.nameAr : a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {productId && (
        <div className="rounded-xl border border-slate-200/80 p-3 dark:border-dark-600">
          <p className="mb-2 text-xs text-slate-500">{ar ? 'سمات التوليد' : 'Attributes for generate'}: {selectedAttrsLabel}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {attrs.map((a) => (
              <label key={a._id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-dark-600">
                <input type="checkbox" checked={attrIds.includes(a._id)} onChange={() => toggleAttr(a._id)} />
                {ar && a.nameAr ? a.nameAr : a.name}
              </label>
            ))}
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
      )}

      {isLoading ? <div className="text-sm text-slate-500">…</div> : !variants.length ? (
        <EmptyState title={ar ? 'لا متغيرات' : 'No variants'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2">{ar ? 'معرّف المنتج' : 'Product ID'}</th>
                <th className="px-3 py-2">{ar ? 'المتغير' : 'Variant'}</th>
                <th className="px-3 py-2">{ar ? 'القيم' : 'Attribute values'}</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">{ar ? 'باركود' : 'Barcode'}</th>
                <th className="px-3 py-2">{ar ? 'المتاح' : 'On hand'}</th>
                <th className="px-3 py-2">{ar ? 'متوقع' : 'Forecasted'}</th>
                <th className="px-3 py-2">{ar ? 'تكلفة' : 'Cost'}</th>
                <th className="px-3 py-2">{ar ? 'سعر' : 'Price'}</th>
                <th className="px-3 py-2">{ar ? 'نشط' : 'Active'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {variants.map((v) => (
                <tr key={v._id}>
                  <td className="px-3 py-2 font-mono text-xs text-emerald-700">{v.productCode || v.productId?.productId || '—'}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <div>{ar && v.nameAr ? v.nameAr : v.name}</div>
                    <div className="text-[11px] text-slate-400">{v.productId?.nameEn || v.productId?.sku}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{v.attributeValuesLabel || '—'}</td>
                  <td className="px-3 py-2.5">
                    <input
                      className="input input-sm w-28"
                      defaultValue={v.sku || ''}
                      onBlur={(e) => {
                        const next = e.target.value.trim()
                        if (next !== (v.sku || '')) patchMut.mutate({ id: v._id, sku: next })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      className="input input-sm w-32"
                      defaultValue={v.barcode || ''}
                      onBlur={(e) => {
                        const next = e.target.value.trim()
                        if (next !== (v.barcode || '')) patchMut.mutate({ id: v._id, barcode: next })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{v.onHand ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{v.forecasted ?? '—'}</td>
                  <td className="px-3 py-2"><Money value={v.cost} /></td>
                  <td className="px-3 py-2"><Money value={v.price} /></td>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={v.active !== false}
                      onChange={(e) => patchMut.mutate({ id: v._id, active: e.target.checked })}
                    />
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
