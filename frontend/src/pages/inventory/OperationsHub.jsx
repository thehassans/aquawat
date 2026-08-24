import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { INVENTORY_PATH } from './inventoryUi'

const SUB = [
  { to: INVENTORY_PATH.receipts, en: 'Receipts', ar: 'استلام' },
  { to: INVENTORY_PATH.deliveries, en: 'Deliveries', ar: 'تسليم' },
  { to: INVENTORY_PATH.internal, en: 'Internal Transfers', ar: 'تحويل داخلي' },
  { to: INVENTORY_PATH.physicalInventory, en: 'Physical Inventory', ar: 'جرد' },
  { to: INVENTORY_PATH.scrap, en: 'Scrap', ar: 'هالك' },
  { to: INVENTORY_PATH.replenishment, en: 'Replenishment', ar: 'إعادة التوريد' },
  { to: INVENTORY_PATH.procurementGroups, en: 'Procurement Groups', ar: 'مجموعات التوريد' },
  { to: INVENTORY_PATH.landedCosts, en: 'Landed Costs', ar: 'التكاليف المرسية' },
]

export default function OperationsHub() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'

  // If we're at a nested form/list that has its own h1, still show subnav
  const showOutletOnly = pathname.includes('/pickings/') || pathname.endsWith('/new')

  return (
    <div className="space-y-4">
      {!showOutletOnly && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-dark-600 pb-2">
          {SUB.map((tab) => {
            const active = pathname.startsWith(tab.to)
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`px-3 py-1.5 text-sm rounded-lg ${active ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/10' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {isAr ? tab.ar : tab.en}
              </Link>
            )
          })}
        </div>
      )}
      <Outlet />
    </div>
  )
}
