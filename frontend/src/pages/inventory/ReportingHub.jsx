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
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200 dark:border-dark-600 pb-2 overflow-x-auto">
        {SUB.map((tab) => {
          const active = pathname.startsWith(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap ${active ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/10' : 'text-slate-600'}`}
            >
              {isAr ? tab.ar : tab.en}
            </Link>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
