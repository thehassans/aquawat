import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { ArrowLeft, Edit, Package, Truck, ArrowDownCircle, ArrowUpCircle, AlertCircle, FileText, Settings } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

export default function WarehouseDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-dashboard', id],
    queryFn: () => api.get(`/warehouses/${id}/dashboard`).then(res => res.data)
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950 dark:border-slate-600 dark:border-t-white" />
      </div>
    )
  }

  if (!data || !data.warehouse) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 dark:border-white/10">
        <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 text-[14px] font-medium text-slate-600 dark:text-slate-300">
          {language === 'ar' ? 'المستودع غير موجود' : 'Warehouse not found'}
        </p>
      </div>
    )
  }

  const { warehouse, inventory, upcomingPOs, recentGRNs, recentReturns } = data
  const name = language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn || warehouse.nameAr

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/dashboard/warehouses')} className="btn btn-ghost btn-icon">
            <ArrowLeft className={`h-5 w-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {name}
            </h1>
            <p className="text-[13px] text-slate-500 font-mono mt-0.5">{warehouse.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/app/dashboard/warehouses/${id}/edit`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            <Settings className="h-4 w-4" />
            {language === 'ar' ? 'الإعدادات' : 'Settings'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Inventory Section */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 dark:border-white/10 dark:bg-[#0c111a]">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-5 dark:border-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'المخزون الحالي' : 'Current Stock'}</h3>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
            {inventory.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-8">{language === 'ar' ? 'لا يوجد مخزون' : 'No stock'}</p>
            ) : (
              inventory.map((item, idx) => (
                <Link to={`/app/dashboard/products/${item.product._id}`} key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl transition hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                  <div>
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white">{language === 'ar' ? item.product.nameAr || item.product.nameEn : item.product.nameEn}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">{item.product.sku}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      <span className="text-blue-600 dark:text-blue-400">{item.totalSold} {language === 'ar' ? 'مباع' : 'Sold'}</span>
                      <span className="text-rose-600 dark:text-rose-400">{item.totalReturned} {language === 'ar' ? 'مرتجع' : 'Returned'}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-[16px] font-bold tabular-nums text-slate-900 dark:text-white">{item.quantity}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{language === 'ar' ? 'الإجمالي' : 'Total'}</p>
                      <span className="mx-1 text-slate-200 dark:text-white/10">|</span>
                      <p className="text-[16px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{item.availableQuantity}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{language === 'ar' ? 'متوفر' : 'Available'}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* Upcoming POs */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 dark:border-white/10 dark:bg-[#0c111a]">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-5 dark:border-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Truck className="h-5 w-5" />
            </div>
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'طلبات الشراء القادمة' : 'Upcoming POs'}</h3>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
            {upcomingPOs.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-8">{language === 'ar' ? 'لا توجد طلبات' : 'No upcoming POs'}</p>
            ) : (
              upcomingPOs.map((po, idx) => (
                <Link to={`/app/dashboard/purchases/orders/${po._id}`} key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl transition hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-[13px] font-mono font-medium text-slate-900 dark:text-white">{po.poNumber}</p>
                      <p className="text-[11px] text-slate-500 mt-1 capitalize">{po.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white"><Money value={po.grandTotal} /></p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* GRNs */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 dark:border-white/10 dark:bg-[#0c111a]">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-5 dark:border-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'الاستلامات الأخيرة (GRN)' : 'Recent GRNs'}</h3>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
            {recentGRNs.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-8">{language === 'ar' ? 'لا توجد استلامات' : 'No recent GRNs'}</p>
            ) : (
              recentGRNs.map((grn, idx) => (
                <Link to={`/app/dashboard/purchases/grn/${grn._id}`} key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl transition hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                  <div>
                    <p className="text-[13px] font-mono font-medium text-slate-900 dark:text-white">{grn.grnNumber}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{new Date(grn.dateReceived).toLocaleDateString()}</p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full dark:bg-white/5 dark:border-white/10 dark:text-slate-300 capitalize">
                    {grn.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* Purchase Returns */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 dark:border-white/10 dark:bg-[#0c111a]">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-5 dark:border-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <ArrowUpCircle className="h-5 w-5" />
            </div>
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{language === 'ar' ? 'مرتجعات المشتريات' : 'Purchase Returns'}</h3>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
            {recentReturns.length === 0 ? (
              <p className="text-[13px] text-slate-500 text-center py-8">{language === 'ar' ? 'لا توجد مرتجعات' : 'No purchase returns'}</p>
            ) : (
              recentReturns.map((ret, idx) => {
                const returnedQty = ret.lines?.reduce((sum, line) => sum + (line.quantityReturned || 0), 0) || 0
                return (
                  <Link to={`/app/dashboard/purchases/returns/${ret._id}`} key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl transition hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                    <div>
                      <p className="text-[13px] font-mono font-medium text-slate-900 dark:text-white">{ret.returnNumber}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{new Date(ret.dateReturned).toLocaleDateString()}</p>
                    </div>
                    <p className="text-[14px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {returnedQty} {language === 'ar' ? 'وحدة' : 'Units'}
                    </p>
                  </Link>
                )
              })
            )}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
