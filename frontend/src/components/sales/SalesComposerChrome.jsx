import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ArrowLeft, FileClock, FileText, Package, Receipt, ShoppingCart } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'

const CREATE_ACTIONS = [
  {
    id: 'invoice',
    match: (p, s = '') => p.includes('/invoices/new/sell') && !String(s).includes('proforma=1'),
    href: '/app/dashboard/invoices/new/sell',
    icon: Receipt,
    labelEn: 'Invoice',
    labelAr: 'فاتورة',
    gradient: 'from-rose-500 to-orange-400',
    ring: 'ring-rose-500/30',
  },
  {
    id: 'proforma',
    match: (p, s) => p.includes('/invoices/new/sell') && s.includes('proforma=1'),
    href: '/app/dashboard/invoices/new/sell?proforma=1',
    icon: FileClock,
    labelEn: 'Proforma',
    labelAr: 'مبدئية',
    gradient: 'from-violet-500 to-fuchsia-400',
    ring: 'ring-violet-500/30',
    gate: (types) => types.some((t) => ['trading', 'construction', 'manpower', 'travel_agency', 'real_estate'].includes(t)),
  },
  {
    id: 'quotation',
    match: (p) => p.includes('/quotations/new') || /\/quotations\/[^/]+\/edit/.test(p),
    href: '/app/dashboard/quotations/new',
    icon: FileText,
    labelEn: 'Quote',
    labelAr: 'عرض',
    gradient: 'from-sky-500 to-cyan-400',
    ring: 'ring-sky-500/30',
    gate: (types) => !types.includes('bakala'),
  },
  {
    id: 'order',
    match: (p) => p.includes('/sales/orders/new'),
    href: '/app/dashboard/sales/orders/new',
    icon: ShoppingCart,
    labelEn: 'Order',
    labelAr: 'طلب',
    gradient: 'from-emerald-500 to-teal-400',
    ring: 'ring-emerald-500/30',
  },
  {
    id: 'purchase',
    match: (p) => p.includes('/invoices/new/purchase'),
    href: '/app/dashboard/invoices/new/purchase',
    icon: Package,
    labelEn: 'Purchase',
    labelAr: 'شراء',
    gradient: 'from-amber-500 to-yellow-400',
    ring: 'ring-amber-500/30',
    gate: (types) => types.some((t) =>
      ['trading', 'construction', 'travel_agency', 'bakala', 'pharmacy', 'furniture_shop', 'supermarket'].includes(t)),
  },
]

function backHref(pathname) {
  if (pathname.includes('/quotations')) return '/app/dashboard/quotations'
  if (pathname.includes('/sales/orders')) return '/app/dashboard/sales/orders'
  if (pathname.includes('/purchase')) return '/app/dashboard/invoices'
  return '/app/dashboard/invoices'
}

function titleFor(pathname, search, isAr) {
  if (pathname.includes('/sales/orders')) return isAr ? 'أمر بيع جديد' : 'New sales order'
  if (pathname.includes('/quotations')) {
    if (pathname.includes('/edit')) return isAr ? 'تعديل عرض السعر' : 'Edit quotation'
    return isAr ? 'عرض سعر جديد' : 'New quotation'
  }
  if (pathname.includes('/purchase')) return isAr ? 'فاتورة مشتريات' : 'New purchase invoice'
  if (search.includes('proforma=1')) return isAr ? 'فاتورة مبدئية' : 'New proforma'
  if (pathname.includes('/edit')) return isAr ? 'تعديل الفاتورة' : 'Edit invoice'
  return isAr ? 'فاتورة مبيعات جديدة' : 'New sales invoice'
}

/**
 * Minimal create-mode top bar: back + colorful document type icons.
 */
export default function SalesComposerChrome({ pathname, search = '' }) {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const types = getTenantBusinessTypes(tenant)

  const actions = CREATE_ACTIONS.filter((a) => !a.gate || a.gate(types))
  const activeId = actions.find((a) => a.match(pathname, search))?.id

  return (
    <div className="relative z-[30] border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-dark-600 dark:bg-dark-900/90">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(backHref(pathname))}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
          aria-label={isAr ? 'رجوع' : 'Back'}
        >
          <ArrowLeft className={`h-4.5 w-4.5 ${isAr ? 'rotate-180' : ''}`} strokeWidth={1.75} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {titleFor(pathname, search, isAr)}
          </p>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label={isAr ? 'إنشاء مستند' : 'Create document'}>
          {actions.map((action) => {
            const Icon = action.icon
            const active = action.id === activeId
            return (
              <Link
                key={action.id}
                to={action.href}
                title={isAr ? action.labelAr : action.labelEn}
                className={`group relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                  active
                    ? `bg-gradient-to-br ${action.gradient} text-white shadow-lg ring-2 ${action.ring} ring-offset-2 ring-offset-white dark:ring-offset-dark-900`
                    : 'border border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-dark-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                <span className="pointer-events-none absolute -bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-slate-400 opacity-0 transition group-hover:opacity-100 sm:block">
                  {isAr ? action.labelAr : action.labelEn}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export function isSalesComposerPath(pathname = '') {
  if (/\/invoices\/new(\/|$)/.test(pathname)) return true
  if (/\/invoices\/[^/]+\/edit/.test(pathname)) return true
  if (/\/quotations\/new(\/|$)/.test(pathname)) return true
  if (/\/quotations\/[^/]+\/edit/.test(pathname)) return true
  if (/\/sales\/orders\/new(\/|$)/.test(pathname)) return true
  return false
}
