import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'
import { salesTabClass } from '../../pages/sales/salesUi'

/**
 * Header nav item with optional dropdown children (Sales module hubs).
 */
export default function SalesNavDropdown({
  label,
  href,
  active = false,
  items = [],
  isAr = false,
}) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const hasItems = Array.isArray(items) && items.length > 0

  useEffect(() => {
    setOpen(false)
  }, [href, label])

  if (!hasItems) {
    return (
      <Link to={href} className={salesTabClass(active)}>
        {label}
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`${salesTabClass(active)} inline-flex items-center gap-1`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown className={`h-3 w-3 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="start">
        <div className="min-w-[200px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800">
          {items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-700"
            >
              {isAr ? (item.labelAr || item.labelEn) : (item.labelEn || item.labelAr)}
            </Link>
          ))}
        </div>
      </PortalDropdown>
    </div>
  )
}
