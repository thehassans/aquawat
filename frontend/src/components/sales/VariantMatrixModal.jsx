import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import AsyncCombobox from '../ui/AsyncCombobox'
import { sectionCardClass, fieldControlClass, fieldLabelClass } from '../../pages/sales/salesUi'

function axisValue(v, attrId) {
  const vals = v.attributeValueIds || []
  const hit = vals.find((av) => String(av.attributeId?._id || av.attributeId) === String(attrId))
  return hit ? (hit.name || hit.nameAr || '—') : null
}

/**
 * Variant matrix — picks a product, builds Size×Color-style grid from real attributes,
 * bulk-adds lines via onApply([{ variantId, productId, productName, quantity, unitPrice }]).
 */
export default function VariantMatrixModal({
  open,
  onClose,
  onApply,
  onAddLines,
  language = 'en',
  initialProductId = '',
  initialProductLabel = '',
}) {
  const ar = language === 'ar'
  const applyFn = onApply || onAddLines
  const [product, setProduct] = useState(
    initialProductId ? { _id: initialProductId, name: initialProductLabel || initialProductId } : null
  )
  const [qtyMap, setQtyMap] = useState({})

  useEffect(() => {
    if (!open) return
    if (initialProductId) {
      setProduct({ _id: initialProductId, name: initialProductLabel || initialProductId })
    }
    setQtyMap({})
  }, [open, initialProductId, initialProductLabel])

  const productId = product?._id || ''

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['matrix-variants', productId],
    queryFn: () => api.get('/stock/variants', {
      params: { productId, active: 'true', limit: 500, enrich: '1' },
    }).then((r) => r.data?.items || r.data || []),
    enabled: open && Boolean(productId),
    staleTime: 20_000,
  })

  const fetchProducts = useCallback(async (q) => {
    const { data } = await api.get('/products', { params: { search: q, limit: 20, isActive: true } })
    const list = data?.products || data?.items || data || []
    return (Array.isArray(list) ? list : []).map((p) => ({
      _id: p._id,
      name: p.nameEn || p.name || p.sku,
      sub: p.sku,
    }))
  }, [])

  const { xAttrId, yAttrId, xLabel, yLabel, xValues, yValues, grid } = useMemo(() => {
    const attrOrder = []
    const attrLabel = new Map()
    for (const v of variants) {
      for (const av of v.attributeValueIds || []) {
        const aid = String(av.attributeId?._id || av.attributeId || '')
        if (!aid) continue
        if (!attrOrder.includes(aid)) attrOrder.push(aid)
        if (!attrLabel.has(aid)) attrLabel.set(aid, av.attributeName || (ar ? 'سمة' : 'Attribute'))
      }
    }

    // Fallback when variants have no attributes — use name as single axis
    if (!attrOrder.length) {
      const xs = [...new Set(variants.map((v) => v.name || v.sku || String(v._id)))]
      const map = new Map()
      for (const v of variants) {
        map.set(`${v.name || v.sku || v._id}|—`, v)
      }
      return {
        xAttrId: null,
        yAttrId: null,
        xLabel: ar ? 'متغير' : 'Variant',
        yLabel: '—',
        xValues: xs,
        yValues: ['—'],
        grid: map,
      }
    }

    const xId = attrOrder[0]
    const yId = attrOrder[1] || null
    const xs = [...new Set(variants.map((v) => axisValue(v, xId) || '—'))]
    const ys = yId
      ? [...new Set(variants.map((v) => axisValue(v, yId) || '—'))]
      : ['—']
    const map = new Map()
    for (const v of variants) {
      const x = axisValue(v, xId) || '—'
      const y = yId ? (axisValue(v, yId) || '—') : '—'
      map.set(`${x}|${y}`, v)
    }
    return {
      xAttrId: xId,
      yAttrId: yId,
      xLabel: attrLabel.get(xId) || (ar ? 'محور س' : 'X'),
      yLabel: yId ? (attrLabel.get(yId) || (ar ? 'محور ص' : 'Y')) : '—',
      xValues: xs,
      yValues: ys,
      grid: map,
    }
  }, [variants, ar])

  if (!open) return null

  const apply = () => {
    const lines = []
    for (const [key, qty] of Object.entries(qtyMap)) {
      const n = Number(qty)
      if (!n || n <= 0) continue
      const v = grid.get(key)
      if (!v) continue
      const pid = v.productId?._id || v.productId || productId
      lines.push({
        variantId: v._id || v.variantId,
        productId: pid,
        productName: v.name || v.attributeValuesLabel || product?.name || '',
        quantity: n,
        unitPrice: Number(v.price || v.unitPrice || 0),
        productType: 'goods',
      })
    }
    applyFn?.(lines)
    setQtyMap({})
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className={`${sectionCardClass} max-h-[90vh] w-full max-w-4xl overflow-auto`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {ar ? 'شبكة المتغيرات' : 'Variant grid entry'}
            </h3>
            <p className="text-xs text-slate-500">
              {ar ? 'اختر منتجاً وأدخل الكميات على الشبكة' : 'Pick a product and enter quantities on the attribute grid'}
            </p>
          </div>
          <button type="button" className="text-sm font-medium text-slate-500 hover:text-slate-800" onClick={onClose}>
            {ar ? 'إغلاق' : 'Close'}
          </button>
        </div>

        <div className="mb-4 max-w-md">
          <label className={fieldLabelClass}>{ar ? 'المنتج' : 'Product'}</label>
          <AsyncCombobox
            value={product?._id || ''}
            selectedOption={product}
            onChange={(id, opt) => {
              setProduct(opt || (id ? { _id: id, name: String(id) } : null))
              setQtyMap({})
            }}
            fetchOptions={fetchProducts}
            placeholder={ar ? 'بحث المنتج…' : 'Search product…'}
            minChars={0}
          />
        </div>

        {!productId ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {ar ? 'اختر منتجاً لعرض شبكة المتغيرات' : 'Select a product to load the variant grid'}
          </p>
        ) : isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</p>
        ) : variants.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {ar ? 'لا توجد متغيرات لهذا المنتج' : 'No variants for this product'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {yLabel} \ {xLabel}
                  </th>
                  {xValues.map((x) => (
                    <th key={x} className="px-2 py-2 text-center text-xs font-semibold text-slate-600">{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yValues.map((y) => (
                  <tr key={y} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-2 py-2 font-medium text-slate-700 dark:text-slate-200">{y}</td>
                    {xValues.map((x) => {
                      const key = `${x}|${y}`
                      const cell = grid.get(key)
                      return (
                        <td key={key} className="px-2 py-2 text-center">
                          {cell ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                className={`${fieldControlClass} w-20 text-center`}
                                value={qtyMap[key] ?? ''}
                                onChange={(e) => setQtyMap((p) => ({ ...p, [key]: e.target.value }))}
                              />
                              {cell.onHand != null ? (
                                <span className="text-[10px] tabular-nums text-slate-400">
                                  {ar ? 'متاح' : 'OH'} {cell.onHand}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={apply}
            disabled={!productId || Object.values(qtyMap).every((q) => !Number(q))}
          >
            {ar ? 'إضافة البنود' : 'Add lines'}
          </button>
        </div>
      </div>
    </div>
  )
}
