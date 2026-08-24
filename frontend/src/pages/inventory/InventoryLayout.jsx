import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { INVENTORY_PATH } from './inventoryUi'

const TOP_TABS = [
  { to: INVENTORY_PATH.overview, en: 'Overview', ar: 'نظرة عامة' },
  { to: INVENTORY_PATH.receipts, en: 'Operations', ar: 'العمليات', match: '/operations' },
  { to: INVENTORY_PATH.products, en: 'Products', ar: 'المنتجات', match: '/products' },
  { to: INVENTORY_PATH.stockReport, en: 'Reporting', ar: 'التقارير', match: '/reporting' },
  { to: INVENTORY_PATH.config, en: 'Configuration', ar: 'الإعدادات', match: '/configuration' },
]

export default function InventoryLayout() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()

  const isActive = (tab) => {
    if (tab.match) return pathname.includes(tab.match)
    return pathname === tab.to || pathname.startsWith(`${tab.to}/`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0c111a]">
        {TOP_TABS.map((tab) => {
          const active = isActive(tab)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={`rounded-xl px-4 py-2 text-[13px] font-medium transition ${
                active
                  ? 'bg-teal-700 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.04]'
              }`}
            >
              {language === 'ar' ? tab.ar : tab.en}
            </NavLink>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
