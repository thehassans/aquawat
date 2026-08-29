import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'

/**
 * Compact selected-party chip — no inline address form.
 */
export default function CustomerSummaryCard({ customer, language = 'en', onEdit, onClear }) {
  const [expanded, setExpanded] = useState(false)
  const isAr = language === 'ar'

  const name = customer?.name || customer?.nameEn || customer?.nameAr || '—'
  const vat = customer?.vatNumber || customer?.taxId || ''
  const cr = customer?.crNumber || ''
  const phone = customer?.phone || customer?.mobile || ''
  const email = customer?.email || ''
  const address = useMemo(() => {
    const a = customer?.address || {}
    return [a.shortAddress, a.street, a.buildingNumber, a.district, a.city, a.postalCode, a.country]
      .filter(Boolean)
      .join(', ')
  }, [customer])

  if (!customer?._id && !customer?.name) return null

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white px-3.5 py-3 dark:border-white/10 dark:from-white/[0.04] dark:to-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {[vat && `VAT ${vat}`, cr && `CR ${cr}`, phone].filter(Boolean).join(' · ') || (isAr ? 'بدون تفاصيل إضافية' : 'No extra details')}
          </p>
          {expanded && (email || address) ? (
            <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
              {email ? <p>{email}</p> : null}
              {address ? <p>{address}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-white/10"
            onClick={() => setExpanded((v) => !v)}
            aria-label={isAr ? 'تفاصيل' : 'Details'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {onEdit ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-white/10"
              onClick={onEdit}
              aria-label={isAr ? 'تعديل' : 'Edit'}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-600 dark:hover:bg-white/10"
              onClick={onClear}
              aria-label={isAr ? 'إزالة' : 'Clear'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
