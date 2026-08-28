import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, ChevronDown, Plus, UserRound } from 'lucide-react'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'
import { buildFullFormUrl } from '../../lib/partnerDefaults'
import { primaryBtnClass } from '../../pages/contacts/contactsUi'

function buildCreateItems({ returnTo, showEmployee, isAr }) {
  const items = [
    {
      id: 'customer',
      href: buildFullFormUrl({ role: 'customer', entity: 'company', returnTo }),
      icon: Building2,
      labelEn: 'Customer',
      labelAr: 'عميل',
      hintEn: 'Sales invoices, quotations & receivables',
      hintAr: 'فواتير المبيعات وعروض الأسعار والذمم المدينة',
    },
    {
      id: 'vendor',
      href: buildFullFormUrl({ role: 'vendor', entity: 'company', returnTo }),
      icon: Briefcase,
      labelEn: 'Vendor',
      labelAr: 'مورد',
      hintEn: 'Purchase bills, POs & payables',
      hintAr: 'فواتير المشتريات وأوامر الشراء والذمم الدائنة',
    },
    {
      id: 'individual',
      href: buildFullFormUrl({ role: 'customer', entity: 'individual', returnTo }),
      icon: UserRound,
      labelEn: 'Individual',
      labelAr: 'فرد',
      hintEn: 'Contact person or B2C partner',
      hintAr: 'شخص أو عميل فردي — يمكن ربطه بشركة',
    },
  ]

  if (showEmployee) {
    items.push({
      id: 'employee',
      href: buildFullFormUrl({ role: 'employee', entity: 'individual', returnTo }),
      icon: UserRound,
      labelEn: 'Employee',
      labelAr: 'موظف',
      hintEn: 'Staff partner for HR & payroll',
      hintAr: 'شريك موظف للموارد البشرية والرواتب',
    })
  }

  return items
}

export default function ContactsCreateMenu({
  language = 'en',
  returnTo = '/app/dashboard/contacts?types=customer,supplier',
  showEmployee = true,
  className = '',
}) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const isAr = language === 'ar'
  const items = buildCreateItems({ returnTo, showEmployee, isAr })

  useEffect(() => {
    setOpen(false)
  }, [language, returnTo])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`${primaryBtnClass} ${className}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4" />
        {isAr ? 'إنشاء' : 'Create'}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="end">
        <div className="min-w-[17rem] py-1">
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'شريك جديد' : 'New partner'}
          </div>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-dark-700"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    {isAr ? item.labelAr : item.labelEn}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {isAr ? item.hintAr : item.hintEn}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </PortalDropdown>
    </div>
  )
}
