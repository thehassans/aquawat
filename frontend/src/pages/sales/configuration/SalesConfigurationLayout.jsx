import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { salesTabClass, pageSubtitleClass, pageTitleClass, sectionEyebrowClass } from '../salesUi'
import { SALES_CONFIG_SECTIONS } from '../salesConfig.menu'

export default function SalesConfigurationLayout() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const location = useLocation()

  return (
    <div className="space-y-6">
      <div>
        <p className={sectionEyebrowClass}>{isAr ? 'البنية التحتية' : 'Phase 1 infrastructure'}</p>
        <h1 className={pageTitleClass}>{isAr ? 'إعدادات المبيعات' : 'Sales Configuration'}</h1>
        <p className={pageSubtitleClass}>
          {isAr
            ? 'إعدادات المستندات، الترويسة، الفرق، الأسعار والمدفوعات'
            : 'Document settings, letterhead, teams, pricing, and payments'}
        </p>
      </div>

      <div className="overflow-x-auto border-b border-slate-200/90 dark:border-dark-600">
        <nav className="flex min-w-max items-center gap-1">
          {SALES_CONFIG_SECTIONS.map((item) => {
            const active = location.pathname.startsWith(item.href)
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
