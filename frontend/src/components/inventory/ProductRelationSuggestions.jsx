import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, Plus } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { productPickerLabel } from '../../lib/productType'

function relatedId(row) {
  const p = row?.relatedProductId
  return String(p?._id || p || '')
}

function relatedDoc(row) {
  return typeof row?.relatedProductId === 'object' ? row.relatedProductId : null
}

function nameOf(row, language, productsById) {
  const doc = relatedDoc(row) || productsById.get(relatedId(row))
  if (!doc) return relatedId(row)
  return productPickerLabel(doc, language) || doc.nameEn || doc.name || doc.sku
}

function priceOf(row, productsById) {
  const doc = relatedDoc(row) || productsById.get(relatedId(row))
  const n = Number(doc?.sellingPrice)
  return Number.isFinite(n) ? n : null
}

/**
 * Inline sales suggestions after a product line is selected.
 * Uses /stock/products/:id/suggestions — no history auto-generation.
 */
export function LineRelationSuggestions({
  productId,
  currentUnitPrice,
  products = [],
  language = 'en',
  onAdd,
  onSwap,
  includeOptional = false,
  className = '',
}) {
  const ar = language === 'ar'
  const productsById = useMemo(() => {
    const m = new Map()
    for (const p of products || []) m.set(String(p._id), p)
    return m
  }, [products])

  const types = includeOptional
    ? 'accessory,upsell,cross_sell,optional'
    : 'accessory,upsell,cross_sell'

  const { data: rows = [] } = useQuery({
    queryKey: ['inv-product-suggestions', productId, types],
    queryFn: () =>
      api
        .get(`/stock/products/${productId}/suggestions`, { params: { types } })
        .then((r) => asInvList(r.data)),
    enabled: Boolean(productId),
    staleTime: 30_000,
  })

  const grouped = useMemo(() => {
    const cross = []
    const accessories = []
    const upsells = []
    const optional = []
    for (const row of rows) {
      if (!relatedId(row)) continue
      if (row.type === 'cross_sell') cross.push(row)
      else if (row.type === 'accessory') accessories.push(row)
      else if (row.type === 'upsell') upsells.push(row)
      else if (row.type === 'optional') optional.push(row)
    }
    return { cross, accessories, upsells, optional }
  }, [rows])

  if (!productId || rows.length === 0) return null

  const chip = (row, label, action) => (
    <button
      key={row._id}
      type="button"
      onClick={() => action(row)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 dark:border-dark-500 dark:bg-dark-800 dark:text-slate-200"
    >
      <Plus className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate">{label}</span>
    </button>
  )

  return (
    <div className={`space-y-2 rounded-xl border border-dashed border-emerald-200/80 bg-emerald-50/40 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 ${className}`}>
      {grouped.upsells.length > 0 && onSwap && (
        <div className="space-y-1">
          {grouped.upsells.slice(0, 3).map((row) => {
            const price = priceOf(row, productsById)
            const cur = Number(currentUnitPrice)
            const delta = price != null && Number.isFinite(cur) ? price - cur : null
            const deltaLabel =
              delta == null
                ? ''
                : delta === 0
                  ? ''
                  : ` — ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`
            return (
              <button
                key={row._id}
                type="button"
                onClick={() => onSwap(row)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-left text-xs font-medium text-amber-900 transition hover:border-amber-400 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <ArrowRightLeft className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {ar ? 'ترقية إلى' : 'Upgrade to'} {nameOf(row, language, productsById)}
                  {deltaLabel}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {grouped.cross.length > 0 && onAdd && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {ar ? 'يُشترى معاً غالباً' : 'Frequently bought together'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {grouped.cross.slice(0, 4).map((row) =>
              chip(row, nameOf(row, language, productsById), onAdd),
            )}
          </div>
        </div>
      )}

      {grouped.accessories.length > 0 && onAdd && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {ar ? 'يضيفه العملاء أيضاً' : 'Customers also add'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {grouped.accessories.slice(0, 4).map((row) =>
              chip(row, nameOf(row, language, productsById), onAdd),
            )}
          </div>
        </div>
      )}

      {includeOptional && grouped.optional.length > 0 && onAdd && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {ar ? 'اختياري' : 'Optional add-ons'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {grouped.optional.slice(0, 4).map((row) =>
              chip(row, nameOf(row, language, productsById), onAdd),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Horizontal POS strip — prefers preloaded relationsBySource map (no per-tap API).
 * Falls back to one suggestions fetch when map is missing.
 */
export function PosRelationStrip({
  tradingProductId,
  relationsBySource = null,
  resolveAddable,
  onAdd,
  language = 'en',
  className = '',
}) {
  const ar = language === 'ar'

  const { data: fetched = [] } = useQuery({
    queryKey: ['inv-product-suggestions', tradingProductId, 'pos-strip'],
    queryFn: () =>
      api
        .get(`/stock/products/${tradingProductId}/suggestions`, {
          params: { types: 'accessory,cross_sell' },
        })
        .then((r) => asInvList(r.data)),
    enabled: Boolean(tradingProductId) && !relationsBySource,
    staleTime: 60_000,
  })

  const rows = useMemo(() => {
    if (!tradingProductId) return []
    if (relationsBySource) {
      const list = relationsBySource.get(String(tradingProductId)) || []
      return list.filter((r) => r.active !== false && (r.type === 'accessory' || r.type === 'cross_sell'))
    }
    return fetched
  }, [tradingProductId, relationsBySource, fetched])

  const chips = useMemo(() => {
    const out = []
    for (const row of rows) {
      const rid = relatedId(row)
      const addable = resolveAddable ? resolveAddable(rid, row) : relatedDoc(row)
      if (!addable) continue
      out.push({ row, addable, label: nameOf(row, language, new Map()) || addable.name || addable.nameEn })
    }
    return out.slice(0, 8)
  }, [rows, resolveAddable, language])

  if (!tradingProductId || chips.length === 0) return null

  return (
    <div className={`border-t border-gray-100 bg-white/90 px-4 py-2 ${className}`}>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {ar ? 'إضافات مقترحة' : 'Suggested add-ons'}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {chips.map(({ row, addable, label }) => (
          <button
            key={row._id}
            type="button"
            onClick={() => onAdd?.(addable, row)}
            className="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-left text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <span className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              <span className="max-w-[10rem] truncate">{label}</span>
            </span>
            {row.type === 'cross_sell' ? (
              <span className="mt-0.5 block text-[9px] font-medium text-emerald-600/80">
                {ar ? 'يُشترى معاً' : 'Often bought together'}
              </span>
            ) : (
              <span className="mt-0.5 block text-[9px] font-medium text-emerald-600/80">
                {ar ? 'إكسسوار' : 'Accessory'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function buildRelationsBySource(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const sid = String(row.sourceProductId?._id || row.sourceProductId || '')
    if (!sid) continue
    if (!map.has(sid)) map.set(sid, [])
    map.get(sid).push(row)
  }
  return map
}
