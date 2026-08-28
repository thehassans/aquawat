import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Menu, ShoppingCart, X } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { salesTabClass, salesPageShellClass, sectionEyebrowClass } from './salesUi'
import SalesCreateMenu from '../../components/sales/SalesCreateMenu'
import SalesComposerChrome, { isSalesComposerPath } from '../../components/sales/SalesComposerChrome'

export default function SalesLayout() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const businessTypes = getTenantBusinessTypes(tenant)
  const hideQuotations = businessTypes.includes('bakala')
  const isAr = language === 'ar'
  const composerMode = isSalesComposerPath(location.pathname)

  const tabs = [
    { id: 'overview', href: '/app/dashboard/sales', labelEn: 'Overview', labelAr: 'نظرة عامة', exact: true },
    { id: 'orders', href: '/app/dashboard/sales/orders', labelEn: 'Orders', labelAr: 'الطلبات' },
    ...(hideQuotations
      ? []
      : [{ id: 'quotations', href: '/app/dashboard/quotations', labelEn: 'Quotations', labelAr: 'عروض الأسعار' }]),
    { id: 'invoices', href: '/app/dashboard/invoices', labelEn: 'Invoices', labelAr: 'الفواتير' },
    { id: 'configuration', href: '/app/dashboard/sales/configuration', labelEn: 'Configuration', labelAr: 'الإعدادات' },
    { id: 'reporting', href: '/app/dashboard/sales/reporting', labelEn: 'Reporting', labelAr: 'التقارير' },
  ]

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const isActiveTab = (tab) => {
    const href = tab.href
    if (tab.exact) {
      return location.pathname === href || location.pathname === `${href}/`
    }
    if (href.includes('/quotations')) return location.pathname.includes('/quotations')
    if (href.includes('/sales/orders')) return location.pathname.includes('/sales/orders')
    if (href.includes('/sales/configuration')) return location.pathname.includes('/sales/configuration')
    if (href.includes('/sales/reporting')) return location.pathname.includes('/sales/reporting')
    return location.pathname.includes('/invoices')
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
        <div className="relative z-[30] border-b border-slate-200/90 bg-white/90 backdrop-blur-md dark:border-dark-600 dark:bg-dark-900/90">
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
              <div className="hidden lg:block">
                <SalesCreateMenu language={language} labelEn="Create" labelAr="إنشاء" className="btn-sm" />
              </div>
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
                {tabs.map((tab) => {
                  const active = isActiveTab(tab)
                  return (
                    <Link key={tab.id} to={tab.href} className={salesTabClass(active)}>
                      {isAr ? tab.labelAr : tab.labelEn}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>

          {mobileOpen && (
            <div className="border-t border-slate-100 px-4 py-3 lg:hidden dark:border-dark-600">
              <div className="mb-2">
                <SalesCreateMenu language={language} labelEn="Create" labelAr="إنشاء" className="btn-sm w-full justify-center" />
              </div>
              <nav className="flex flex-col gap-1">
                {tabs.map((tab) => {
                  const active = isActiveTab(tab)
                  return (
                    <Link
                      key={tab.id}
                      to={tab.href}
                      className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                        active
                          ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-dark-800'
                      }`}
                    >
                      {isAr ? tab.labelAr : tab.labelEn}
                    </Link>
                  )
                })}
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
