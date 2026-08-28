import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import api from '../../../lib/api'

async function resolveComponentVariants(productId) {
  if (!productId) {
    return { variantId: null, variantName: '', variants: [], needsVariant: false }
  }
  try {
    const data = await api.get('/stock/variants', {
      params: { productId, limit: 50 },
    }).then((r) => r.data)
    const items = Array.isArray(data) ? data : (data?.items || [])
    if (items.length === 1) {
      return {
        variantId: String(items[0]._id),
        variantName: items[0].name || '',
        variants: items,
        needsVariant: false,
      }
    }
    if (items.length > 1) {
      return {
        variantId: null,
        variantName: '',
        variants: items,
        needsVariant: true,
      }
    }
  } catch {
    /* optional */
  }
  return { variantId: null, variantName: '', variants: [], needsVariant: false }
}

/**
 * Finished-good picker that loads BOM components into draft lines.
 * Binds each component to its specific productId + variantId (never template-only).
 */
export function ManufacturingBomPicker({
  ar,
  disabled,
  produceQty,
  onProduceQtyChange,
  selectedFinished,
  onFinishedChange,
  finishedVariantId,
  onFinishedVariantChange,
  onBomLines,
}) {
  const [busy, setBusy] = useState(false)
  const [finishedVariants, setFinishedVariants] = useState([])
  const [finishedNeedsVariant, setFinishedNeedsVariant] = useState(false)

  const loadFinishedVariants = useCallback(async (productId) => {
    if (!productId) {
      setFinishedVariants([])
      setFinishedNeedsVariant(false)
      onFinishedVariantChange?.(null)
      return
    }
    const resolved = await resolveComponentVariants(productId)
    setFinishedVariants(resolved.variants || [])
    setFinishedNeedsVariant(resolved.needsVariant)
    if (resolved.variantId) {
      onFinishedVariantChange?.(resolved.variantId)
    } else if (resolved.needsVariant) {
      onFinishedVariantChange?.(null)
    } else {
      onFinishedVariantChange?.(null)
    }
  }, [onFinishedVariantChange])

  useEffect(() => {
    if (selectedFinished?._id) {
      loadFinishedVariants(String(selectedFinished._id))
    } else {
      setFinishedVariants([])
      setFinishedNeedsVariant(false)
    }
  }, [selectedFinished?._id, loadFinishedVariants])

  const fetchFinished = useCallback(async (q) => {
    const list = await api.get('/products', {
      params: { search: q, limit: 20, status: 'active' },
    }).then((r) => r.data?.products || r.data || [])
    return Array.isArray(list) ? list : []
  }, [])

  const loadBom = async (product) => {
    if (!product?._id) return
    if (finishedNeedsVariant && !finishedVariantId) {
      toast.error(ar ? 'اختر متغير المنتج النهائي' : 'Select finished-good variant')
      return
    }
    setBusy(true)
    try {
      const bom = await api.get(`/bom/${product._id}`).then((r) => r.data)
      const qty = Math.max(Number(produceQty) || 1, 0.0001)
      const base = Number(bom.baseQuantity) > 0 ? Number(bom.baseQuantity) : 1
      const ratio = qty / base
      const raw = (bom.components || [])
        .map((c) => ({
          productId: String(c.productId?._id || c.productId || ''),
          productName: ar && c.nameAr ? c.nameAr : (c.nameEn || c.sku || ''),
          sku: c.sku || '',
          demandQty: String(Number((Number(c.quantity) || 0) * ratio).toFixed(6)).replace(/\.?0+$/, '') || '0',
          uomId: c.uomId || undefined,
          uomLabel: c.uom || '',
          presetVariantId: c.variantId?._id || c.variantId || null,
          presetVariantName: c.variantName || '',
        }))
        .filter((l) => l.productId && Number(l.demandQty) > 0)

      const lines = await Promise.all(raw.map(async (l) => {
        const resolved = await resolveComponentVariants(l.productId)
        let variantId = resolved.variantId
        let variantName = resolved.variantName
        let needsVariant = resolved.needsVariant
        if (l.presetVariantId) {
          const match = (resolved.variants || []).find((v) => String(v._id) === String(l.presetVariantId))
          if (match) {
            variantId = String(match._id)
            variantName = match.name || l.presetVariantName || ''
            needsVariant = false
          } else {
            variantId = String(l.presetVariantId)
            variantName = l.presetVariantName || ''
            needsVariant = false
          }
        }
        return {
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          demandQty: l.demandQty,
          variantId,
          variantName,
          needsVariant,
          variants: resolved.variants,
          uomId: l.uomId,
          uomLabel: l.uomLabel,
        }
      }))

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
    <div className="overflow-visible rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-dark-600 dark:bg-dark-900/30">
      <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-white">
        {ar ? 'المنتج النهائي / قائمة المواد' : 'Finished Good / BOM'}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        {ar
          ? 'اختر منتجاً نهائياً (ومتغيره إن وُجد) لتعبئة بنود المكونات تلقائياً من قائمة المواد.'
          : 'Select a finished good (and variant if applicable) to auto-populate component lines from its BOM.'}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {ar ? 'اسم المنتج' : 'Product name'}
          </span>
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
              onFinishedVariantChange?.(null)
              if (opt) loadBom(opt)
            }}
          />
        </div>
        {finishedVariants.length > 1 && (
          <label className="block w-full max-w-[12rem] shrink-0 text-sm">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {ar ? 'المتغير' : 'Variant'}
            </span>
            <select
              className="input input-sm w-full"
              disabled={disabled || busy}
              value={finishedVariantId || ''}
              onChange={(e) => {
                onFinishedVariantChange?.(e.target.value || null)
              }}
              onBlur={() => {
                if (selectedFinished) loadBom(selectedFinished)
              }}
            >
              <option value="">{ar ? '— اختر —' : '— Select —'}</option>
              {finishedVariants.map((v) => (
                <option key={v._id} value={v._id}>{v.name || v.sku}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block w-full max-w-[7.5rem] shrink-0 text-sm">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {ar ? 'كمية الإنتاج' : 'Qty to produce'}
          </span>
          <input
            className="input input-sm w-full max-w-[7.5rem] text-end tabular-nums"
            inputMode="decimal"
            disabled={disabled || busy}
            value={produceQty}
            onChange={(e) => onProduceQtyChange?.(e.target.value)}
            onBlur={() => {
              if (selectedFinished) loadBom(selectedFinished)
            }}
          />
        </label>
        <div className="flex shrink-0 items-end">
          <button
            type="button"
            className="btn btn-secondary btn-sm w-full sm:w-auto"
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
