import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import api from '../../lib/api'
import { formatInvError } from '../../lib/invError'
import {
  sectionCardClass,
  sectionEyebrowClass,
  fieldLabelClass,
  fieldControlClass,
  primaryBtnClass,
  ghostActionClass,
  secondaryBtnClass,
  monoCellClass,
} from '../planning/planningUi'

const LABEL_FORMATS = [
  { id: '50x25', en: 'Standard 50×25 mm', ar: 'قياسي 50×25 مم' },
  { id: '100x50', en: 'Large 100×50 mm', ar: 'كبير 100×50 مم' },
  { id: '40x30', en: 'Compact 40×30 mm', ar: 'مضغوط 40×30 مم' },
  { id: 'a4_3x8', en: 'A4 sheet (3×8)', ar: 'ورقة A4 (3×8)' },
]

const compactFieldClass = `${fieldControlClass} !py-1.5 !px-2.5 !text-xs`

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
      .map((row) => {
        const qty = Math.max(0, Number(qtyByKey[row.key] || 0))
        if (!qty) return null
        if (row.variantId) {
          return { product_variant_id: row.variantId, qty }
        }
        return { product_id: row.productId, qty }
      })
      .filter(Boolean)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className={`${sectionCardClass} flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden !p-0`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <p className={sectionEyebrowClass}>{ar ? 'طباعة' : 'Print'}</p>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
              {ar ? 'ملصقات الباركود' : 'Print Barcode Labels'}
            </h3>
            <p className="text-xs text-slate-500">
              {ar ? `${productIds.length} منتج · ${rows.length} سطر` : `${productIds.length} products · ${rows.length} lines`}
            </p>
          </div>
          <button type="button" className={ghostActionClass} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-5 py-3 dark:border-dark-600">
          <label className={fieldLabelClass}>{ar ? 'تنسيق الملصق' : 'Label format'}</label>
          <select className={fieldControlClass} value={format} onChange={(e) => setFormat(e.target.value)}>
            {LABEL_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{ar ? f.ar : f.en}</option>
            ))}
          </select>
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
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-dark-900">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 text-start">{ar ? 'المنتج / المتغير' : 'Product / Variant'}</th>
                  <th className="w-28 px-3 py-2 text-start">SKU</th>
                  <th className="w-36 px-3 py-2 text-start">{ar ? 'الباركود' : 'Barcode'}</th>
                  <th className="w-28 px-3 py-2 text-end">
                    <div className="flex flex-col items-end gap-1">
                      <span>{ar ? 'عدد الملصقات' : 'Labels to print'}</span>
                      <button type="button" className={ghostActionClass} disabled={!rows.length} onClick={setAllOnHand}>
                        {ar ? 'حسب المخزون' : 'Set to On-Hand Qty'}
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="truncate px-4 py-2.5 font-medium text-slate-900 dark:text-white" title={displayName(row, ar)}>
                      {displayName(row, ar)}
                    </td>
                    <td className={`truncate px-3 py-2.5 ${monoCellClass}`}>{row.sku || '—'}</td>
                    <td className={`truncate px-3 py-2.5 ${monoCellClass}`}>{row.barcode || '—'}</td>
                    <td className="px-3 py-2.5 text-end">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={`${compactFieldClass} ms-auto w-20 text-end tabular-nums`}
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
            {ar ? `إجمالي: ${totalLabels}` : `Total: ${totalLabels}`}
          </span>
          <div className="flex gap-2">
            <button type="button" className={secondaryBtnClass} onClick={onClose}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className={primaryBtnClass}
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
