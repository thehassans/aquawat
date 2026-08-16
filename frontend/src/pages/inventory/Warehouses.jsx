import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Warehouse as WarehouseIcon, MapPin, Package, AlertCircle, X, ChevronRight, Loader2, Box, Info, ArrowRightLeft, SlidersHorizontal, PackagePlus, TrendingUp } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import ExportMenu from '../../components/ui/ExportMenu'
import Money from '../../components/ui/Money'

export default function Warehouses() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const isRtl = language === 'ar'

  const exportColumns = [
    { key: 'code', label: language === 'ar' ? '?????' : 'Code', value: (r) => r?.code || '' },
    { key: 'name', label: language === 'ar' ? '?????' : 'Name', value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'type', label: language === 'ar' ? '?????' : 'Type', value: (r) => r?.type || '' },
    { key: 'city', label: language === 'ar' ? '???????' : 'City', value: (r) => r?.address?.city || '' },
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  }

  return (
    <div className="space-y-8 min-h-screen pb-12">
      {/* Header section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl dark:from-[#0a0f18] dark:to-[#111827]">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <motion.div initial={{ opacity: 0, x: isRtl ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-400">
                {language === 'ar' ? '???????' : 'Inventory'}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t('warehouses')}
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-300">
                {language === 'ar' ? '????? ??????????? ????? ???????? ?????? ?????? ??? ???? ??????? ?????? ?? ?? ???? ???? ????? ?????.' : 'Manage facilities, track stock, and analyze performance across all your locations in one premium dashboard.'}
              </p>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-wrap items-center gap-3">
            <ExportMenu
              language={language}
              t={t}
              rows={warehouses || []}
              columns={exportColumns}
              fileBaseName={language === 'ar' ? '??????????' : 'Warehouses'}
              title={language === 'ar' ? '??????????' : 'Warehouses'}
              disabled={loadingWarehouses || !(warehouses || []).length}
            />
            <Link to="/app/dashboard/warehouses/new" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-5 py-2.5 text-[14px] font-semibold text-slate-900 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95">
              <span className="absolute inset-0 bg-gradient-to-r from-white via-blue-50 to-white opacity-0 transition-opacity group-hover:opacity-100" />
              <Plus className="relative h-4 w-4 transition-transform group-hover:rotate-90" />
              <span className="relative">{language === 'ar' ? '????? ??????' : 'Add Warehouse'}</span>
            </Link>
          </motion.div>
        </div>
      </div>

      {loadingWarehouses ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : (warehouses || []).length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 p-20 text-center backdrop-blur-xl dark:border-slate-800 dark:bg-[#0c111a]/50">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <WarehouseIcon className="h-10 w-10 text-slate-400" />
          </div>
          <p className="mt-6 text-xl font-bold text-slate-900 dark:text-white">
            {language === 'ar' ? '?? ???? ????????' : 'No warehouses found'}
          </p>
          <p className="mt-2 max-w-sm text-[14px] text-slate-500">
            {language === 'ar' ? '??? ??????? ????? ????? ?? ???? ???????.' : 'Add your first warehouse to start tracking inventory.'}
          </p>
          <Link
            to="/app/dashboard/warehouses/new"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-[14px] font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40"
          >
            <Plus className="h-5 w-5" />
            {language === 'ar' ? '????? ??????' : 'Add Warehouse'}
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse) => {
            const stats = statsMap[warehouse._id] || { totalSKUs: 0, totalQuantity: 0, totalValue: 0 }
            const capacity = warehouse.capacity?.totalSpace || 0
            const used = stats.totalQuantity || 0
            const usagePercent = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0
            
            return (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4 }}
                key={warehouse._id}
                className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white/80 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] dark:border-white/[0.08] dark:bg-[#0c111a]/80"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="relative h-full rounded-[1.85rem] bg-white dark:bg-[#0f1520] p-6 flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner ${warehouse.isPrimary ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300'}`}>
                        <WarehouseIcon className="h-7 w-7" />
                        {warehouse.isPrimary && (
                          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-400 ring-2 ring-white dark:ring-[#0f1520]">
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {language === 'ar' ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn}
                        </h3>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <MapPin className="h-3 w-3" />
                            {warehouse.code}
                          </span>
                          {warehouse.isPrimary && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                              {language === 'ar' ? '???????' : 'PRIMARY'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors group-hover:bg-blue-50/30 dark:border-white/5 dark:bg-white/[0.02] dark:group-hover:bg-blue-500/5">
                      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                        <Box className="h-4 w-4 text-blue-500" />
                        {language === 'ar' ? '?????? ???????' : 'Total SKUs'}
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {stats.totalSKUs.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors group-hover:bg-indigo-50/30 dark:border-white/5 dark:bg-white/[0.02] dark:group-hover:bg-indigo-500/5">
                      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        {language === 'ar' ? '???? ???????' : 'Stock Value'}
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                        <Money value={stats.totalValue} />
                      </p>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  {capacity > 0 && (
                    <div className="mt-6 rounded-2xl border border-slate-100 p-4 dark:border-white/5">
                      <div className="flex items-center justify-between text-[12px] font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">{language === 'ar' ? '??? ????????' : 'Warehouse Capacity'}</span>
                        <span className={usagePercent > 90 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}>
                          {usagePercent}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${usagePercent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            usagePercent > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : usagePercent > 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          }`}
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {used.toLocaleString()} / {capacity.toLocaleString()} {warehouse.capacity.unit}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1" />

                  {/* Mockup Action Buttons */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button onClick={(e) => { e.stopPropagation(); /* Mock action */ }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {language === 'ar' ? '???' : 'Transfer'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); /* Mock action */ }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {language === 'ar' ? '?????' : 'Adjust'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); /* Mock action */ }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                      <PackagePlus className="h-3.5 w-3.5" />
                      {language === 'ar' ? '??????' : 'Receive'}
                    </button>
                  </div>

                  {/* Main Action */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <button
                      onClick={() => navigate(`/app/dashboard/warehouses/${warehouse._id}`)}
                      className="group/btn flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[13px] font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    >
                      {language === 'ar' ? '??? ????????' : 'View Details'}
                      <ChevronRight className={`h-4 w-4 transition-transform ${isRtl ? 'rotate-180 group-hover/btn:-translate-x-1' : 'group-hover/btn:translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
