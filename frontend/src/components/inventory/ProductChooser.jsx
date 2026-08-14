import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

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
    costPrice: Number(p.costPrice || 0),
    source,
    raw: p,
  }
}

export async function loadInventoryProducts(api) {
  const bags = []
  try {
    const res = await api.get('/bakala-products', { params: { limit: 500 } })
    const list = Array.isArray(res.data) ? res.data : (res.data?.products || [])
    bags.push(...list.map((p) => normalizeCatalogProduct(p, 'bakala')))
  } catch {
    /* bakala catalog optional */
  }
  try {
    const res = await api.get('/products', { params: { limit: 200 } })
    const list = Array.isArray(res.data) ? res.data : (res.data?.products || [])
    bags.push(...list.map((p) => normalizeCatalogProduct(p, 'trading')))
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

export default function ProductChooser({
  products = [],
  onPick,
  accent = 'emerald',
  placeholder = 'Search by name, SKU, or scan barcode…',
}) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const ring = accent === 'rose'
    ? 'focus:border-rose-400 focus:ring-rose-500/15'
    : 'focus:border-emerald-400 focus:ring-emerald-500/15'
  const addTone = accent === 'rose' ? 'text-rose-700' : 'text-emerald-700'

  const suggestions = useMemo(() => {
    return products.filter((p) => matchesProduct(p, term)).slice(0, 14)
  }, [products, term])

  const pick = (product) => {
    if (!product) return
    onPick(product)
    setTerm('')
    setOpen(false)
  }

  const submit = (e) => {
    e.preventDefault()
    const exact = exactProduct(products, term)
    if (exact) {
      pick(exact)
      return
    }
    const named = products.filter((p) => matchesProduct(p, term))
    if (named.length === 1) {
      pick(named[0])
      return
    }
    setOpen(true)
  }

  return (
    <div className="relative max-w-xl">
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
          className={`w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none ring-4 ring-transparent placeholder:text-slate-400 ${ring}`}
        />
      </form>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)]">
          {products.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No products in catalog yet.</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No matching products. Try a name, SKU, or barcode.</p>
          ) : (
            <>
              {!term.trim() && (
                <p className="border-b border-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Choose a product
                </p>
              )}
              {suggestions.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{p.name}</span>
                    <span className="block text-[11px] text-slate-400">
                      {[p.sku && `SKU ${p.sku}`, p.barcode].filter(Boolean).join(' · ') || 'No barcode'}
                    </span>
                  </span>
                  <span className={`text-[11px] font-semibold ${addTone}`}>Add</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
