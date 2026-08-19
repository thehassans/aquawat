import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Package, DollarSign, Clock,
  Award, AlertTriangle, X, ShoppingCart, RotateCcw, Phone, Mail, ExternalLink,
} from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'

const GRADE_COLORS = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700',
  B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700',
  C: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700',
}

const SCORE_COLORS = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  bad: 'text-red-600 dark:text-red-400',
}

function getScoreColor(value, thresholds = { good: 80, warning: 60 }) {
  if (value >= thresholds.good) return SCORE_COLORS.good
  if (value >= thresholds.warning) return SCORE_COLORS.warning
  return SCORE_COLORS.bad
}

function StatCard({ icon: Icon, label, value, sublabel, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-xl bg-gradient-to-br ${color} shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </motion.div>
  )
}

function SupplierDetailModal({ supplierId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-performance-detail', supplierId],
    queryFn: () => api.get(`/suppliers/${supplierId}/performance-detail`).then(res => res.data),
    enabled: Boolean(supplierId),
  })

  const maxSpend = data ? Math.max(...data.monthlyTrend.map(m => m.spend), 1) : 1

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {data?.supplier ? (data.supplier.nameEn || data.supplier.nameAr) : 'Supplier Detail'}
              </h3>
              <p className="text-xs text-gray-500">{data?.supplier?.code} · {data?.supplier?.vatNumber || 'No VAT'}</p>
            </div>
            <div className="flex items-center gap-2">
              {supplierId && (
                <Link
                  to={`/app/dashboard/suppliers/${supplierId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-dark-700 dark:text-slate-200 dark:hover:bg-dark-600"
                >
                  <span>View Full Hub</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data ? (
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-900/50">
                  <p className="text-xs text-gray-400">Total Orders</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{data.summary.totalOrders}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-900/50">
                  <p className="text-xs text-gray-400">Total Spend</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{data.summary.totalSpend.toLocaleString()} SAR</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-900/50">
                  <p className="text-xs text-gray-400">Avg Order Value</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(data.summary.avgOrderValue).toLocaleString()} SAR</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-900/50">
                  <p className="text-xs text-gray-400">Returns</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{data.summary.totalReturns}</p>
                </div>
              </div>

              {/* Monthly Trend */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Spend Trend</h4>
                <div className="flex items-end gap-2 h-32">
                  {data.monthlyTrend.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-gray-400">{m.orders} ord</div>
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary-500 to-primary-400 min-h-[4px] transition-all"
                        style={{ height: `${(m.spend / maxSpend) * 100}%` }}
                        title={`${m.spend.toLocaleString()} SAR`}
                      />
                      <div className="text-[10px] text-gray-500">{m.month}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Products */}
              {data.topProducts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Products by Spend</h4>
                  <div className="space-y-2">
                    {data.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-900/50">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                          <p className="text-xs text-gray-400">
                            Ordered: {p.totalOrdered} · Received: {p.totalReceived}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {p.totalCost.toLocaleString()} SAR
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Return Reasons */}
              {Object.keys(data.returnReasons).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Return Reasons</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.returnReasons).map(([reason, qty]) => (
                      <span key={reason} className="px-3 py-1 rounded-full text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                        {reason}: {qty} units
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Orders</h4>
                <div className="space-y-1.5">
                  {data.orders.slice(0, 8).map((o, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-900/50">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{o.poNumber}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          o.status === 'received' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          o.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>{o.status}</span>
                        <span className="text-xs text-gray-500">{(o.grandTotal || 0).toLocaleString()} SAR</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function SupplierPerformance() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [months, setMonths] = useState(6)

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-performance', months],
    queryFn: () => api.get('/suppliers/performance', { params: { months } }).then(res => res.data),
  })

  const performance = data?.performance || []
  const gradeDist = data?.gradeDistribution || { A: 0, B: 0, C: 0 }
  const totals = data?.totals || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'أداء الموردين' : 'Supplier Performance'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'تحليل وتقييم أداء الموردين' : 'Analyze and score supplier performance'}
          </p>
        </div>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="select w-auto"
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label={language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers'}
          value={totals.totalSuppliers || 0}
          color="from-primary-500 to-primary-600"
          delay={0}
        />
        <StatCard
          icon={DollarSign}
          label={language === 'ar' ? 'إجمالي الإنفاق' : 'Total Spend'}
          value={`${(totals.totalSpend || 0).toLocaleString()} SAR`}
          color="from-emerald-500 to-emerald-600"
          delay={0.05}
        />
        <StatCard
          icon={Clock}
          label={language === 'ar' ? 'متوسط الالتزام بالوقت' : 'Avg On-Time Rate'}
          value={`${totals.avgOnTimeRate || 0}%`}
          color="from-blue-500 to-blue-600"
          delay={0.1}
        />
        <StatCard
          icon={RotateCcw}
          label={language === 'ar' ? 'متوسط معدل الإرجاع' : 'Avg Return Rate'}
          value={`${totals.avgReturnRate || 0}%`}
          color="from-amber-500 to-amber-600"
          delay={0.15}
        />
      </div>

      {/* Grade Distribution */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {language === 'ar' ? 'توزيع التقييمات' : 'Grade Distribution'}
          </h3>
        </div>
        <div className="flex gap-3">
          {['A', 'B', 'C'].map((grade) => (
            <div key={grade} className={`flex-1 p-3 rounded-xl border text-center ${GRADE_COLORS[grade]}`}>
              <p className="text-2xl font-bold">{grade}</p>
              <p className="text-xs mt-0.5">{gradeDist[grade] || 0} suppliers</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supplier Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : performance.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No supplier data for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">On-Time</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Return %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Time</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {performance.map((s, i) => (
                  <motion.tr
                    key={s._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-gray-50 dark:hover:bg-dark-800 cursor-pointer transition-colors"
                    onClick={() => setSelectedSupplier(s._id)}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${GRADE_COLORS[s.grade]}`}>
                        {s.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {language === 'ar' ? (s.nameAr || s.nameEn) : (s.nameEn || s.nameAr)}
                      </p>
                      <p className="text-xs text-gray-400">{s.code}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{s.metrics.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{s.metrics.totalSpend.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${getScoreColor(s.metrics.onTimeRate)}`}>
                        {s.metrics.onTimeRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${s.metrics.returnRate > 5 ? SCORE_COLORS.bad : s.metrics.returnRate > 2 ? SCORE_COLORS.warning : SCORE_COLORS.good}`}>
                        {s.metrics.returnRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                      {s.metrics.avgLeadTimeDays > 0 ? `${s.metrics.avgLeadTimeDays}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${getScoreColor(s.score)}`}>{s.score}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSupplier && (
        <SupplierDetailModal supplierId={selectedSupplier} onClose={() => setSelectedSupplier(null)} />
      )}
    </div>
  )
}
