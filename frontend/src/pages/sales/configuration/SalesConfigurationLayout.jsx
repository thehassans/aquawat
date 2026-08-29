import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { getTenantBusinessTypes } from '../../../lib/businessTypes'
import { salesTabClass, pageSubtitleClass, pageTitleClass, sectionEyebrowClass } from '../salesUi'
import { SALES_CONFIG_SECTIONS } from '../salesConfig.menu'

export default function SalesConfigurationLayout() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const location = useLocation()
  const businessTypes = getTenantBusinessTypes(tenant)
  const hasRestaurant = businessTypes.includes('restaurant')

  const sections = SALES_CONFIG_SECTIONS.filter((item) => {
    if (item.requireRestaurant && !hasRestaurant) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <p className={sectionEyebrowClass}>{isAr ? 'البنية التحتية' : 'Sales infrastructure'}</p>
        <h1 className={pageTitleClass}>{isAr ? 'إعدادات المبيعات' : 'Sales Configuration'}</h1>
        <p className={pageSubtitleClass}>
          {isAr ? 'فرق، كتالوج، أسعار، ومدفوعات' : 'Teams, catalog, pricing, and payments'}
        </p>
      </div>

      <div className="overflow-x-auto border-b border-slate-200/90 dark:border-dark-600">
        <nav className="flex min-w-max items-center gap-1">
          {sections.map((item) => {
            const active = !item.external && location.pathname.startsWith(item.href)
            if (item.external) {
              return (
                <Link key={item.id} to={item.href} className={salesTabClass(false)}>
                  {isAr ? item.labelAr : item.label}
                </Link>
              )
            }
            return (
              <NavLink key={item.id} to={item.href} className={() => salesTabClass(active)}>
                {isAr ? item.labelAr : item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
