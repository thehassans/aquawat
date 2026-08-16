import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users, MapPin, AlertCircle, X, ChevronRight, Loader2, Building2, Phone, Mail, FileText, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import ExportMenu from '../components/ui/ExportMenu'
import Money from '../components/ui/Money'

function QuickViewDrawer({ supplierId, supplierName, onClose, language }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-performance', supplierId],
    queryFn: () => api.get(`/suppliers/${supplierId}/performance-detail`, { params: { months: 6 } }).then(res => res.data),
    enabled: Boolean(supplierId)
  })

  return (
    <AnimatePresence>
      {supplierId && (
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
                  {supplierName}
                </h3>
                <p className="text-[13px] text-slate-500">
                  {language === 'ar' ? 'أداء المورد' : 'Supplier Performance'}
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
              ) : !data ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 dark:border-white/10">
                  <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-[14px] font-medium text-slate-600 dark:text-slate-300">
                    {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}</p>
                      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        {data.summary.totalOrders}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'إجمالي المشتريات' : 'Total Spend'}</p>
                      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={data.summary.totalSpend} />
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'المرتجعات' : 'Returns'}</p>
                      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        {data.summary.totalReturns}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'متوسط قيمة الطلب' : 'Avg Order Value'}</p>
                      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={data.summary.avgOrderValue} />
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 text-[13px] font-semibold text-slate-900 dark:text-white">
                      {language === 'ar' ? 'أحدث الطلبات' : 'Recent Orders'}
                    </h4>
                    <div className="space-y-2">
                      {(data.orders || []).slice(0, 5).map((order) => (
                        <div key={order._id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-mono text-[12px] font-medium text-slate-700 dark:text-slate-300">{order.poNumber}</p>
                              <p className="text-[10px] text-slate-500">
                                {new Date(order.orderDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                              </p>
                            </div>
                          </div>
                          <p className="text-[13px] font-semibold tabular-nums">
                            <Money value={order.grandTotal} />
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-100 p-5 dark:border-white/10">
              <Link
                to={`/app/dashboard/purchases/suppliers/${supplierId}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                {language === 'ar' ? 'عرض الملف' : 'View Profile'}
                <ChevronRight className={`h-4 w-4 ${language === 'ar' ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function Suppliers() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [page, setPage] = useState(1)

  const exportColumns = [
    { key: 'code', label: language === 'ar' ? 'الرمز' : 'Code', value: (r) => r?.code || '' },
    { key: 'name', label: language === 'ar' ? 'الاسم' : 'Name', value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'phone', label: language === 'ar' ? 'الهاتف' : 'Phone', value: (r) => r?.phone || '' },
    { key: 'email', label: language === 'ar' ? 'البريد الإلكتروني' : 'Email', value: (r) => r?.email || '' },
  ]

  const { data: response, isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers', { page }],
    queryFn: () => api.get('/suppliers', { params: { page, limit: 50, isActive: 'all' } }).then((res) => res.data)
  })

  const { data: financials } = useQuery({
    queryKey: ['suppliers-financials'],
    queryFn: () => api.get('/suppliers/financials').then((res) => res.data)
  })

  const suppliers = response?.suppliers || []
  const financialsMap = (financials || []).reduce((acc, curr) => {
    acc[curr._id] = curr;
    return acc;
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
            {language === 'ar' ? 'الموردين' : 'Suppliers'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[30px]">
            {t('suppliers')}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'إدارة الموردين وتتبع العمليات المالية والطلبات.' : 'Manage suppliers and track financials and orders.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={suppliers || []}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'الموردين' : 'Suppliers'}
            title={language === 'ar' ? 'الموردين' : 'Suppliers'}
            disabled={loadingSuppliers || !(suppliers || []).length}
          />
          <Link to="/app/dashboard/purchases/suppliers/new" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
            <Plus className="h-4 w-4 opacity-80" />
            {language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
          </Link>
        </div>
      </div>

      {loadingSuppliers ? (
        <div className="flex justify-center p-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-600 dark:border-t-white" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <Users className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-[15px] font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'لا يوجد موردين' : 'No suppliers found'}
          </p>
          <p className="mt-1 max-w-sm text-[13px] text-slate-500">
            {language === 'ar' ? 'أضف موردك الأول للبدء في تتبع الطلبات.' : 'Add your first supplier to start tracking orders.'}
          </p>
          <Link
            to="/app/dashboard/purchases/suppliers/new"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[13px] font-medium text-white dark:bg-white dark:text-slate-950"
          >
            <Plus className="h-4 w-4" />
            {language === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {suppliers.map((supplier) => {
            const fin = financialsMap[supplier._id] || { totalCredit: 0, totalDebit: 0, balance: 0, totalPO: 0 }
            return (
              <motion.div
                key={supplier._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg dark:border-white/10 dark:bg-[#0c111a]"
              >
                {/* Background Gradient flair */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 transition group-hover:opacity-100 dark:from-indigo-900/10" />

                <div className="relative p-6 flex flex-col h-full justify-between gap-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-[17px] font-semibold text-slate-950 dark:text-white line-clamp-1">
                          {language === 'ar' ? supplier.nameAr || supplier.nameEn : supplier.nameEn || supplier.nameAr}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[12px] font-medium text-slate-500">{supplier.code}</span>
                          {!supplier.isActive && (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                              {language === 'ar' ? 'غير نشط' : 'INACTIVE'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-[11px] font-medium text-slate-500">{language === 'ar' ? 'إجمالي طلبات الشراء' : 'Total POs'}</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fin.totalPO}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.02]">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        {language === 'ar' ? 'دائن' : 'Credit'}
                      </p>
                      <p className="mt-1.5 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={fin.totalCredit} />
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3 text-rose-500" />
                        {language === 'ar' ? 'مدين' : 'Debit'}
                      </p>
                      <p className="mt-1.5 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        <Money value={fin.totalDebit} />
                      </p>
                    </div>
                    <div className="border-l border-slate-200 pl-3 dark:border-white/10">
                      <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-blue-500" />
                        {language === 'ar' ? 'الرصيد' : 'Balance'}
                      </p>
                      <p className="mt-1.5 text-[14px] font-bold tabular-nums text-slate-900 dark:text-white">
                        <Money value={fin.balance} />
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to={`/app/dashboard/purchases/suppliers/${supplier._id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1]"
                    >
                      {language === 'ar' ? 'عرض الملف' : 'Profile'}
                    </Link>
                    <button
                      onClick={() => setSelectedSupplier({ id: supplier._id, name: language === 'ar' ? supplier.nameAr || supplier.nameEn : supplier.nameEn })}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-[12px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      {language === 'ar' ? 'الأداء' : 'Performance'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination controls can be added here if needed */}

      <QuickViewDrawer
        supplierId={selectedSupplier?.id}
        supplierName={selectedSupplier?.name}
        onClose={() => setSelectedSupplier(null)}
        language={language}
      />
    </div>
  )
}
