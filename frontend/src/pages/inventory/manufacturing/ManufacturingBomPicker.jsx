import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import api from '../../../lib/api'

/**
 * Finished-good picker that loads BOM components into draft lines.
 */
export function ManufacturingBomPicker({
  ar,
  disabled,
  produceQty,
  onProduceQtyChange,
  selectedFinished,
  onFinishedChange,
  onBomLines,
}) {
  const [busy, setBusy] = useState(false)

  const fetchFinished = useCallback(async (q) => {
    const list = await api.get('/products', {
      params: { search: q, limit: 20, status: 'active' },
    }).then((r) => r.data?.products || r.data || [])
    return Array.isArray(list) ? list : []
  }, [])

  const loadBom = async (product) => {
    if (!product?._id) return
    setBusy(true)
    try {
      const bom = await api.get(`/bom/${product._id}`).then((r) => r.data)
      const qty = Math.max(Number(produceQty) || 1, 0.0001)
      const base = Number(bom.baseQuantity) > 0 ? Number(bom.baseQuantity) : 1
      const ratio = qty / base
      const lines = (bom.components || []).map((c) => ({
        productId: String(c.productId?._id || c.productId),
        productName: ar && c.nameAr ? c.nameAr : (c.nameEn || c.sku || ''),
        sku: c.sku || '',
        demandQty: String(Number((Number(c.quantity) || 0) * ratio).toFixed(6)).replace(/\.?0+$/, '') || '0',
        variantId: null,
        variantName: '',
        needsVariant: false,
        variants: [],
        uomId: c.uomId || undefined,
        uomLabel: c.uom || '',
      })).filter((l) => l.productId && Number(l.demandQty) > 0)

      if (!lines.length) {
        toast.error(ar ? 'لا توجد مكونات في قائمة المواد' : 'No BOM components found for this product')
        onBomLines?.([])
        return
      }
      onBomLines?.(lines)
      toast.success(
        ar
          ? `تم تحميل ${lines.length} مكون من قائمة المواد`
          : `Loaded ${lines.length} BOM component(s)`,
      )
    } catch (e) {
      toast.error(
        e?.response?.data?.error
        || (ar ? 'تعذر تحميل قائمة المواد' : 'Could not load BOM'),
      )
      onBomLines?.([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-dark-600 dark:bg-dark-900/30">
      <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
        {ar ? 'المنتج النهائي / قائمة المواد' : 'Finished Good / BOM'}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        {ar
          ? 'اختر منتجاً نهائياً لتعبئة بنود المكونات تلقائياً من قائمة المواد.'
          : 'Select a finished good to auto-populate component lines from its BOM.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_7rem_auto]">
        <AsyncCombobox
          value={selectedFinished?._id || ''}
          selectedOption={selectedFinished}
          disabled={disabled || busy}
          debounceMs={300}
          minChars={1}
          queryKeyPrefix="mfg-finished-good"
          fetchOptions={fetchFinished}
          placeholder={ar ? 'ابحث عن منتج نهائي…' : 'Search finished good…'}
          noResultsText={ar ? 'لا توجد نتائج' : 'No results found'}
          getOptionLabel={(p) => (ar && p.nameAr ? p.nameAr : p.nameEn || p.name) || p.sku || '—'}
          getOptionSub={(p) => p.sku || ''}
          onChange={(_id, opt) => {
            onFinishedChange?.(opt)
            if (opt) loadBom(opt)
          }}
        />
        <label className="block text-sm">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {ar ? 'كمية الإنتاج' : 'Qty to produce'}
          </span>
          <input
            className="input input-sm w-full text-end tabular-nums"
            inputMode="decimal"
            disabled={disabled || busy}
            value={produceQty}
            onChange={(e) => onProduceQtyChange?.(e.target.value)}
            onBlur={() => {
              if (selectedFinished) loadBom(selectedFinished)
            }}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="btn btn-secondary btn-sm w-full"
            disabled={disabled || busy || !selectedFinished}
            onClick={() => loadBom(selectedFinished)}
          >
            {busy ? '…' : (ar ? 'تحديث المكونات' : 'Reload BOM')}
          </button>
        </div>
      </div>
    </div>
  )
}
