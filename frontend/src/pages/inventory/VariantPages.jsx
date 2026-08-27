import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import Money from '../../components/ui/Money'
import { formatInvError } from '../../lib/invError'

export function VariantsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [productId, setProductId] = useState(() => searchParams.get('productId') || '')
  const [productQ, setProductQ] = useState('')
  const [attrFilter, setAttrFilter] = useState('')
  const [q, setQ] = useState('')
  const [attrIds, setAttrIds] = useState([])

  useEffect(() => {
    const pid = searchParams.get('productId')
    if (pid) setProductId(pid)
  }, [searchParams])

  const { data: products = [] } = useQuery({
    queryKey: ['products-lite', productQ],
    queryFn: () => api.get('/products', { params: { search: productQ || undefined, limit: 30 } }).then((r) => {
      const d = r.data
      return d?.products || d?.data || (Array.isArray(d) ? d : [])
    }),
  })

  const { data: pinnedProduct } = useQuery({
    queryKey: ['product-lite', productId],
    queryFn: () => api.get(`/products/${productId}`).then((r) => r.data),
    enabled: Boolean(productId) && !products.some((p) => String(p._id) === String(productId)),
    staleTime: 60_000,
  })

  const productOptions = useMemo(() => {
    const rows = [...products]
    if (pinnedProduct?._id && !rows.some((p) => String(p._id) === String(pinnedProduct._id))) {
      rows.unshift(pinnedProduct)
    }
    return rows
  }, [products, pinnedProduct])

  const { data: attrsData } = useQuery({
    queryKey: ['inv-attributes'],
    queryFn: () => api.get('/stock/attributes').then((r) => asInvList(r.data)),
  })
  const attrs = Array.isArray(attrsData) ? attrsData : (attrsData?.items || [])

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
            {productOptions.map((p) => (
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
            <p className="self-center text-xs text-slate-400">
              {ar
                ? 'المتغيرات تُنشأ من المصفوفة فقط — لا إنشاء يدوي.'
                : 'Variants are matrix-generated only — no manual rows.'}
            </p>
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
                <th className="min-w-[150px] px-3 py-2">{ar ? 'معرّف المنتج' : 'Product ID'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'المتغير' : 'Variant'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'القيم' : 'Attribute values'}</th>
                <th className="min-w-[150px] px-3 py-2">SKU</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'باركود' : 'Barcode'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'المتاح' : 'On hand'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'متوقع' : 'Forecasted'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'تكلفة' : 'Cost'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'سعر' : 'Price'}</th>
                <th className="min-w-[150px] px-3 py-2">{ar ? 'نشط' : 'Active'}</th>
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
