import { useEffect, useMemo, useRef, useState } from 'react'
import { Columns3, Check } from 'lucide-react'

/**
 * Column visibility toggle with localStorage persistence.
 */
export function useColumnVisibility(storageKey, definitions) {
  const defaults = useMemo(
    () => Object.fromEntries(definitions.map((c) => [c.id, c.defaultVisible !== false])),
    [definitions],
  )

  const [visible, setVisible] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return defaults
      const parsed = JSON.parse(raw)
      return { ...defaults, ...parsed }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visible))
    } catch { /* ignore */ }
  }, [storageKey, visible])

  const toggle = (id) => {
    const col = definitions.find((c) => c.id === id)
    if (col?.locked) return
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const activeColumns = definitions.filter((c) => visible[c.id] !== false)

  return { visible, toggle, activeColumns, definitions }
}

export function ColumnChooser({ ar, definitions, visible, onToggle }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-dark-600 dark:bg-dark-800 dark:hover:bg-dark-700"
        onClick={() => setOpen((v) => !v)}
        title={ar ? 'الأعمدة' : 'Columns'}
        aria-label={ar ? 'اختيار الأعمدة' : 'Choose columns'}
      >
        <Columns3 className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {ar ? 'إظهار الأعمدة' : 'Show columns'}
          </p>
          {definitions.map((col) => {
            const on = visible[col.id] !== false
            return (
              <button
                key={col.id}
                type="button"
                disabled={col.locked}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm ${
                  col.locked ? 'cursor-default opacity-60' : 'hover:bg-slate-50 dark:hover:bg-dark-700'
                }`}
                onClick={() => onToggle(col.id)}
              >
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                  on ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 dark:border-dark-500'
                }`}>
                  {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{ar ? col.labelAr : col.labelEn}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
