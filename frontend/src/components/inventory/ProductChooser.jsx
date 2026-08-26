import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { isStockTrackedProductType, normalizeProductType } from '../../lib/productType'
import api from '../../lib/api'

export function normalizeCatalogProduct(p, source = 'bakala') {
  if (!p) return null
  const name = p.nameEn || p.name || p.nameAr || 'Untitled'
  return {
    _id: p._id,
    name,
    nameAr: p.nameAr || '',
    barcode: String(p.primaryBarcode || p.barcode || p.sku || ''),
    barcodes: Array.isArray(p.barcodes) ? p.barcodes.map(String) : [],
    sku: String(p.sku || ''),
    productType: normalizeProductType(p.productType),
    unitOfMeasure: p.unitOfMeasure || p.uom || 'EA',
    uomId: p.uomId || undefined,
    costPrice: Number(p.costPrice || 0),
    source,
    raw: p,
  }
}

/** Trading Product catalog only — safe for Inv* transfers / physical count. */
export async function loadTradingProducts(apiClient = api, {
  stockTrackedOnly = true,
  limit = 40,
  search = '',
  productType = 'goods',
} = {}) {
  const res = await apiClient.get('/products', {
    params: {
      limit,
      search: search || undefined,
      productType: stockTrackedOnly ? productType : undefined,
    },
  })
  const list = Array.isArray(res.data) ? res.data : (res.data?.products || [])
  return list
    .map((p) => normalizeCatalogProduct(p, 'trading'))
    .filter((p) => {
      if (!p?._id) return false
      if (stockTrackedOnly && !isStockTrackedProductType(p.productType)) return false
      return true
    })
}

