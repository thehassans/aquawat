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
  { to: INVENTORY_PATH.batches, en: 'Batches', ar: 'دفعات التحويل' },
  { to: INVENTORY_PATH.landedCosts, en: 'Landed Costs', ar: 'التكاليف المرسية' },
]

export default function OperationsHub() {
  const { language } = useSelector((state) => state.ui)
  const { pathname } = useLocation()
  const isAr = language === 'ar'
  const showOutletOnly = pathname.includes('/pickings/') || pathname.endsWith('/new')

  return (
    <div className="space-y-6">
      {!showOutletOnly && (
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
      )}
      <Outlet />
    </div>
  )
}
