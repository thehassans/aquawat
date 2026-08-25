import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { INVENTORY_PATH } from './inventoryUi'

const SUB = [
  { to: INVENTORY_PATH.config, en: 'Settings', ar: 'الإعدادات', exact: true },
  { to: INVENTORY_PATH.warehouses, en: 'Warehouses', ar: 'المستودعات' },
  { to: INVENTORY_PATH.locations, en: 'Locations', ar: 'المواقع' },
  { to: INVENTORY_PATH.operationTypes, en: 'Operation Types', ar: 'أنواع العمليات' },
  { to: INVENTORY_PATH.productCategories, en: 'Product Categories', ar: 'فئات المنتجات' },
  { to: INVENTORY_PATH.attributes, en: 'Attributes', ar: 'الخصائص' },
  { to: INVENTORY_PATH.orderpoints, en: 'Reordering Rules', ar: 'قواعد إعادة الطلب' },
  { to: INVENTORY_PATH.routes, en: 'Routes', ar: 'المسارات' },
  { to: INVENTORY_PATH.rules, en: 'Rules', ar: 'القواعد' },
  { to: INVENTORY_PATH.putaway, en: 'Putaway Rules', ar: 'قواعد التخزين' },
  { to: INVENTORY_PATH.storageCategories, en: 'Storage Categories', ar: 'فئات التخزين' },
  { to: INVENTORY_PATH.packageTypes, en: 'Package Types', ar: 'أنواع الطرود' },
  { to: INVENTORY_PATH.uom, en: 'Units of Measure', ar: 'وحدات القياس' },
  { to: INVENTORY_PATH.barcodes, en: 'Barcodes', ar: 'الباركود' },
]

export default function InventoryConfig() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {isAr ? 'الإعدادات' : 'Configuration'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr ? 'المستودعات والمسارات ووحدات القياس' : 'Warehouses, routes, and units of measure'}
        </p>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5 dark:border-white/10 dark:bg-white/[0.03]">
        {SUB.map((tab) => {
          const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
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
