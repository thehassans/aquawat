import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { FileText, Menu, X } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { salesTabClass, salesPageShellClass } from './salesUi'
import SalesCreateMenu from '../../components/sales/SalesCreateMenu'

export default function SalesLayout() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const businessTypes = getTenantBusinessTypes(tenant)
  const hideQuotations = businessTypes.includes('bakala')
  const isAr = language === 'ar'

  const tabs = [
    { id: 'invoices', href: '/app/dashboard/invoices', labelEn: 'Invoices', labelAr: 'الفواتير' },
    ...(hideQuotations
      ? []
      : [{ id: 'quotations', href: '/app/dashboard/quotations', labelEn: 'Quotations', labelAr: 'عروض الأسعار' }]),
    { id: 'orders', href: '/app/dashboard/sales/orders', labelEn: 'Sales Orders', labelAr: 'أوامر البيع' },
    { id: 'configuration', href: '/app/dashboard/sales/configuration', labelEn: 'Configuration', labelAr: 'الإعدادات' },
    { id: 'reporting', href: '/app/dashboard/sales/reporting', labelEn: 'Reporting', labelAr: 'التقارير' },
  ]

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const isActiveTab = (href) => {
    if (href.includes('/quotations')) return location.pathname.includes('/quotations')
    if (href.includes('/sales/orders')) return location.pathname.includes('/sales/orders')
    if (href.includes('/sales/configuration')) return location.pathname.includes('/sales/configuration')
    if (href.includes('/sales/reporting')) return location.pathname.includes('/sales/reporting')
    return location.pathname.includes('/invoices')
  }

  return (
    <div className={salesPageShellClass}>
      <div className="relative z-[30] border-b border-slate-200/90 bg-white dark:border-dark-600 dark:bg-dark-900">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-0 pt-3 sm:px-6">
          <div className="flex items-center gap-3 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              <FileText className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {isAr ? 'المبيعات' : 'Sales'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'فواتير وعروض أسعار' : 'Invoices and quotations'}
              </p>
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
                const active = isActiveTab(tab.href)
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
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const active = isActiveTab(tab.href)
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
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <Outlet />
      </div>
    </div>
  )
}
