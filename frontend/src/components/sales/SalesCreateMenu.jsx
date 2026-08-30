import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, FileText, Plus, ShoppingCart, Users } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'

function buildCreateItems({ hideQuotations }) {
  const items = []

  if (!hideQuotations) {
    items.push({
      id: 'quotation',
      href: '/app/dashboard/quotations/new',
      icon: FileText,
      labelEn: 'Quotation',
      labelAr: 'عرض سعر',
    })
  }

  items.push({
    id: 'sales-order',
    href: '/app/dashboard/sales/orders/new',
    icon: ShoppingCart,
    labelEn: 'Sale Order',
    labelAr: 'أمر بيع',
  })

  items.push({
    id: 'customer',
    href: '/app/dashboard/sales/customers/new',
    icon: Users,
    labelEn: 'Customer',
    labelAr: 'عميل',
  })

  return items
}

const triggerClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-100 dark:hover:bg-dark-700'

export default function SalesCreateMenu({
  language = 'en',
  labelEn = 'Create',
  labelAr = 'إنشاء',
  className = '',
}) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const { tenant } = useSelector((state) => state.auth)
  const isAr = language === 'ar'
  const businessTypes = getTenantBusinessTypes(tenant)
  const hideQuotations = businessTypes.includes('bakala')
  const items = buildCreateItems({ hideQuotations })

  useEffect(() => {
    setOpen(false)
  }, [language])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`${triggerClass} ${className}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
        {isAr ? labelAr : labelEn}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="end">
        <div className="min-w-[220px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-dark-700"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              </Link>
            )
          })}
        </div>
      </PortalDropdown>
    </div>
  )
}
