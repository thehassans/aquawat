import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Select from 'react-select'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { formatInvError } from '../../lib/invError'
import { productPickerLabel } from '../../lib/productType'

const RELATION_TYPES = [
  { id: 'accessory', en: 'Accessories', ar: 'إكسسوارات' },
  { id: 'upsell', en: 'Upsell', ar: 'ترقية' },
  { id: 'cross_sell', en: 'Cross-sell', ar: 'بيع متقاطع' },
  { id: 'optional', en: 'Optional', ar: 'اختياري' },
  { id: 'substitute', en: 'Substitute', ar: 'بديل' },
]

function relProductLabel(p, language) {
  if (!p) return '—'
  if (typeof p === 'string') return p
  return productPickerLabel(p, language) || p.sku || p._id
}

export default function ProductRelationsEditor({ productId, language = 'en' }) {
  const ar = language === 'ar'
  const queryClient = useQueryClient()
  const [draftType, setDraftType] = useState('accessory')
  const [draftRelatedId, setDraftRelatedId] = useState(null)
  const [createReverse, setCreateReverse] = useState(false)

  const { data: products } = useQuery({
    queryKey: ['products-for-relations'],
    queryFn: () => api.get('/products', { params: { limit: 300 } }).then((r) => r.data?.products || []),
    enabled: Boolean(productId),
    staleTime: 60_000,
  })

  const { data: outgoing = [], isLoading: loadingOut } = useQuery({
    queryKey: ['inv-product-relations', productId, 'outgoing'],
    queryFn: () =>
      api
        .get(`/stock/products/${productId}/relations`, { params: { direction: 'outgoing', active: 'false' } })
        .then((r) => asInvList(r.data)),
    enabled: Boolean(productId),
  })

  const { data: incoming = [] } = useQuery({
    queryKey: ['inv-product-relations', productId, 'incoming'],
    queryFn: () =>
      api
        .get(`/stock/products/${productId}/relations`, { params: { direction: 'incoming' } })
        .then((r) => asInvList(r.data)),
    enabled: Boolean(productId),
  })

  const productOptions = useMemo(
    () =>
      (products || [])
        .filter((p) => String(p._id) !== String(productId))
        .map((p) => ({ value: p._id, label: productPickerLabel(p, language) })),
    [products, productId, language],
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inv-product-relations', productId] })
    queryClient.invalidateQueries({ queryKey: ['inv-relations-catalogue'] })
  }

  const addMutation = useMutation({
    mutationFn: () =>
      api.post('/stock/relations', {
        sourceProductId: productId,
        relatedProductId: draftRelatedId,
        type: draftType,
        createReverse,
      }),
    onSuccess: () => {
      toast.success(ar ? 'تمت إضافة العلاقة' : 'Relation added')
      setDraftRelatedId(null)
      setCreateReverse(false)
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/stock/relations/${id}`),
    onSuccess: () => {
      toast.success(ar ? 'تم الحذف' : 'Removed')
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  if (!productId) {
    return (
      <p className="mt-6 text-sm text-slate-500">
        {ar ? 'احفظ المنتج أولاً لإدارة العلاقات.' : 'Save the product first to manage relationships.'}
      </p>
    )
  }

  const byType = useMemo(() => {
    const map = Object.fromEntries(RELATION_TYPES.map((t) => [t.id, []]))
    for (const row of outgoing) {
      if (map[row.type]) map[row.type].push(row)
    }
    return map
  }, [outgoing])

  return (
    <div className="mt-8 space-y-6 border-t border-slate-200/80 pt-6 dark:border-dark-600">
      <div>
        <h4 className="text-base font-semibold text-slate-900 dark:text-white">
          {ar ? 'علاقات المنتج' : 'Product relationships'}
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          {ar
            ? 'إكسسوارات، ترقية، بيع متقاطع، اختياري، وبديل — تظهر في المبيعات ونقطة البيع.'
            : 'Accessories, upsell, cross-sell, optional, and substitutes — used on sales lines and POS.'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-dark-600 dark:bg-dark-800/40">
        <div className="min-w-[9rem]">
          <label className="label">{ar ? 'النوع' : 'Type'}</label>
          <select className="select" value={draftType} onChange={(e) => setDraftType(e.target.value)}>
            {RELATION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{ar ? t.ar : t.en}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label className="label">{ar ? 'المنتج المرتبط' : 'Related product'}</label>
          <Select
            className="react-select-container"
            classNamePrefix="react-select"
            options={productOptions}
            value={productOptions.find((o) => o.value === draftRelatedId) || null}
            onChange={(opt) => setDraftRelatedId(opt?.value || null)}
            placeholder={ar ? 'ابحث…' : 'Search…'}
            isClearable
            isSearchable
          />
        </div>
        <label className="mb-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary-600"
            checked={createReverse}
            onChange={(e) => setCreateReverse(e.target.checked)}
          />
          {ar ? 'إنشاء العكس' : 'Create reverse'}
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm mb-1"
          disabled={!draftRelatedId || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          <Plus className="h-4 w-4" /> {ar ? 'إضافة' : 'Add'}
        </button>
      </div>

      {loadingOut ? (
        <p className="text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {RELATION_TYPES.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-100 p-3 dark:border-dark-600">
              <div className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                {ar ? t.ar : t.en}
              </div>
              {(byType[t.id] || []).length === 0 ? (
                <p className="text-xs text-slate-400">{ar ? 'لا يوجد' : 'None'}</p>
              ) : (
                <ul className="space-y-1.5">
                  {byType[t.id].map((row) => (
                    <li
                      key={row._id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-sm dark:bg-dark-900"
                    >
                      <span className="min-w-0 truncate">
                        {relProductLabel(row.relatedProductId, language)}
                        {row.active === false ? (
                          <span className="ms-1 text-[10px] text-amber-600">{ar ? '(متوقف)' : '(inactive)'}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-red-600"
                        onClick={() => deleteMutation.mutate(row._id)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 dark:border-dark-600">
          <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {ar ? 'مقترح من' : 'Suggested by'}
          </h5>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {ar ? 'منتجات أخرى تشير إلى هذا المنتج (للقراءة فقط).' : 'Other products that point here (read-only).'}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {incoming.map((row) => {
              const typeMeta = RELATION_TYPES.find((t) => t.id === row.type)
              return (
                <li key={row._id} className="flex flex-wrap gap-2">
                  <span className="font-medium">{relProductLabel(row.sourceProductId, language)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="rounded bg-slate-100 px-1.5 text-xs dark:bg-dark-700">
                    {ar ? typeMeta?.ar : typeMeta?.en || row.type}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
