import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import {
  opsProductOptionLabel,
  opsProductOptionSub,
  searchProductsAndVariants,
} from '../../../lib/productVariantSearch'
import { invTableClass, invTableWrapClass, invThClass, invTdClass } from '../inventoryUi'

function emptyDraft() {
  return {
    _key: `new-${Date.now()}`,
    productId: '',
    variantId: null,
    productLabel: '',
    selectedOption: null,
    locationId: '',
    warehouseId: '',
    routeId: '',
    minQty: '0',
    maxQty: '0',
    qtyMultiple: '1',
    dirty: true,
    isNew: true,
  }
}

function rowFromApi(r) {
  const product = r.productId && typeof r.productId === 'object' ? r.productId : null
  const variant = r.variantId && typeof r.variantId === 'object' ? r.variantId : null
  const productId = String(product?._id || r.productId || '')
  const variantId = variant?._id ? String(variant._id) : (r.variantId ? String(r.variantId) : null)
  const label = variant
    ? [variant.sku || product?.sku, variant.name || product?.nameEn].filter(Boolean).join(' — ')
    : [product?.sku, product?.nameEn || product?.nameAr].filter(Boolean).join(' — ')
  return {
    _key: String(r._id),
    _id: String(r._id),
    productId,
    variantId,
    productLabel: label || productId,
    selectedOption: variantId
      ? {
        _id: `v:${variantId}`,
        kind: 'variant',
        productId,
        variantId,
        name: label,
        sku: variant?.sku || product?.sku,
        productName: product?.nameEn,
      }
      : productId
        ? {
          _id: `p:${productId}`,
          kind: 'product',
          productId,
          variantId: null,
          name: label,
          sku: product?.sku,
          productName: product?.nameEn,
        }
        : null,
    locationId: String(r.locationId?._id || r.locationId || ''),
    warehouseId: String(r.warehouseId?._id || r.warehouseId || ''),
    routeId: String(r.routeId?._id || r.routeId || ''),
    minQty: String(r.minQty ?? '0'),
    maxQty: String(r.maxQty ?? '0'),
    qtyMultiple: String(r.qtyMultiple ?? '1'),
    dirty: false,
    isNew: false,
  }
}

/**
 * Min/Max reordering engine — inline-editable data grid.
 */
