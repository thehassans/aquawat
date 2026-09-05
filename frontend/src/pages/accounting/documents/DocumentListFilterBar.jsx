import { Search, X } from 'lucide-react'
import {
  fieldControlClass,
  filterBarClass,
  filterControlClass,
  softChipClass,
} from '../../sales/salesUi'

/**
 * Shared inline filter bar for accounting document lists (invoices + bills).
 * chips: [{ id, label, onClear }]
 */
export default function DocumentListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  chips = [],
  onClearAll,
  clearAllLabel = 'Clear filters',
}) {
  const hasChips = chips.length > 0

  return (
    <div className="space-y-2">
      <div className={filterBarClass}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${fieldControlClass} !py-2 ps-10`}
          />
        </div>
        {children}
        {hasChips && onClearAll ? (
          <button type="button" className={`${softChipClass} !px-3`} onClick={onClearAll}>
            {clearAllLabel}
          </button>
        ) : null}
      </div>
      {hasChips ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClear}
              className={`${softChipClass} !gap-1 hover:border-slate-300`}
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export { filterControlClass }
