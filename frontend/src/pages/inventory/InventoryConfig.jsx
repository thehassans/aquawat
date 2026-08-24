import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { INVENTORY_PATH } from './inventoryUi'

const SUB = [
  { to: INVENTORY_PATH.config, en: 'Settings', ar: 'الإعدادات', exact: true },
  { to: INVENTORY_PATH.warehouses, en: 'Warehouses', ar: 'المستودعات' },
  { to: INVENTORY_PATH.routes, en: 'Routes', ar: 'المسارات' },
  { to: INVENTORY_PATH.rules, en: 'Rules', ar: 'القواعد' },
  { to: INVENTORY_PATH.putaway, en: 'Putaway Rules', ar: 'قواعد التخزين' },
  { to: INVENTORY_PATH.barcodes, en: 'Barcodes', ar: 'الباركود' },
]

export default function InventoryConfig() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isAr ? 'الإعدادات' : 'Configuration'}</h1>
      <div className="flex gap-2 border-b border-slate-200 dark:border-dark-600 pb-2 overflow-x-auto">
        {SUB.map((tab) => {
          const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
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
