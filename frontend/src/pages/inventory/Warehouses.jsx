import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Warehouse as WarehouseIcon, MapPin, Package, AlertCircle, X, ChevronRight, Loader2, Box, Info } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import ExportMenu from '../../components/ui/ExportMenu'
import Money from '../../components/ui/Money'

function QuickViewDrawer({ warehouseId, warehouseName, onClose, language }) {
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-inventory', warehouseId],
    queryFn: () => api.get(`/warehouses/${warehouseId}/inventory`, { params: { limit: 10 } }).then(res => res.data),
    enabled: Boolean(warehouseId)
  })

  return (
    <AnimatePresence>
      {warehouseId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60"
          />
          <motion.div
            initial={{ x: language === 'ar' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: language === 'ar' ? '-100%' : '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 bottom-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0c111a] ${
              language === 'ar' ? 'left-0 border-r dark:border-r-white/10' : 'right-0 border-l dark:border-l-white/10'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {warehouseName}
                </h3>
                <p className="text-[13px] text-slate-500">
                  {language === 'ar' ? 'أهم الأصناف المتوفرة' : 'Top available items'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (data?.inventory || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 dark:border-white/10">
                  <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-[14px] font-medium text-slate-600 dark:text-slate-300">
                    {language === 'ar' ? 'المستودع فارغ' : 'Warehouse is empty'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(data?.inventory || []).map((item) => (
                    <div
                      key={item.product._id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-[#151b23]">
                          <Box className="h-5 w-5 text-slate-400" />
                        </div>
                        <div className="truncate">
                          <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
                            {language === 'ar' ? item.product.nameAr || item.product.nameEn : item.product.nameEn}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {item.product.sku}
                          </p>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">
                          {item.availableQuantity}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {language === 'ar' ? 'متوفر' : 'Available'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-100 p-5 dark:border-white/10">
              <Link
                to={`/app/dashboard/inventory/products?warehouseId=${warehouseId}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                {language === 'ar' ? 'عرض كل المخزون' : 'View all inventory'}
                <ChevronRight className={`h-4 w-4 ${language === 'ar' ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Warehouses() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [selectedWarehouse, setSelectedWarehouse] = useState(null)

  const exportColumns = [
    { key: 'code', label: language === 'ar' ? 'الرمز' : 'Code', value: (r) => r?.code || '' },
    { key: 'name', label: language === 'ar' ? 'الاسم' : 'Name', value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'type', label: language === 'ar' ? 'النوع' : 'Type', value: (r) => r?.type || '' },
    { key: 'city', label: language === 'ar' ? 'المدينة' : 'City', value: (r) => r?.address?.city || '' },
  ]

  const { data: warehouses, isLoading: loadingWarehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(res => res.data)
  })

  const { data: stockStats } = useQuery({
    queryKey: ['warehouses-stock-stats'],
    queryFn: () => api.get('/warehouses/stock-summary/stats').then(res => res.data)
  })

  const statsMap = (stockStats || []).reduce((acc, curr) => {
    acc[curr._id] = curr;
    return acc;
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
            {language === 'ar' ? 'المخزون' : 'Inventory'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[30px]">
            {t('warehouses')}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'تتبع المخزون في جميع مواقعك بشكل فوري ومباشر.' : 'Track stock across all your locations in real-time.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={warehouses || []}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'المستودعات' : 'Warehouses'}
            title={language === 'ar' ? 'المستودعات' : 'Warehouses'}
            disabled={loadingWarehouses || !(warehouses || []).length}
          />
          <Link to="/app/dashboard/inventory/warehouses/new" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
            <Plus className="h-4 w-4 opacity-80" />
            {language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}
          </Link>
        </div>
      </div>

      {loadingWarehouses ? (
        <div className="flex justify-center p-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-600 dark:border-t-white" />
        </div>
      ) : (warehouses || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <WarehouseIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-[15px] font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'لا توجد مستودعات' : 'No warehouses found'}
          </p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">
            {language === 'ar' ? 'أضف مستودعك الأول للبدء في تتبع المخزون.' : 'Add your first warehouse to start tracking inventory.'}
          </p>
          <Link
            to="/app/dashboard/inventory/warehouses/new"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[13px] font-medium text-white dark:bg-white dark:text-slate-950"
          >
            <Plus className="h-4 w-4" />
            {language === 'ar' ? 'إضافة مستودع' : 'Add Warehouse'}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse) => {
            const stats = statsMap[warehouse._id] || { totalSKUs: 0, totalQuantity: 0, totalValue: 0 }
            const capacity = warehouse.capacity?.totalSpace || 0
            const used = stats.totalQuantity || 0
            const usagePercent = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0
            
            return (
              <motion.div
                key={warehouse._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg dark:border-white/10 dark:bg-[#0c111a]"
              >
                {/* Background Gradient flair */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 transition group-hover:opacity-100 dark:from-blue-900/10" />

                <div className="relative p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${warehouse.isPrimary ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                        <WarehouseIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-[16px] font-semibold text-slate-950 dark:text-white line-clamp-1">
                          {language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-medium text-slate-400">{warehouse.code}</span>
                          {warehouse.isPrimary && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                              {language === 'ar' ? 'الرئيسي' : 'PRIMARY'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.02]">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'إجمالي الأصناف' : 'Total SKUs'}</p>
                      <p className="mt-1 text-[16px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        {stats.totalSKUs}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'قيمة المخزون' : 'Stock Value'}</p>
                      <p className="mt-1 text-[16px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={stats.totalValue} />
                      </p>
                    </div>
                  </div>

                  {capacity > 0 && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[11px] font-medium">
                        <span className="text-slate-500">{language === 'ar' ? 'السعة المستخدمة' : 'Capacity Used'}</span>
                        <span className={usagePercent > 90 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}>
                          {used} / {capacity} {warehouse.capacity.unit} ({usagePercent}%)
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            usagePercent > 90 ? 'bg-rose-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex gap-2">
                    <Link
                      to={`/app/dashboard/inventory/warehouses/${warehouse._id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1]"
                    >
                      {language === 'ar' ? 'الإعدادات' : 'Settings'}
                    </Link>
                    <button
                      onClick={() => setSelectedWarehouse({ id: warehouse._id, name: language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn })}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-[12px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      {language === 'ar' ? 'عرض المخزون' : 'View Stock'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <QuickViewDrawer
        warehouseId={selectedWarehouse?.id}
        warehouseName={selectedWarehouse?.name}
        onClose={() => setSelectedWarehouse(null)}
        language={language}
      />
    </div>
  )
}