export default function ReorderingRulesPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState([])
  const [savingKey, setSavingKey] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['inv-reorder-rules'],
    queryFn: () => api.get('/stock/reorder-rules', { params: { active: 'all' } }).then((r) => asInvList(r.data)),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['inv-locations-internal'],
    queryFn: () => api.get('/stock/locations', { params: { usage: 'internal' } }).then((r) => asInvList(r.data)),
  })

  const { data: routes = [] } = useQuery({
    queryKey: ['inv-routes-active'],
    queryFn: () => api.get('/stock/routes', { params: { active: 'true' } }).then((r) => asInvList(r.data)),
  })

  const serverRows = useMemo(() => (data || []).map(rowFromApi), [data])

  const rows = useMemo(() => {
    const byId = new Map(serverRows.map((r) => [r._id, r]))
    // Merge local dirty drafts over server
    const merged = serverRows.map((r) => {
      const local = drafts.find((d) => d._id === r._id)
      return local?.dirty ? local : r
    })
    const news = drafts.filter((d) => d.isNew)
    return [...merged, ...news]
  }, [serverRows, drafts])

  const updateRow = (key, patch) => {
    setDrafts((prev) => {
      const existing = prev.find((d) => d._key === key)
      const base = existing || rows.find((r) => r._key === key) || emptyDraft()
      const next = { ...base, ...patch, dirty: true, _key: key }
      const others = prev.filter((d) => d._key !== key)
      return [...others, next]
    })
  }

  const saveMut = useMutation({
    mutationFn: async (row) => {
      const body = {
        productId: row.productId,
        variantId: row.variantId || null,
        locationId: row.locationId,
        warehouseId: row.warehouseId,
        routeId: row.routeId || null,
        minQty: row.minQty,
        maxQty: row.maxQty,
        qtyMultiple: row.qtyMultiple || '1',
      }
      if (row.isNew || !row._id) {
        return api.post('/stock/reorder-rules', body).then((r) => r.data)
      }
      return api.patch(`/stock/reorder-rules/${row._id}`, body).then((r) => r.data)
    },
    onSuccess: (_data, row) => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      setDrafts((prev) => prev.filter((d) => d._key !== row._key))
      qc.invalidateQueries({ queryKey: ['inv-reorder-rules'] })
      setSavingKey(null)
    },
    onError: (e) => {
      toast.error(formatInvError(e, language))
      setSavingKey(null)
    },
  })

  const onSave = (row) => {
    if (!row.productId || !row.locationId || !row.warehouseId) {
      toast.error(ar ? 'المنتج والموقع مطلوبان' : 'Product and location are required')
      return
    }
    setSavingKey(row._key)
    saveMut.mutate(row)
  }

  const addLine = () => {
    setDrafts((prev) => [...prev, emptyDraft()])
  }

  const discardNew = (key) => {
    setDrafts((prev) => prev.filter((d) => d._key !== key))
  }

  const locLabel = (l) => l.completePath || l.name || l._id

  return (
    <div className="flex min-h-[60vh] flex-col gap-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'قواعد إعادة الطلب' : 'Reordering Rules'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'محرك الحد الأدنى/الأقصى — عدّل الصف مباشرة واحفظ.'
              : 'Min/max engine — edit rows inline and save.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={addLine}>
          <Plus className="h-4 w-4" />
          {ar ? 'إضافة سطر' : 'Add a line'}
        </button>
      </div>

      <div className={`${invTableWrapClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className={`${invTableClass} min-w-[1100px]`}>
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-start text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
              <tr>
                <th className={`${invThClass} min-w-[220px]`}>{ar ? 'المنتج / المتغير' : 'Product'}</th>
                <th className={`${invThClass} min-w-[180px]`}>{ar ? 'الموقع' : 'Location'}</th>
                <th className={`${invThClass} min-w-[160px]`}>{ar ? 'المسار المفضّل' : 'Preferred route'}</th>
                <th className={`${invThClass} min-w-[100px]`}>{ar ? 'الحد الأدنى' : 'Min qty'}</th>
                <th className={`${invThClass} min-w-[100px]`}>{ar ? 'الحد الأقصى' : 'Max qty'}</th>
                <th className={`${invThClass} min-w-[110px]`}>{ar ? 'مضاعف الكمية' : 'Multiple qty'}</th>
                <th className="min-w-[100px] px-3 py-3 text-end">{ar ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-slate-400">…</td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    {ar ? 'لا قواعد بعد — أضف سطرًا للبدء.' : 'No rules yet — add a line to get started.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row._key}
                    className={`border-b border-slate-50 dark:border-dark-700 ${
                      row.dirty ? 'bg-sky-50/40 dark:bg-sky-950/20' : 'hover:bg-gray-50 dark:hover:bg-dark-700/40'
                    }`}
                  >
                    <td className={`${invTdClass} align-top`}>
                      <AsyncCombobox
                        value={row.variantId ? `v:${row.variantId}` : (row.productId ? `p:${row.productId}` : null)}
                        selectedOption={row.selectedOption}
                        onChange={(_id, opt) => {
                          if (!opt) {
                            updateRow(row._key, {
                              productId: '',
                              variantId: null,
                              selectedOption: null,
                              productLabel: '',
                            })
                            return
                          }
                          updateRow(row._key, {
                            productId: opt.productId || '',
                            variantId: opt.variantId || null,
                            selectedOption: opt,
                            productLabel: opsProductOptionLabel(opt),
                          })
                        }}
                        fetchOptions={(q) => searchProductsAndVariants(q, { variantsEnabled: true })}
                        queryKeyPrefix="reorder-product-variant"
                        getOptionLabel={opsProductOptionLabel}
                        getOptionSub={opsProductOptionSub}
                        placeholder={ar ? 'بحث منتج / متغير…' : 'Search product / variant…'}
                        minChars={1}
                        noResultsText={ar ? 'لا نتائج' : 'No results'}
                      />
                    </td>
                    <td className={`${invTdClass} align-top`}>
                      <select
                        className="select select-sm w-full"
                        value={row.locationId}
                        onChange={(e) => {
                          const loc = locations.find((l) => String(l._id) === e.target.value)
                          const wh = loc?.warehouseId?._id || loc?.warehouseId || row.warehouseId
                          updateRow(row._key, {
                            locationId: e.target.value,
                            warehouseId: wh ? String(wh) : row.warehouseId,
                          })
                        }}
                      >
                        <option value="">{ar ? '— موقع —' : '— Location —'}</option>
                        {locations.map((l) => (
                          <option key={l._id} value={l._id}>{locLabel(l)}</option>
                        ))}
                      </select>
                    </td>
                    <td className={`${invTdClass} align-top`}>
                      <select
                        className="select select-sm w-full"
                        value={row.routeId}
                        onChange={(e) => updateRow(row._key, { routeId: e.target.value })}
                      >
                        <option value="">{ar ? '— تلقائي —' : '— Auto —'}</option>
                        {routes.map((r) => (
                          <option key={r._id} value={r._id}>
                            {ar && r.nameAr ? r.nameAr : r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${invTdClass} align-top`}>
                      <input
                        className="input input-sm w-full tabular-nums"
                        value={row.minQty}
                        onChange={(e) => updateRow(row._key, { minQty: e.target.value })}
                      />
                    </td>
                    <td className={`${invTdClass} align-top`}>
                      <input
                        className="input input-sm w-full tabular-nums"
                        value={row.maxQty}
                        onChange={(e) => updateRow(row._key, { maxQty: e.target.value })}
                      />
                    </td>
                    <td className={`${invTdClass} align-top`}>
                      <input
                        className="input input-sm w-full tabular-nums"
                        value={row.qtyMultiple}
                        onChange={(e) => updateRow(row._key, { qtyMultiple: e.target.value })}
                        title={ar ? 'اطلب بمضاعفات هذه الكمية' : 'Order in multiples of this quantity'}
                      />
                    </td>
                    <td className="px-3 py-3 text-end align-top">
                      <div className="inline-flex gap-1">
                        {(row.dirty || row.isNew) && (
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            disabled={savingKey === row._key}
                            onClick={() => onSave(row)}
                          >
                            <Save className="h-3.5 w-3.5" />
                            {ar ? 'حفظ' : 'Save'}
                          </button>
                        )}
                        {row.isNew && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => discardNew(row._key)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-dark-600 dark:bg-dark-900/40">
          <button type="button" className="text-sm font-medium text-sky-800 hover:underline dark:text-sky-300" onClick={addLine}>
            + {ar ? 'إضافة سطر' : 'Add a line'}
          </button>
        </div>
      </div>
    </div>
  )
}
