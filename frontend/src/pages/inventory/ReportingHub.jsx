import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { INVENTORY_PATH } from './inventoryUi'

const SUB = [
  { to: INVENTORY_PATH.stockReport, en: 'Stock', ar: 'المخزون' },
  { to: INVENTORY_PATH.locationsReport, en: 'Locations', ar: 'المواقع' },
  { to: INVENTORY_PATH.forecastReport, en: 'Forecasted', ar: 'المتوقع' },
  { to: INVENTORY_PATH.movesHistory, en: 'Moves History', ar: 'سجل الحركات' },
  { to: INVENTORY_PATH.movesAnalysis, en: 'Moves Analysis', ar: 'تحليل الحركات' },
  { to: INVENTORY_PATH.performance, en: 'Performance', ar: 'الأداء' },
]

export default function ReportingHub() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5 dark:border-white/10 dark:bg-white/[0.03]">
        {SUB.map((tab) => {
          const active = pathname.startsWith(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
                active
                  ? 'bg-white text-teal-800 shadow-sm dark:bg-teal-500/15 dark:text-teal-200'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              {isAr ? tab.ar : tab.en}
            </Link>
          )
        })}
      </nav>
      <Outlet />
    </div>
  )
}
