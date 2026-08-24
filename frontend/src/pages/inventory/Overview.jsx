import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Package, Truck, ArrowRightLeft, Clock, CheckCircle2 } from 'lucide-react'
import api from '../../lib/api'
import { INVENTORY_PATH, ghostBtn, primaryBtn, opTypeLabel } from './inventoryUi'

const CODE_ICONS = {
  incoming: Package,
  outgoing: Truck,
  internal: ArrowRightLeft,
}

const CODE_PATHS = {
  incoming: { list: INVENTORY_PATH.receipts, new: INVENTORY_PATH.receiptNew },
  outgoing: { list: INVENTORY_PATH.deliveries, new: INVENTORY_PATH.deliveryNew },
  internal: { list: INVENTORY_PATH.internal, new: INVENTORY_PATH.internalNew },
}

export default function InventoryOverview() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  const { data, isLoading } = useQuery({
    queryKey: ['stock-overview'],
    queryFn: () => api.get('/stock/dashboard/overview').then((r) => r.data),
  })

  const cards = data?.cards || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'نظرة عامة على المخزون' : 'Inventory Overview'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isAr ? 'عمليات الاستلام والتسليم والتحويل' : 'Receipts, deliveries, and internal transfers'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-40 animate-pulse bg-slate-100 dark:bg-dark-700" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ operationType, counts }) => {
            const code = operationType?.code || 'internal'
            const Icon = CODE_ICONS[code] || Package
            const paths = CODE_PATHS[code] || CODE_PATHS.internal
            return (
              <div key={operationType._id} className="card p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {operationType.name || opTypeLabel(code, language)}
                      </h3>
                      <p className="text-xs text-slate-500">{operationType.sequencePrefix}</p>
                    </div>
                  </div>
                  <Link to={paths.new} className={primaryBtn}>
                    {isAr ? 'فتح' : 'Open'}
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <Link to={`${paths.list}?state=assigned`} className="rounded-xl bg-emerald-50 py-2 dark:bg-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300">{counts.ready}</div>
                    <div className="text-xs text-emerald-600">{isAr ? 'جاهز' : 'Ready'}</div>
                  </Link>
                  <Link to={`${paths.list}?state=waiting`} className="rounded-xl bg-amber-50 py-2 dark:bg-amber-500/10">
                    <Clock className="w-4 h-4 mx-auto text-amber-600 mb-1" />
                    <div className="font-semibold text-amber-800 dark:text-amber-300">{counts.waiting}</div>
                    <div className="text-xs text-amber-600">{isAr ? 'انتظار' : 'Waiting'}</div>
                  </Link>
                  <Link to={`${paths.list}?filter=late`} className="rounded-xl bg-rose-50 py-2 dark:bg-rose-500/10">
                    <div className="font-semibold text-rose-800 dark:text-rose-300">{counts.late}</div>
                    <div className="text-xs text-rose-600">{isAr ? 'متأخر' : 'Late'}</div>
                  </Link>
                </div>

                <Link to={paths.list} className={`${ghostBtn} justify-center w-full`}>
                  {isAr ? 'عرض الكل' : 'View all'}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
