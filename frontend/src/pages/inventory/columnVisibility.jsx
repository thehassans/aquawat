import { useEffect, useMemo, useRef, useState } from 'react'
import { Columns3, Check } from 'lucide-react'
import { PortalDropdown } from './PortalDropdown'

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

/**
 * Column chooser — portaled popover anchored bottom-start of the trigger
 * so it never clips inside overflow-x-auto table toolbars or shifts layout.
 */
export function ColumnChooser({ ar, definitions, visible, onToggle }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-dark-600 dark:bg-dark-800 dark:hover:bg-dark-700"
        onClick={() => setOpen((v) => !v)}
        title={ar ? 'الأعمدة' : 'Columns'}
        aria-label={ar ? 'اختيار الأعمدة' : 'Choose columns'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Columns3 className="h-4 w-4" />
      </button>
      <PortalDropdown
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="start"
        className="w-56 !border-0 p-1 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/5"
      >
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {ar ? 'إظهار الأعمدة' : 'Show columns'}
        </p>
        {definitions.map((col) => {
          const on = visible[col.id] !== false
          return (
            <button
              key={col.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={on}
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
      </PortalDropdown>
    </>
  )
}
