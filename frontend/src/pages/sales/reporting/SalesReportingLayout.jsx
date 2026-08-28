import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { BarChart3 } from 'lucide-react'
import { salesTabClass, pageTitleClass, pageSubtitleClass } from '../salesUi'
import { SALES_REPORT_SECTIONS } from '../salesConfig.menu'

export default function SalesReportingLayout() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const location = useLocation()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className={pageTitleClass}>{isAr ? 'تقارير المبيعات' : 'Sales Reporting'}</h1>
            <p className={pageSubtitleClass}>{isAr ? 'تحليلات تفاعلية ومؤشرات الأداء' : 'Interactive analytics and KPIs'}</p>
          </div>
        </div>
        <Link to="/app/dashboard/invoices" className="text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-300">
          {isAr ? '← العودة للمبيعات' : '← Back to Sales'}
        </Link>
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
