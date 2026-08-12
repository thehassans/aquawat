import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Package, Plus, Search, TrendingUp, ChevronLeft, ChevronRight, Percent } from 'lucide-react'
import api from '../../lib/api'

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  calculated: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  posted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const ALLOCATION_LABELS = {
  by_value: 'By Value',
  by_weight: 'By Weight',
  by_quantity: 'By Qty',
  equal: 'Equal Split',
}

const StatCard = ({ icon: Icon, label, value, sub, color, loading }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-100 dark:border-dark-700 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-6 h-6" /></div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{label}</p>
        {loading ? <div className="h-6 w-24 bg-gray-200 dark:bg-dark-600 rounded animate-pulse mt-1" /> : (
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        )}
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  </motion.div>
)

export default function LandedCosts() {
  const navigate = useNavigate()
  const { language } = useSelector(s => s.ui)
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en

  const [landedCosts, setLandedCosts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })

  const fetchStats = useCallback(async () => {
    try { setStatsLoading(true); const { data } = await api.get('/landed-costs/stats'); setStats(data) }
    catch (_) {} finally { setStatsLoading(false) }
  }, [])

  const fetchLandedCosts = useCallback(async () => {
    try {
      setLoading(true)
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/landed-costs', { params })
      setLandedCosts(data.landedCosts || [])
      setPagination(data.pagination || { total: 0, pages: 1 })
    } catch (_) {} finally { setLoading(false) }
  }, [page, search, statusFilter])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setPage(1) }, [search, statusFilter])
  useEffect(() => { fetchLandedCosts() }, [fetchLandedCosts])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Landed Costs', 'التكاليف المرسية')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('Allocate customs, freight, and handling costs to products', 'تخصيص الجمارك والشحن والتكاليف للمنتجات')}</p>
        </div>
        <button onClick={() => navigate('/app/dashboard/landed-costs/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> {t('New Landed Cost', 'تكلفة مرسية جديدة')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label={t('Total Landed YTD', 'إجمالي السنة')} value={stats ? stats.totalLandedCostsYTD?.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' SAR' : '—'} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" loading={statsLoading} />
        <StatCard icon={Percent} label={t('Avg. Duty Rate', 'متوسط معدل الرسوم')} value={stats ? stats.avgDutyRate + '%' : '—'} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" loading={statsLoading} />
        <StatCard icon={Package} label={t('Unposted Records', 'سجلات غير منشورة')} value={stats?.pendingCount ?? 0} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" loading={statsLoading} />
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search by LC#, vendor...', 'بحث...')}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white">
          <option value="">{t('All Statuses', 'كل الحالات')}</option>
          <option value="draft">Draft</option>
          <option value="calculated">Calculated</option>
          <option value="posted">Posted</option>
        </select>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {[...Array(4)].map((_, i) => <div key={i} className="p-4 h-16 animate-pulse bg-gray-50/50 dark:bg-dark-700/20" />)}
          </div>
        ) : landedCosts.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
            <Package className="w-12 h-12 opacity-30" />
            <p className="font-medium">{t('No landed costs found', 'لا توجد تكاليف مرسية')}</p>
            <p className="text-sm">{t('Create one to allocate import costs to your products', 'أنشئ سجلاً لتخصيص تكاليف الاستيراد')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-700/50">
                    {[t('LC #', 'رقم ت.م'), t('Shipment', 'الشحنة'), t('PO', 'أمر الشراء'), t('Vendor', 'المورد'), t('Cost Lines', 'بنود التكلفة'), t('Total Cost', 'الإجمالي'), t('Method', 'طريقة التوزيع'), t('Status', 'الحالة'), t('Actions', 'إجراءات')].map(h => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-dark-700">
                  {landedCosts.map((lc, idx) => (
                    <motion.tr key={lc._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                      className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{lc.lcNumber}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{lc.shipment?.shipmentNumber || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{lc.purchaseOrder?.poNumber || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{lc.vendor || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(lc.costLines || []).slice(0, 3).map((cl, ci) => (
                            <span key={ci} className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                              {cl.type?.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {lc.costLines?.length > 3 && <span className="text-xs text-gray-400">+{lc.costLines.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {lc.totalCost?.toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{ALLOCATION_LABELS[lc.allocationMethod] || lc.allocationMethod}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[lc.status] || STATUS_STYLES.draft}`}>{lc.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/app/dashboard/landed-costs/${lc._id}`)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-600 text-xs font-medium hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300 transition-colors">
                          {t('Open', 'فتح')}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} {t('records', 'سجل')}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 dark:border-dark-600 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{page} / {pagination.pages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="p-2 rounded-lg border border-gray-200 dark:border-dark-600 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
