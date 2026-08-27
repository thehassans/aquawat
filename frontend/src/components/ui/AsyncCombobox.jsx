import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronDown, X } from 'lucide-react'

/**
 * Reusable async combobox with debounced search (default 300ms).
 * Uses React Query for caching / deduping identical searches.
 *
 * @param {object} props
 * @param {string|null} props.value - selected option id
 * @param {object|null} [props.selectedOption] - optional preloaded selected row { _id, label, … }
 * @param {(id: string, option: object|null) => void} props.onChange
 * @param {(q: string) => Promise<object[]>} props.fetchOptions - async search fn
 * @param {string} [props.queryKeyPrefix='async-combobox']
 * @param {(opt: object) => string} [props.getOptionLabel]
 * @param {(opt: object) => string} [props.getOptionSub]
 * @param {string} [props.placeholder]
 * @param {string} [props.noResultsText]
 * @param {boolean} [props.disabled]
 * @param {number} [props.debounceMs=300]
 * @param {number} [props.minChars=2]
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

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const enabled = open && debounced.length >= minChars && typeof fetchOptions === 'function'

  const { data: options = [], isFetching, isError } = useQuery({
    queryKey: [queryKeyPrefix, debounced],
    queryFn: () => fetchOptions(debounced),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

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
    onChange?.(opt?._id || '', opt)
  }

  const clear = (e) => {
    e.stopPropagation()
    setPicked(null)
    setTerm('')
    onChange?.('', null)
  }

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
            if (e.key === 'Enter' && options[0]) {
              e.preventDefault()
              select(options[0])
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
          className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800"
        >
          {debounced.length < minChars ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              Type at least {minChars} characters…
            </p>
          ) : isError ? (
            <p className="px-3 py-2 text-xs text-rose-600">Search failed</p>
          ) : isFetching && options.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">{noResultsText}</p>
          ) : (
            options.map((opt) => {
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
