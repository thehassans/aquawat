import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronDown, X } from 'lucide-react'

/**
 * Reusable async combobox with debounced search (default 300ms).
 * Supports emptyActions footer when search returns zero results.
 */
export default function AsyncCombobox({
  value,
  selectedOption = null,
  onChange,
  fetchOptions,
  queryKeyPrefix = 'async-combobox',
  getOptionLabel = (o) => o?.name || o?.label || '—',
  getOptionSub = (o) => o?.sub || o?.email || o?.phone || '',
  placeholder = 'Search…',
  noResultsText = 'No results found',
  disabled = false,
  debounceMs = 300,
  minChars = 2,
  className = '',
  emptyActions = null,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState(selectedOption)

  useEffect(() => {
    setPicked(selectedOption)
  }, [selectedOption?._id, value])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), debounceMs)
    return () => clearTimeout(t)
  }, [term, debounceMs])

  // Only listen while open — one listener per open combobox, not per mounted row
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const enabled = open && debounced.length >= minChars && typeof fetchOptions === 'function'

  const { data: options = [], isFetching, isError } = useQuery({
    queryKey: [queryKeyPrefix, debounced],
    queryFn: async () => {
      try {
        const rows = await fetchOptions(debounced)
        return Array.isArray(rows) ? rows : []
      } catch {
        return []
      }
    },
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: false,
  })

  const deferredOptions = useDeferredValue(options)

  const displayValue = useMemo(() => {
    if (open) return term
    if (picked) return getOptionLabel(picked)
    if (selectedOption) return getOptionLabel(selectedOption)
    return ''
  }, [open, term, picked, selectedOption, getOptionLabel])

  const select = (opt) => {
    setPicked(opt)
    setTerm('')
    setOpen(false)
    try {
      const result = onChange?.(opt?._id || '', opt)
      Promise.resolve(result).catch(() => {})
    } catch {
      /* ignore sync handler errors */
    }
  }

  const clear = (e) => {
    e.stopPropagation()
    setPicked(null)
    setTerm('')
    try {
      const result = onChange?.('', null)
      Promise.resolve(result).catch(() => {})
    } catch {
      /* ignore */
    }
  }

  const showEmptyActions = Boolean(
    emptyActions
    && debounced.length >= minChars
    && !isFetching
    && !isError
    && deferredOptions.length === 0,
  )

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          className="input w-full pe-16"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            setTerm(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && deferredOptions[0]) {
              e.preventDefault()
              select(deferredOptions[0])
            }
          }}
        />
        <div className="pointer-events-none absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {(value || picked) && !disabled ? (
            <button
              type="button"
              className="pointer-events-auto rounded p-0.5 text-slate-400 hover:text-slate-700"
              onClick={clear}
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800"
        >
          {debounced.length < minChars ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              Type at least {minChars} characters…
            </p>
          ) : isError ? (
            <p className="px-3 py-2 text-xs text-rose-600">Search failed</p>
          ) : isFetching && deferredOptions.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : deferredOptions.length === 0 ? (
            <>
              <p className="px-3 py-2 text-xs text-slate-400">{noResultsText}</p>
              {showEmptyActions
                ? (typeof emptyActions === 'function'
                  ? emptyActions({ query: debounced, close: () => setOpen(false) })
                  : emptyActions)
                : null}
            </>
          ) : (
            deferredOptions.map((opt) => {
              const active = String(opt._id) === String(value)
              return (
                <button
                  key={opt._id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-dark-700 ${
                    active ? 'bg-sky-50 dark:bg-sky-950/30' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(opt)}
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {getOptionLabel(opt)}
                  </span>
                  {getOptionSub(opt) ? (
                    <span className="text-[11px] text-slate-400">{getOptionSub(opt)}</span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
