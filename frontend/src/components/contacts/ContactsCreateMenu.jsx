import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, ChevronDown, Plus, UserRound } from 'lucide-react'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'
import { buildFullFormUrl } from '../../lib/partnerDefaults'

function buildCreateItems({ returnTo, showEmployee }) {
  const items = [
    {
      id: 'customer',
      href: buildFullFormUrl({ role: 'customer', entity: 'company', returnTo }),
      icon: Building2,
      labelEn: 'Customer',
      labelAr: 'عميل',
    },
    {
      id: 'vendor',
      href: buildFullFormUrl({ role: 'vendor', entity: 'company', returnTo }),
      icon: Briefcase,
      labelEn: 'Vendor',
      labelAr: 'مورد',
    },
    {
      id: 'individual',
      href: buildFullFormUrl({ role: 'customer', entity: 'individual', returnTo }),
      icon: UserRound,
      labelEn: 'Individual',
      labelAr: 'فرد',
    },
  ]

  if (showEmployee) {
    items.push({
      id: 'employee',
      href: buildFullFormUrl({ role: 'employee', entity: 'individual', returnTo }),
      icon: UserRound,
      labelEn: 'Employee',
      labelAr: 'موظف',
    })
  }

  return items
}

/** Ultra-minimal Create — quiet text trigger; options only, no hints. */
export default function ContactsCreateMenu({
  language = 'en',
  returnTo = '/app/dashboard/contacts?types=customer,supplier',
  showEmployee = true,
  className = '',
}) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const isAr = language === 'ar'
  const items = buildCreateItems({ returnTo, showEmployee })

  useEffect(() => {
    setOpen(false)
  }, [language, returnTo])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-dark-700 dark:hover:text-white ${className}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        <span>{isAr ? 'إنشاء' : 'Create'}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="end">
        <div className="min-w-[11rem] py-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-700"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                <span className="font-medium">{isAr ? item.labelAr : item.labelEn}</span>
              </Link>
            )
          })}
        </div>
      </PortalDropdown>
    </div>
  )
}