export async function loadInventoryProducts(apiClient = api) {
  const bags = []
  try {
    const res = await apiClient.get('/bakala-products', { params: { limit: 200 } })
    const list = Array.isArray(res.data) ? res.data : (res.data?.products || [])
    bags.push(...list.map((p) => normalizeCatalogProduct(p, 'bakala')))
  } catch {
    /* bakala catalog optional */
  }
  try {
    bags.push(...(await loadTradingProducts(apiClient, { stockTrackedOnly: false, limit: 200 })))
  } catch {
    /* trading catalog optional */
  }
  const seen = new Set()
  return bags.filter((p) => {
    if (!p?._id) return false
    const key = String(p._id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function matchesProduct(product, term) {
  const q = term.trim().toLowerCase()
  if (!q) return true
  return (
    product.name.toLowerCase().includes(q) ||
    product.nameAr.toLowerCase().includes(q) ||
    product.barcode.toLowerCase().includes(q) ||
    product.sku.toLowerCase().includes(q) ||
    product.barcodes.some((b) => b.toLowerCase().includes(q))
  )
}

function exactProduct(products, term) {
  const q = term.trim().toLowerCase()
  if (!q) return null
  return products.find((p) =>
    p.barcode.toLowerCase() === q ||
    p.sku.toLowerCase() === q ||
    p.barcodes.some((b) => b.toLowerCase() === q)
  )
}

function productCode(p) {
  const sku = (p.sku || '').trim()
  const barcode = (p.barcode || '').trim()
  if (sku) return sku
  if (barcode && barcode !== sku) return barcode
  return ''
}

/**
 * @param {object} props
 * @param {Array} [props.products]
 * @param {boolean} [props.remote]
 * @param {(p: object) => void} props.onPick
 * @param {'search'|'inline'} [props.mode]
 * @param {string} [props.valueLabel]
 * @param {string} [props.valueSub]
 */
export default function ProductChooser({
  products: productsProp = [],
  remote = false,
  onPick,
  accent = 'emerald',
  placeholder = 'Search by name, SKU, or scan barcode…',
  mode = 'search',
  valueLabel = '',
  valueSub = '',
  className = '',
}) {
  const inline = mode === 'inline'
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [remoteProducts, setRemoteProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: 320 })
  const focusRing = accent === 'rose'
    ? 'border-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
    : 'border-teal-600 shadow-[0_0_0_3px_rgba(13,148,136,0.15)]'
  const addTone = accent === 'rose'
    ? 'text-rose-600 bg-rose-50'
    : 'text-teal-700 bg-teal-50'

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedTerm(term), 220)
    return () => clearTimeout(handle)
  }, [term])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      const t = e.target
      if (rootRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
      setTerm('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!remote) return undefined
    if (inline && !open) return undefined
    let cancelled = false
    setLoading(true)
    loadTradingProducts(api, { search: debouncedTerm, limit: 40 })
      .then((list) => {
        if (!cancelled) setRemoteProducts(list)
      })
      .catch(() => {
        if (!cancelled) setRemoteProducts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [remote, debouncedTerm, inline, open])

  const products = remote ? remoteProducts : productsProp

  const suggestions = useMemo(() => {
    if (remote) return products.slice(0, 12)
    return products.filter((p) => matchesProduct(p, term)).slice(0, 12)
  }, [products, term, remote])

  useLayoutEffect(() => {
    if (!open || !inline) return undefined
    const place = () => {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = Math.min(Math.max(rect.width, 260), Math.min(340, window.innerWidth - 16))
      const estimatedHeight = 260
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
      setPanelStyle({
        position: 'fixed',
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        left,
        width,
        zIndex: 9999,
      })
    }
    place()
    if (inputRef.current) inputRef.current.focus()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, inline, suggestions.length, loading])

  const pick = (product) => {
    if (!product) return
    onPick(product)
    setTerm('')
    setOpen(false)
  }

  const openPicker = () => {
    setOpen(true)
    setTerm('')
  }

  const submit = (e) => {
    e.preventDefault()
    const exact = exactProduct(products, term)
    if (exact) {
      pick(exact)
      return
    }
    const named = remote
      ? products
      : products.filter((p) => matchesProduct(p, term))
    if (named.length === 1) {
      pick(named[0])
      return
    }
    setOpen(true)
  }

  if (inline) {
    const searchPlaceholder = placeholder.includes('Pick') || placeholder.includes('اختر')
      ? (placeholder.includes('اختر') ? 'ابحث…' : 'Search…')
      : 'Search…'

    const panel = open && typeof document !== 'undefined'
      ? createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800"
        >
          <div className="max-h-60 overflow-y-auto overscroll-contain py-1">
            {loading ? (
              <p className="px-3.5 py-3 text-xs text-slate-400">…</p>
            ) : suggestions.length === 0 ? (
              <p className="px-3.5 py-3 text-xs text-slate-400">
                {term.trim() ? 'No matches' : 'No products'}
              </p>
            ) : (
              suggestions.map((p) => {
                const code = productCode(p)
                return (
                  <button
                    key={p._id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(p)}
                    className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-dark-700/80"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium tracking-tight text-slate-900 dark:text-white">
                        {p.name}
                      </span>
                      {code ? (
                        <span className="mt-0.5 block truncate font-mono text-[10px] tracking-wide text-slate-400">
                          {code}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg opacity-0 transition group-hover:opacity-100 ${addTone}`}
                      aria-hidden
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body,
      )
      : null

    return (
      <div ref={rootRef} className={`relative min-w-0 ${className}`}>
        {open ? (
          <div
            ref={triggerRef}
            className={`flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 dark:bg-dark-900 ${focusRing}`}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false)
                  setTerm('')
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (suggestions[0]) pick(suggestions[0])
                }
              }}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            />
            <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-180 text-slate-300" />
          </div>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            onClick={openPicker}
            className={`flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 text-start text-[13px] outline-none transition hover:border-slate-300 dark:bg-dark-900 ${
              valueLabel
                ? 'border-slate-200/90 text-slate-900 dark:border-dark-600 dark:text-white'
                : 'border-dashed border-slate-200 text-slate-400 hover:border-teal-500/60 hover:text-teal-700 dark:border-dark-500'
            }`}
          >
            <Search className="h-3.5 w-3.5 shrink-0 opacity-40" />
            <span className="min-w-0 flex-1 truncate">
              {valueLabel ? (
                <>
                  <span className="block truncate font-medium tracking-tight">{valueLabel}</span>
                  {valueSub ? (
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">{valueSub}</span>
                  ) : null}
                </>
              ) : (
                <span className="tracking-tight">{placeholder}</span>
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          </button>
        )}
        {panel}
      </div>
    )
  }

  return (
    <div className={`relative max-w-xl ${className}`}>
      <form onSubmit={submit}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none ring-4 ring-transparent placeholder:text-slate-400 focus:border-teal-600 focus:shadow-[0_0_0_3px_rgba(13,148,136,0.15)]`}
        />
      </form>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.35)]">
          {loading ? (
            <p className="px-4 py-3 text-xs text-slate-400">Searching…</p>
          ) : products.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">
              {remote && !debouncedTerm.trim()
                ? 'Type to search the product catalog.'
                : 'No products in catalog yet.'}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">No matching products.</p>
          ) : (
            <div className="py-1">
              {suggestions.map((p) => {
                const code = productCode(p)
                return (
                  <button
                    key={p._id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(p)}
                    className="group flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{p.name}</span>
                      {code ? (
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">{code}</span>
                      ) : null}
                    </span>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg opacity-0 transition group-hover:opacity-100 ${addTone}`}>
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
