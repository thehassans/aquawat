import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Menu, ShoppingCart, X } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { salesPageShellClass, sectionEyebrowClass } from './salesUi'
import SalesComposerChrome, { isSalesComposerPath } from '../../components/sales/SalesComposerChrome'
import SalesNavDropdown from '../../components/sales/SalesNavDropdown'
import { SALES_CONFIG_SECTIONS, SALES_REPORT_SECTIONS } from './salesConfig.menu'

export default function SalesLayout() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const businessTypes = getTenantBusinessTypes(tenant)
  const hideQuotations = businessTypes.includes('bakala')
  const isAr = language === 'ar'
  const composerMode = isSalesComposerPath(location.pathname)
  const path = location.pathname

  const hubs = [
    {
      id: 'overview',
      href: '/app/dashboard/sales',
      labelEn: 'Overview',
      labelAr: 'نظرة عامة',
      exact: true,
      items: [],
    },
    ...(hideQuotations
      ? []
      : [{
          id: 'quotations',
          href: '/app/dashboard/quotations',
          labelEn: 'Quotations',
          labelAr: 'عروض الأسعار',
          items: [
            { href: '/app/dashboard/quotations', labelEn: 'All quotations', labelAr: 'كل العروض' },
            { href: '/app/dashboard/quotations/new', labelEn: 'New quotation', labelAr: 'عرض جديد' },
          ],
        }]),
    {
      id: 'orders',
      href: '/app/dashboard/sales/orders',
      labelEn: 'Sale orders',
      labelAr: 'أوامر البيع',
      items: [
        { href: '/app/dashboard/sales/orders', labelEn: 'All orders', labelAr: 'كل الأوامر' },
      ],
    },
    {
      id: 'teams',
      href: '/app/dashboard/sales/teams',
      labelEn: 'Sales team',
      labelAr: 'فريق المبيعات',
      items: [
        { href: '/app/dashboard/sales/teams', labelEn: 'All teams', labelAr: 'كل الفرق' },
        { href: '/app/dashboard/sales/configuration/teams', labelEn: 'Manage in settings', labelAr: 'إدارة من الإعدادات' },
      ],
    },
    {
      id: 'customers',
      href: '/app/dashboard/sales/customers',
      labelEn: 'Customers',
      labelAr: 'العملاء',
      items: [
        { href: '/app/dashboard/sales/customers', labelEn: 'All customers', labelAr: 'كل العملاء' },
        { href: '/app/dashboard/sales/customers/new', labelEn: 'New customer', labelAr: 'عميل جديد' },
      ],
    },
    {
      id: 'configuration',
      href: '/app/dashboard/sales/configuration',
      labelEn: 'Configuration',
      labelAr: 'الإعدادات',
      items: SALES_CONFIG_SECTIONS.map((s) => ({
        href: s.href,
        labelEn: s.label,
        labelAr: s.labelAr,
      })),
    },
    {
      id: 'reporting',
      href: '/app/dashboard/sales/reporting',
      labelEn: 'Reporting',
      labelAr: 'التقارير',
      items: SALES_REPORT_SECTIONS.map((s) => ({
        href: s.href,
        labelEn: s.label,
        labelAr: s.labelAr,
      })),
    },
  ]

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const isActiveHub = (hub) => {
    if (hub.exact) return path === hub.href || path === `${hub.href}/`
    if (hub.id === 'quotations') return path.includes('/quotations')
    if (hub.id === 'orders') return path.includes('/sales/orders')
    if (hub.id === 'teams') return path.includes('/sales/teams') || path.includes('/sales/configuration/teams')
    if (hub.id === 'customers') return path.includes('/sales/customers') || (path.includes('/customers') && !path.includes('/reporting/customers'))
    if (hub.id === 'configuration') return path.includes('/sales/configuration')
    if (hub.id === 'reporting') return path.includes('/sales/reporting')
    return false
  }

  return (
    <div className={salesPageShellClass}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(15,23,42,0.06),_transparent_55%),linear-gradient(180deg,rgba(248,250,252,0.95),transparent)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.04),_transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.55),transparent)]"
      />

      {composerMode ? (
        <SalesComposerChrome pathname={location.pathname} search={location.search} />
      ) : (
        <div className="relative z-10 border-b border-slate-200/90 bg-white/90 backdrop-blur-md dark:border-dark-600 dark:bg-dark-900/90">
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-0 pt-4 sm:px-6">
            <div className="flex items-center gap-3 pb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-dark-800 dark:text-slate-200">
                <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className={sectionEyebrowClass}>{isAr ? 'محرك المبيعات والتوريد' : 'Sales & Fulfillment'}</p>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {isAr ? 'المبيعات' : 'Maqder Sales'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm lg:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                {isAr ? 'القائمة' : 'Menu'}
              </button>

              <nav className="hidden items-center gap-1 lg:flex">
                {hubs.map((hub) => (
                  <SalesNavDropdown
                    key={hub.id}
                    href={hub.href}
                    label={isAr ? hub.labelAr : hub.labelEn}
                    active={isActiveHub(hub)}
                    items={hub.items}
                    isAr={isAr}
                  />
                ))}
              </nav>
            </div>
          </div>

          {mobileOpen && (
            <div className="border-t border-slate-100 px-4 py-3 lg:hidden dark:border-dark-600">
              <nav className="flex flex-col gap-1">
                {hubs.map((hub) => (
                  <div key={hub.id} className="space-y-0.5">
                    <Link
                      to={hub.href}
                      className={`block rounded-xl px-3 py-2.5 text-sm font-semibold ${
                        isActiveHub(hub)
                          ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isAr ? hub.labelAr : hub.labelEn}
                    </Link>
                    {(hub.items || []).map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="block rounded-lg px-5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-800"
                      >
                        {isAr ? item.labelAr : item.labelEn}
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
            </div>
          )}
        </div>
      )}

      <div className={`relative z-[1] flex-1 overflow-y-auto px-4 sm:px-6 ${composerMode ? 'py-4' : 'py-6'}`}>
        <Outlet />
      </div>
    </div>
  )
}
