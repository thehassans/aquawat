import { useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import AsyncCombobox from '../../../components/ui/AsyncCombobox'
import api from '../../../lib/api'
import { ReceiptQuickAdd } from '../receipts/ReceiptQuickAdd'

/**
 * Search products AND variants in one step.
 * Returns selectable rows like "SKU — Variant Name" so the user picks the
 * concrete variant without a second dropdown.
 */
async function searchProductsAndVariants(q, { variantsEnabled }) {
  const needle = String(q || '').trim()
  if (needle.length < 1) return []

  const results = []
  const seen = new Set()

  if (variantsEnabled) {
    try {
      const data = await api.get('/stock/variants', {
        params: { q: needle, limit: 20 },
      }).then((r) => r.data)
      const items = Array.isArray(data) ? data : (data?.items || data?.variants || [])
      for (const v of items) {
        const productId = typeof v.productId === 'object' ? v.productId?._id : v.productId
        if (!productId || !v._id) continue
        const key = `v:${v._id}`
        if (seen.has(key)) continue
        seen.add(key)
        const productName = (typeof v.productId === 'object'
          ? (v.productId.nameEn || v.productId.name)
          : null) || ''
        const sku = v.sku || (typeof v.productId === 'object' ? v.productId.sku : '') || ''
        results.push({
          _id: key,
          kind: 'variant',
          productId,
          variantId: v._id,
          variantName: v.name || '',
          productName,
          sku,
          name: [sku, v.name || productName].filter(Boolean).join(' — ') || v.name,
          barcode: v.barcode,
        })
      }
    } catch { /* variants optional */ }
  }

  try {
    const list = await api.get('/products', {
      params: { search: needle, limit: 15, status: 'active' },
    }).then((r) => r.data?.products || r.data || [])
    for (const p of list) {
      const key = `p:${p._id}`
      if (seen.has(key)) continue
      // Skip template products that already have a matching variant in results
      const hasVariantHit = results.some((r) => String(r.productId) === String(p._id) && r.kind === 'variant')
      if (hasVariantHit && variantsEnabled) continue
      seen.add(key)
      results.push({
        _id: key,
        kind: 'product',
        productId: p._id,
        variantId: null,
        variantName: '',
        productName: p.nameEn || p.name || '',
        sku: p.sku || '',
        name: [p.sku, p.nameEn || p.name].filter(Boolean).join(' — ') || p.nameEn || p.name,
        barcode: p.barcode,
        uomId: p.uomId,
        unitOfMeasure: p.unitOfMeasure,
        nameAr: p.nameAr,
      })
    }
  } catch { /* ignore */ }

  return results.slice(0, 25)
}

/**
 * Internal transfer draft lines with one-step product/variant picker.
 */
export function InternalDraftLines({
  ar,
  lines,
  variantsEnabled,
  onChangeLine,
  onRemoveLine,
  onAddLine,
  onPickResolved,
  barcodeEnabled,
  onAddOrIncrementCreate,
}) {
  const fetchOptions = useCallback(
    (q) => searchProductsAndVariants(q, { variantsEnabled }),
    [variantsEnabled],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'بنود التحويل' : 'Transfer Lines'}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {ar ? 'منتج / متغير · كمية' : 'Product / variant · quantity'}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddLine}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-600 hover:text-sky-800 dark:border-dark-500 dark:bg-dark-700 dark:text-slate-100"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          {ar ? 'إضافة' : 'Add'}
        </button>
      </div>

      <ReceiptQuickAdd
        ar={ar}
        enabled={barcodeEnabled}
        mode="create"
        onAddOrIncrementCreate={onAddOrIncrementCreate}
      />

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-4 py-10 text-center dark:border-dark-600 dark:bg-dark-900/30">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {ar ? 'لا توجد بنود بعد' : 'No lines yet'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {ar ? 'ابحث عن منتج أو متغير…' : 'Search a product or variant…'}
          </p>
        </div>
      ) : (
        <div className="overflow-visible rounded-2xl border border-slate-200/80 dark:border-dark-600">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,8rem)_2.25rem] gap-2 border-b border-slate-100 px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:border-dark-600 sm:grid">
            <span>{ar ? 'المنتج / المتغير' : 'Product / Variant'}</span>
            <span>{ar ? 'الكمية' : 'Qty'}</span>
            <span />
          </div>
          <div className="divide-y divide-slate-100/90 dark:divide-dark-600">
            {lines.map((line, idx) => {
              const selectedOption = line.productId
                ? {
                    _id: line.variantId ? `v:${line.variantId}` : `p:${line.productId}`,
                    name: [line.sku, line.variantName || line.productName].filter(Boolean).join(' — ')
                      || line.productName
                      || '—',
                    sku: line.sku,
                    productName: line.productName,
                    variantName: line.variantName,
                  }
                : null
              return (
                <div
                  key={`draft-${idx}`}
                  className="grid grid-cols-1 gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,8rem)_2.25rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <AsyncCombobox
                      value={selectedOption?._id || ''}
                      selectedOption={selectedOption}
                      debounceMs={300}
                      minChars={1}
                      queryKeyPrefix="internal-product-variant"
                      fetchOptions={fetchOptions}
                      placeholder={ar ? 'ابحث عن منتج أو متغير…' : 'Search product or variant…'}
                      noResultsText={ar ? 'لا توجد نتائج' : 'No results found'}
                      getOptionLabel={(o) => o.name || o.productName || '—'}
                      getOptionSub={(o) => {
                        if (o.kind === 'variant' || o.variantName) {
                          return [o.sku, o.productName].filter(Boolean).join(' · ')
                        }
                        return o.sku || ''
                      }}
                      onChange={async (_id, opt) => {
                        try {
                          if (!opt) {
                            onChangeLine(idx, {
                              ...line,
                              productId: '',
                              productName: '',
                              sku: '',
                              variantId: null,
                              variantName: '',
                              variants: [],
                              needsVariant: false,
                            })
                            return
                          }
                          // Variant row already binds concrete productId + variantId
                          if (opt.kind === 'variant' || opt.variantId) {
                            onPickResolved?.(idx, {
                              productId: opt.productId,
                              productName: opt.productName || opt.name,
                              sku: opt.sku || '',
                              variantId: opt.variantId || null,
                              variantName: opt.variantName || '',
                              uomId: opt.uomId,
                              uomLabel: opt.unitOfMeasure || '',
                              needsVariant: false,
                              variants: [],
                            })
                            return
                          }
                          // Product template — resolve specific variant when required
                          let variantId = null
                          let variantName = ''
                          let variants = []
                          let needsVariant = false
                          if (variantsEnabled && opt.productId) {
                            try {
                              const data = await api.get('/stock/variants', {
                                params: { productId: opt.productId, limit: 50 },
                              }).then((r) => r.data)
                              const items = Array.isArray(data) ? data : (data?.items || [])
                              variants = items
                              if (items.length === 1) {
                                variantId = items[0]._id
                                variantName = items[0].name || ''
                              } else if (items.length > 1) {
                                needsVariant = true
                              }
                            } catch { /* optional */ }
                          }
                          onPickResolved?.(idx, {
                            productId: opt.productId,
                            productName: opt.productName || opt.name,
                            sku: opt.sku || '',
                            variantId,
                            variantName,
                            uomId: opt.uomId,
                            uomLabel: opt.unitOfMeasure || '',
                            needsVariant,
                            variants,
                          })
                        } catch {
                          /* never leak unhandled axios/rejection to window */
                        }
                      }}
                    />
                    {variantsEnabled && line.needsVariant && Array.isArray(line.variants) && line.variants.length > 0 && (
                      <div className="relative z-20 mt-1 overflow-visible">
                        <select
                          className="select w-full text-xs"
                          value={line.variantId || ''}
                          onChange={(e) => {
                            const variantId = e.target.value || null
                            const selected = line.variants.find((v) => String(v._id) === String(variantId))
                            onChangeLine(idx, {
                              ...line,
                              productId: line.productId,
                              variantId,
                              variantName: selected?.name || '',
                              needsVariant: !variantId,
                            })
                          }}
                        >
                          <option value="">{ar ? '— متغير —' : '— Variant —'}</option>
                          {line.variants.map((v) => (
                            <option key={v._id} value={v._id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <input
                    className="input input-sm w-full text-end tabular-nums"
                    inputMode="decimal"
                    value={line.demandQty}
                    onChange={(e) => onChangeLine(idx, { ...line, demandQty: e.target.value })}
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => onRemoveLine(idx)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
