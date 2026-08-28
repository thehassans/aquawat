import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { sectionCardClass, softChipClass } from '../../pages/sales/salesUi'

/**
 * Collapses 12+ customer address/VAT fields into a compact summary after selection.
 */
export default function CustomerSummaryCard({ customer, language = 'en', onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const isAr = language === 'ar'

  const name = customer?.name || customer?.nameEn || customer?.nameAr || '—'
  const vat = customer?.vatNumber || customer?.taxId || ''
  const cr = customer?.crNumber || ''
  const phone = customer?.phone || customer?.mobile || ''
  const email = customer?.email || ''
  const address = useMemo(() => {
    const a = customer?.address || {}
    return [a.street, a.buildingNumber, a.district, a.city, a.postalCode, a.country]
      .filter(Boolean)
      .join(', ')
  }, [customer])

  if (!customer?._id && !customer?.name) return null

  return (
    <div className={`${sectionCardClass} !p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
            {isAr ? 'العميل' : 'Customer'}
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white">{name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vat ? <span className={softChipClass}>VAT {vat}</span> : null}
            {cr ? <span className={softChipClass}>CR {cr}</span> : null}
            {phone ? <span className={softChipClass}>{phone}</span> : null}
          </div>
          {!expanded && address ? (
            <p className="mt-2 truncate text-sm text-slate-500">{address}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {onEdit ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              {isAr ? 'تعديل' : 'Edit'}
            </button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm dark:border-dark-600 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Email</dt><dd className="font-medium">{email || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">Phone</dt><dd className="font-medium">{phone || '—'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Address</dt><dd className="font-medium">{address || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">VAT</dt><dd className="font-medium">{vat || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">CR</dt><dd className="font-medium">{cr || '—'}</dd></div>
        </dl>
      ) : null}
    </div>
  )
}
