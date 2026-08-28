import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { salesTabClass, pageSubtitleClass, pageTitleClass, sectionEyebrowClass } from '../salesUi'
import { SALES_REPORT_SECTIONS } from '../salesConfig.menu'

export default function SalesReportingLayout() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const location = useLocation()

  return (
    <div className="space-y-6">
      <div>
        <p className={sectionEyebrowClass}>{isAr ? 'ذكاء الأعمال' : 'Phase 6 analytics'}</p>
        <h1 className={pageTitleClass}>{isAr ? 'تقارير المبيعات' : 'Sales Reporting'}</h1>
        <p className={pageSubtitleClass}>
          {isAr ? 'تحليلات تفاعلية ومصفوفات الأداء' : 'Interactive charts, KPIs, and matrix pivots'}
        </p>
      </div>

      <div className="overflow-x-auto border-b border-slate-200/90 dark:border-dark-600">
        <nav className="flex min-w-max items-center gap-1">
          {SALES_REPORT_SECTIONS.map((item) => {
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
