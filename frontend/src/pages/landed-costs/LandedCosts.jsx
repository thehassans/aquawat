import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  Anchor,
  Plus,
  Search,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Percent,
  Package,
  ArrowUpRight,
} from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'

const STATUS_PILL = {
  draft: 'bg-slate-50 text-slate-500 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10',
  calculated: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  posted: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
}

const ALLOCATION_LABELS = {
  by_value: { en: 'By value', ar: 'بالقيمة' },
  by_weight: { en: 'By weight', ar: 'بالوزن' },
  by_quantity: { en: 'By quantity', ar: 'بالكمية' },
  equal: { en: 'Equal split', ar: 'مقسّم بالتساوي' },
}

const COST_TYPE_LABELS = {
  customs_duty: { en: 'Customs', ar: 'جمارك' },
  freight: { en: 'Freight', ar: 'شحن' },
  insurance: { en: 'Insurance', ar: 'تأمين' },
  port_handling: { en: 'Port', ar: 'ميناء' },
  clearance_fees: { en: 'Clearance', ar: 'تخليص' },
  other: { en: 'Other', ar: 'أخرى' },
}

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'

export default function LandedCosts() {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const t = (en, ar) => (isAr ? ar : en)

  const [landedCosts, setLandedCosts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })

  const statusLabel = (status) => {
    const ar = { draft: 'مسودة', calculated: 'محسوبة', posted: 'منشورة' }
    if (isAr) return ar[status] || status
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : status
  }

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const { data } = await api.get('/landed-costs/stats')
      setStats(data)
    } catch (_) {
      /* keep empty */
    } finally {
      setStatsLoading(false)
    }
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
    } catch (_) {
      /* keep empty */
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])
  useEffect(() => {
    fetchLandedCosts()
  }, [fetchLandedCosts])

  const toggleStatus = (status) => {
    setStatusFilter((current) => (current === status ? '' : status))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
            {t('Import costing', 'تكلفة الاستيراد')}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[30px]">
            {t('Landed costs', 'التكاليف المرسية')}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            {t(
              'Allocate customs, freight, and handling into true unit cost before goods hit the shelf.',
              'وزّع الجمارك والشحن والمناولة على تكلفة الوحدة قبل دخول البضاعة للمخزون.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/dashboard/landed-costs/new')}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
        >
          <Plus className="h-4 w-4 opacity-80" />
          {t('New landed cost', 'تكلفة مرسية جديدة')}
        </button>
      </div>

      <div className={shell}>
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-3 dark:bg-white/[0.08]">
          {[
            {
              label: t('Landed YTD', 'إجمالي السنة'),
              value: statsLoading ? '—' : <Money value={stats?.totalLandedCostsYTD || 0} />,
              icon: TrendingUp,
              onClick: () => setStatusFilter(''),
              active: !statusFilter,
            },
            {
              label: t('Avg. duty rate', 'متوسط الرسوم'),
              value: statsLoading ? '—' : `${stats?.avgDutyRate ?? 0}%`,
              icon: Percent,
            },
            {
              label: t('Unposted', 'غير منشورة'),
              value: statsLoading ? '—' : stats?.pendingCount ?? 0,
              icon: Package,
              accent: true,
              onClick: () => toggleStatus('draft'),
              active: statusFilter === 'draft',
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              disabled={!item.onClick}
              className={`bg-white px-5 py-5 text-start transition dark:bg-[#0c111a] ${
                item.onClick ? 'hover:bg-slate-50 dark:hover:bg-white/[0.03]' : 'cursor-default'
              } ${item.active ? 'ring-1 ring-inset ring-teal-600/20' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {item.label}
                </p>
                <item.icon className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              </div>
              <p
                className={`mt-2 text-[22px] font-semibold tabular-nums tracking-tight ${
                  item.accent ? 'text-amber-600 dark:text-amber-400' : 'text-slate-950 dark:text-white'
                }`}
              >
                {item.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className={shell}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center dark:border-white/10">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search LC number or vendor…', 'ابحث برقم التكلفة أو المورد…')}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50 py-2.5 ps-9 pe-3 text-[13px] text-slate-900 outline-none ring-teal-600/20 transition focus:border-teal-600/40 focus:bg-white focus:ring-2 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:bg-white/[0.06]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['', 'draft', 'calculated', 'posted'].map((status) => (
              <button
                key={status || 'all'}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium ring-1 ring-inset transition ${
                  statusFilter === status
                    ? 'bg-slate-950 text-white ring-slate-950 dark:bg-white dark:text-slate-950 dark:ring-white'
                    : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-400 dark:ring-white/10'
                }`}
              >
                {status ? statusLabel(status) : t('All', 'الكل')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-slate-50/70 dark:bg-white/[0.02]" />
            ))}
          </div>
        ) : landedCosts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-white/[0.04]">
              <Anchor className="h-6 w-6" />
            </div>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {t('No landed costs yet', 'لا توجد تكاليف مرسية')}
            </p>
            <p className="max-w-sm text-[13px] leading-6 text-slate-500">
              {t(
                'Create a worksheet to roll customs, freight, and handling into product cost.',
                'أنشئ ورقة عمل لتوزيع الجمارك والشحن والمناولة على تكلفة المنتج.'
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate('/app/dashboard/landed-costs/new')}
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[13px] font-medium text-white dark:bg-white dark:text-slate-950"
            >
              <Plus className="h-4 w-4" />
              {t('New landed cost', 'تكلفة مرسية جديدة')}
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-start dark:border-white/10">
                    {[
                      t('LC #', 'رقم ت.م'),
                      t('Vendor', 'المورد'),
                      t('Linked docs', 'المستندات'),
                      t('Cost lines', 'بنود التكلفة'),
                      t('Total', 'الإجمالي'),
                      t('Method', 'الطريقة'),
                      t('Status', 'الحالة'),
                      '',
                    ].map((h) => (
                      <th
                        key={h || 'actions'}
                        className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {landedCosts.map((lc, idx) => (
                    <motion.tr
                      key={lc._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => navigate(`/app/dashboard/landed-costs/${lc._id}`)}
                      className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3.5 font-mono text-[12px] font-semibold text-slate-950 dark:text-white">
                        {lc.lcNumber || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-800 dark:text-slate-200">
                        {lc.vendor || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          <span>{lc.shipment?.shipmentNumber || t('No shipment', 'بدون شحنة')}</span>
                          <span className="text-[11px] text-slate-400">{lc.purchaseOrder?.poNumber || t('No PO', 'بدون أمر شراء')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(lc.costLines || []).slice(0, 3).map((cl, ci) => (
                            <span
                              key={ci}
                              className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-600 ring-1 ring-inset ring-slate-200/80 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10"
                            >
                              {COST_TYPE_LABELS[cl.type]?.[isAr ? 'ar' : 'en'] || String(cl.type || '').replace(/_/g, ' ')}
                            </span>
                          ))}
                          {lc.costLines?.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{lc.costLines.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-950 dark:text-white">
                        <Money value={lc.totalCost || 0} />
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500">
                        {ALLOCATION_LABELS[lc.allocationMethod]?.[isAr ? 'ar' : 'en'] || lc.allocationMethod}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                            STATUS_PILL[lc.status] || STATUS_PILL.draft
                          }`}
                        >
                          {statusLabel(lc.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400">
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-white/10">
                <p className="text-[12px] text-slate-400">
                  {pagination.total} {t('records', 'سجل')}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                    {page} / {pagination.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-white/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
