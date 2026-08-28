import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import api from '../../lib/api'
import { formatInvError } from '../../lib/invError'

const LABEL_FORMATS = [
  { id: '50x25', en: 'Standard 50×25 mm', ar: 'قياسي 50×25 مم' },
  { id: '100x50', en: 'Large 100×50 mm', ar: 'كبير 100×50 مم' },
  { id: '40x30', en: 'Compact 40×30 mm', ar: 'مضغوط 40×30 مم' },
  { id: 'a4_3x8', en: 'A4 sheet (3×8)', ar: 'ورقة A4 (3×8)' },
]

function displayName(row, ar) {
  if (row.variantName) {
    const base = ar ? (row.productNameAr || row.productNameEn) : (row.productNameEn || row.productNameAr)
    return base && !String(row.variantName).includes(String(base).slice(0, 8))
      ? `${base} — ${row.variantName}`
      : row.variantName
  }
  return ar ? (row.productNameAr || row.productNameEn) : (row.productNameEn || row.productNameAr)
}

export default function PrintBarcodeLabelsModal({
  open,
  onClose,
  productIds = [],
  ar = false,
  language = 'en',
}) {
  const [format, setFormat] = useState('50x25')
  const [qtyByKey, setQtyByKey] = useState({})
  const [generating, setGenerating] = useState(false)

  const idsKey = productIds.join(',')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['label-modal-rows', idsKey],
    enabled: open && productIds.length > 0,
    queryFn: async () => {
      const items = []
      for (const productId of productIds) {
        const variants = await api
          .get('/stock/variants', {
            params: { productId, enrich: '1', limit: 200, active: 'false' },
          })
          .then((r) => r.data?.items || r.data || [])

        if (Array.isArray(variants) && variants.length) {
          for (const v of variants) {
            const p = v.productId || {}
            items.push({
              key: `v:${v._id}`,
              variantId: v._id,
              productId: typeof p === 'object' ? p._id : p,
              variantName: v.name,
              productNameEn: p.nameEn || p.name,
              productNameAr: p.nameAr,
              sku: v.sku || p.sku || '',
              barcode: v.barcode || p.barcode || v.sku || p.sku || '',
              onHand: Number(v.onHand ?? v.stock?.onHand ?? v.available ?? 0) || 0,
            })
          }
        } else {
          const product = await api.get(`/products/${productId}`).then((r) => r.data?.product || r.data)
          if (product?._id) {
            items.push({
              key: `p:${product._id}`,
              variantId: null,
              productId: product._id,
              variantName: null,
              productNameEn: product.nameEn,
              productNameAr: product.nameAr,
              sku: product.sku || '',
              barcode: product.barcode || product.sku || '',
              onHand: Number(product.inventory?.onHand ?? product.totalStock ?? 0) || 0,
            })
          }
        }
      }
      return items
    },
  })

  useEffect(() => {
    if (!open || !rows.length) return
    setQtyByKey((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        if (next[row.key] == null) next[row.key] = 1
      }
      return next
    })
  }, [open, rows])

  const totalLabels = useMemo(
    () => rows.reduce((sum, r) => sum + Math.max(0, Number(qtyByKey[r.key] || 0)), 0),
    [rows, qtyByKey],
  )

  const setAllOnHand = () => {
    setQtyByKey((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        next[row.key] = Math.max(1, Math.ceil(row.onHand || 0))
      }
      return next
    })
  }

  const generatePdf = async () => {
    const labelItems = rows
      .map((row) => ({
        product_variant_id: row.variantId || null,
        product_id: row.productId,
        qty: Math.max(0, Number(qtyByKey[row.key] || 0)),
      }))
      .filter((item) => item.qty > 0)

    if (!labelItems.length) {
      toast.error(ar ? 'حدد كمية واحدة على الأقل' : 'Set at least one label quantity')
      return
    }

    setGenerating(true)
    try {
      const res = await api.post('/stock/print', {
        layout: 'product_label',
        labelItems,
        labelPreset: format,
        lang: ar ? 'ar' : 'en',
      }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'barcode-labels.pdf'
      a.click()
      URL.revokeObjectURL(url)
      toast.success(ar ? `تم إنشاء ${totalLabels} ملصقاً` : `Generated ${totalLabels} labels`)
      onClose?.()
    } catch (e) {
      toast.error(formatInvError(e, language))
    } finally {
      setGenerating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-dark-600 dark:bg-dark-800">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {ar ? 'طباعة ملصقات الباركود' : 'Print Barcode Labels'}
            </h3>
            <p className="text-xs text-slate-500">
              {ar ? `${productIds.length} منتج · ${rows.length} متغير` : `${productIds.length} products · ${rows.length} variants`}
            </p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-3 dark:border-dark-600">
          <div>
            <label className="label text-[11px]">{ar ? 'تنسيق الملصق' : 'Label format'}</label>
            <select className="select select-sm min-w-[12rem]" value={format} onChange={(e) => setFormat(e.target.value)}>
              {LABEL_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{ar ? f.ar : f.en}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!rows.length} onClick={setAllOnHand}>
            {ar ? 'تعيين حسب المخزون' : 'Set to On-Hand Qty'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">…</div>
          ) : !rows.length ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {ar ? 'لا متغيرات للمنتجات المحددة' : 'No variants for selected products'}
            </div>
          ) : (
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-dark-900">
                <tr>
                  <th className="px-4 py-2 text-start">{ar ? 'المنتج / المتغير' : 'Product / Variant'}</th>
                  <th className="w-28 px-3 py-2 text-start">SKU</th>
                  <th className="w-36 px-3 py-2 text-start">{ar ? 'الباركود' : 'Barcode'}</th>
                  <th className="w-24 px-3 py-2 text-end">{ar ? 'المخزون' : 'On hand'}</th>
                  <th className="w-28 px-3 py-2 text-end">{ar ? 'عدد الملصقات' : 'Labels to print'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="truncate px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                      {displayName(row, ar)}
                    </td>
                    <td className="truncate px-3 py-2.5 font-mono text-xs text-slate-500">{row.sku || '—'}</td>
                    <td className="truncate px-3 py-2.5 font-mono text-xs text-slate-500">{row.barcode || '—'}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-slate-600">{row.onHand}</td>
                    <td className="px-3 py-2.5 text-end">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input input-sm w-20 text-end tabular-nums"
                        value={qtyByKey[row.key] ?? 1}
                        onChange={(e) => setQtyByKey((m) => ({ ...m, [row.key]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
          <span className="text-sm text-slate-500">
            {ar ? `إجمالي الملصقات: ${totalLabels}` : `Total labels: ${totalLabels}`}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={generating || !rows.length || totalLabels <= 0}
              onClick={generatePdf}
            >
              {generating ? '…' : (ar ? 'إنشاء PDF' : 'Generate PDF')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
