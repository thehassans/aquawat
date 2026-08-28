import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { formatInvError } from '../../lib/invError'
import { invalidateProductCategories, PRODUCT_CATEGORIES_KEY, PRODUCT_CATEGORIES_POPULAR_KEY } from '../../lib/productCategoryQueries'

/**
 * Searchable hierarchical category combobox.
 * Shows complete paths, indents by depth, top-used hints, inline create.
 */
export default function CategoryCombobox({
  value,
  onChange,
  language = 'en',
  disabled = false,
}) {
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef(null)

  const { data: categories = [], isError: catsError, error: catsErr } = useQuery({
    queryKey: PRODUCT_CATEGORIES_KEY,
    queryFn: () => api.get('/stock/product-categories').then((r) => asInvList(r.data)),
    staleTime: 60_000,
    retry: 1,
  })

  const { data: popular = [] } = useQuery({
    queryKey: PRODUCT_CATEGORIES_POPULAR_KEY,
    queryFn: () => api.get('/stock/product-categories/popular').then((r) => asInvList(r.data)).catch(() => []),
    staleTime: 10 * 60 * 1000,
  })

  const selected = useMemo(
    () => categories.find((c) => String(c._id) === String(value)),
    [categories, value],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let rows = [...categories].sort((a, b) => String(a.completePath || '').localeCompare(String(b.completePath || '')))
    if (needle) {
      rows = rows.filter((c) => {
        const path = String(c.completePath || c.name || '').toLowerCase()
        return path.includes(needle) || String(c.nameAr || '').toLowerCase().includes(needle)
      })
    }
    return rows.slice(0, 80)
  }, [categories, q])

  const popularUnique = useMemo(() => {
    const seen = new Set()
    return popular.filter((c) => {
      const id = String(c._id)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [popular])

  const depthOf = (c) => Math.max(0, String(c.completePath || '').split('/').length - 1)

  const createMut = useMutation({
    mutationFn: (name) => api.post('/stock/product-categories', {
      name,
      // Manual until user opts into Full accounting + fills stock accounts
      valuationMode: 'manual',
      costingMethod: 'average',
      parentId: selected?._id || undefined,
    }),
    onSuccess: (res) => {
      const cat = res?.data ?? res
      const catId = cat?._id
      if (catId) {
        qc.setQueryData(PRODUCT_CATEGORIES_KEY, (old) => {
          const list = Array.isArray(old) ? old : []
          if (list.some((c) => String(c._id) === String(catId))) return list
          return [...list, cat].sort((a, b) => String(a.completePath || a.name || '').localeCompare(String(b.completePath || b.name || '')))
        })
      }
      invalidateProductCategories(qc)
      onChange?.(catId, cat)
      setQ('')
      setOpen(false)
      toast.success(ar ? 'تم إنشاء الفئة' : 'Category created')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const showHints = !q.trim() && popularUnique.length > 0
  const showCreate = q.trim() && !filtered.some(
    (c) => String(c.name || '').toLowerCase() === q.trim().toLowerCase(),
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        className="input flex w-full items-center justify-between text-start"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
          {selected
            ? (selected.completePath || selected.name)
            : (ar ? 'اختر فئة…' : 'Select category…')}
        </span>
        <span className="text-xs text-slate-400">▾</span>
      </button>

      {selected && (
        <p className="mt-1 text-[11px] text-slate-400">
          {(ar ? 'التكلفة' : 'Costing')}: {selected.costingMethod || 'average'}
          {' · '}
          {(ar ? 'التقييم' : 'Valuation')}: {selected.valuationMode || 'automated'}
        </p>
      )}
      {catsError && (
        <p className="mt-1 text-[11px] text-rose-600">
          {formatInvError(catsErr, language)}
        </p>
      )}

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-dark-600 dark:bg-dark-800">
          <input
            autoFocus
            className="input w-full rounded-none border-0 border-b border-slate-100 dark:border-dark-600"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث في المسار…' : 'Search path…'}
          />
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-start text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-700"
                onClick={() => { onChange?.(''); setOpen(false) }}
              >
                {ar ? '— بدون —' : '— None —'}
              </button>
            </li>
            {showHints && (
              <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {ar ? 'الأكثر استخداماً' : 'Most used'}
              </li>
            )}
            {(showHints ? popularUnique : []).map((c) => (
              <li key={`pop-${c._id}`}>
                <button
                  type="button"
                  className="w-full truncate px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-dark-700"
                  onClick={() => { onChange?.(c._id, c); setOpen(false) }}
                >
                  {c.completePath || c.name}
                </button>
              </li>
            ))}
            {filtered.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  className={`w-full truncate px-3 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-dark-700 ${
                    String(c._id) === String(value) ? 'bg-primary-50 dark:bg-primary-950/30' : ''
                  }`}
                  style={{ paddingInlineStart: `${12 + depthOf(c) * 12}px` }}
                  onClick={() => { onChange?.(c._id, c); setOpen(false) }}
                >
                  {c.completePath || c.name}
                </button>
              </li>
            ))}
            {showCreate && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-start text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20"
                  disabled={createMut.isPending}
                  onClick={() => createMut.mutate(q.trim())}
                >
                  {ar ? `إنشاء «${q.trim()}»` : `Create "${q.trim()}"`}
                  {selected ? (ar ? ` تحت ${selected.name}` : ` under ${selected.name}`) : ''}
                </button>
              </li>
            )}
            {!filtered.length && !showCreate && !showHints && (
              <li className="px-3 py-2 text-slate-400">
                {ar ? 'لا فئات' : 'No categories'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
