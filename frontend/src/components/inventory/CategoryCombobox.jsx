import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

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

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api.get('/stock/product-categories').then((r) => (Array.isArray(r.data) ? r.data : r.data?.items || [])),
    staleTime: 5 * 60 * 1000,
  })

  const { data: popular = [] } = useQuery({
    queryKey: ['product-categories-popular'],
    queryFn: () => api.get('/stock/product-categories/popular').then((r) => r.data?.items || []).catch(() => []),
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
    return rows.slice(0, 40)
  }, [categories, q])

  const depthOf = (c) => Math.max(0, String(c.completePath || '').split('/').length - 1)

  const createMut = useMutation({
    mutationFn: (name) => api.post('/stock/product-categories', {
      name,
      parentId: selected?._id || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['product-categories'] })
      onChange?.(res.data._id, res.data)
      setQ('')
      setOpen(false)
    },
  })

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const showHints = !q.trim() && popular.length > 0
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
            {(showHints ? popular : []).map((c) => (
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
          </ul>
        </div>
      )}
    </div>
  )
}
