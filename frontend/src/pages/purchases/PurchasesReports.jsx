import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Calendar,
  Filter,
  Download,
  Printer,
  TrendingUp,
  CreditCard,
  Package,
  Building2,
  PieChart as PieIcon,
  BarChart3,
  Table as TableIcon,
  ArrowUpDown,
  RefreshCw,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'

const COLORS = ['#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#64748b']

const STATUS_LABELS_MAP = {
  draft: { ar: 'مسودة', en: 'Draft', color: '#94a3b8' },
  sent: { ar: 'مرسل', en: 'Sent', color: '#0284c7' },
  approved: { ar: 'معتمد', en: 'Approved', color: '#0d9488' },
  partially_received: { ar: 'مستلم جزئياً', en: 'Partially Received', color: '#f59e0b' },
  received: { ar: 'مستلم', en: 'Received', color: '#10b981' },
  billed: { ar: 'مفوتر', en: 'Billed', color: '#8b5cf6' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', color: '#f43f5e' },
}

export default function PurchasesReports() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [datePreset, setDatePreset] = useState('all') // 'this_month', 'last_30', 'this_year', 'all', 'custom'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [pivotGroupBy, setPivotGroupBy] = useState('supplier') // 'supplier', 'warehouse', 'month', 'status', 'product'
  const [sortField, setSortField] = useState('totalSpend')
  const [sortAsc, setSortAsc] = useState(false)

  // Calculate actual date filters based on preset
  const computedDates = useMemo(() => {
    const now = new Date()
    if (datePreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: first.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) }
    }
    if (datePreset === 'last_30') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { start: past.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) }
    }
    if (datePreset === 'this_year') {
      const first = new Date(now.getFullYear(), 0, 1)
      return { start: first.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) }
    }
    if (datePreset === 'custom') {
      return { start: startDate, end: endDate }
    }
    return { start: '', end: '' }
  }, [datePreset, startDate, endDate])

  // Fetch report analytics from API
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['purchases-reports', computedDates, selectedSupplierId, selectedWarehouseId],
    queryFn: () =>
      api.get('/purchase-orders/reports', {
        params: {
          startDate: computedDates.start || undefined,
          endDate: computedDates.end || undefined,
          supplierId: selectedSupplierId || undefined,
          warehouseId: selectedWarehouseId || undefined,
        },
      }).then((res) => res.data),
  })

  // Fetch all suppliers and warehouses for filter dropdowns
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => api.get('/suppliers', { params: { limit: 200 } }).then((res) => res.data.suppliers || []),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((res) => (Array.isArray(res.data) ? res.data : res.data?.warehouses || [])),
  })

  const summary = reportData?.summary || {}
  const monthlyTrends = reportData?.monthlyTrends || []
  const bySupplier = reportData?.bySupplier || []
  const byStatus = reportData?.byStatus || []
  const topProducts = reportData?.topProducts || []
  const allOrders = reportData?.orders || []

  // Dynamic Pivot Matrix Aggregation based on `pivotGroupBy`
  const pivotData = useMemo(() => {
    if (!reportData) return []

    if (pivotGroupBy === 'supplier') {
      return bySupplier.map((s) => ({
        dimension: language === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr || s.code,
        code: s.code,
        poCount: s.poCount,
        totalSpend: s.totalSpend,
        totalPaid: s.totalPaid,
        balanceDue: s.balanceDue,
      }))
    }

    if (pivotGroupBy === 'product') {
      return topProducts.map((p) => ({
        dimension: p.name,
        code: p.uom,
        poCount: p.orderCount,
        orderedQty: p.orderedQty,
        receivedQty: p.receivedQty,
        backorderQty: p.backorderQty,
        fulfillmentRate: p.orderedQty > 0 ? Math.round((p.receivedQty / p.orderedQty) * 100) : 0,
        totalSpend: p.totalCost,
      }))
    }

    if (pivotGroupBy === 'status') {
      return byStatus.map((st) => ({
        dimension: language === 'ar' ? STATUS_LABELS_MAP[st.status]?.ar || st.status : STATUS_LABELS_MAP[st.status]?.en || st.status,
        poCount: st.count,
        totalSpend: st.total,
      }))
    }

    if (pivotGroupBy === 'month') {
      return monthlyTrends.map((m) => ({
        dimension: m.month,
        poCount: m.count,
        totalSpend: m.spend,
        totalPaid: m.paid,
        balanceDue: Math.max(0, m.spend - m.paid),
      }))
    }

    return []
  }, [reportData, pivotGroupBy, bySupplier, topProducts, byStatus, monthlyTrends, language])

  // Sorted Pivot Data
  const sortedPivotData = useMemo(() => {
    return [...pivotData].sort((a, b) => {
      const valA = a[sortField] ?? 0
      const valB = b[sortField] ?? 0
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortAsc ? valA - valB : valB - valA
    })
  }, [pivotData, sortField, sortAsc])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // Export Columns for ExportMenu
  const exportColumns = useMemo(() => {
    return [
      { key: 'dimension', label: language === 'ar' ? 'البند / الفئة' : 'Dimension', value: (r) => r.dimension },
      { key: 'poCount', label: language === 'ar' ? 'عدد الطلبات' : 'Orders Count', value: (r) => r.poCount || 0 },
      { key: 'totalSpend', label: language === 'ar' ? 'إجمالي المشتريات' : 'Total Spend', value: (r) => r.totalSpend || 0 },
      { key: 'totalPaid', label: language === 'ar' ? 'المدفوع' : 'Paid', value: (r) => r.totalPaid || 0 },
      { key: 'balanceDue', label: language === 'ar' ? 'المتبقي' : 'Balance Due', value: (r) => r.balanceDue || 0 },
    ]
  }, [language])

  const shell =
    'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20'

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
            {language === 'ar' ? 'التحليلات والمؤشرات' : 'Purchases Analytics'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {language === 'ar' ? 'تقارير وتحليلات المشتريات' : 'Purchases Reports & Analytics'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'تحليل شامل لحجم الإنفاق على المشتريات، أداء الموردين، الرسوم البيانية، وجداول التحليل المحوري (Pivot Matrix).'
              : 'Deep-dive analysis of purchase volumes, vendor spend share, status distributions, and interactive pivot tables.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={sortedPivotData}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? 'تقرير_المشتريات' : 'Purchases_Report'}
            title={language === 'ar' ? 'تقرير المشتريات' : 'Purchases Report'}
            disabled={isLoading || sortedPivotData.length === 0}
          />
          <button
            type="button"
            onClick={() => window.print()}
            className={ghostBtn}
          >
            <Printer className="h-4 w-4 opacity-70" />
            {language === 'ar' ? 'طباعة التقرير' : 'Print'}
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className={`${shell} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {language === 'ar' ? 'الفترة الزمنية:' : 'Date Period:'}
          </span>
          {[
            { id: 'all', label: language === 'ar' ? 'كل الأوقات' : 'All Time' },
            { id: 'this_month', label: language === 'ar' ? 'هذا الشهر' : 'This Month' },
            { id: 'last_30', label: language === 'ar' ? 'آخر 30 يوم' : 'Last 30 Days' },
            { id: 'this_year', label: language === 'ar' ? 'هذا العام' : 'This Year' },
            { id: 'custom', label: language === 'ar' ? 'مخصص' : 'Custom' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                datePreset === preset.id
                  ? 'bg-teal-700 text-white ring-teal-700 dark:bg-teal-600'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300 dark:ring-white/10'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Secondary Filter Row (Custom Date, Supplier, Warehouse) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-xs">
          {datePreset === 'custom' && (
            <>
              <div>
                <label className="label">{language === 'ar' ? 'من تاريخ' : 'From Date'}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input !py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input !py-1.5 text-xs"
                />
              </div>
            </>
          )}

          <div>
            <label className="label">{language === 'ar' ? 'المورد' : 'Supplier'}</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="select !py-1.5 text-xs"
            >
              <option value="">{language === 'ar' ? 'جميع الموردين' : 'All Suppliers'}</option>
              {(suppliers || []).map((s) => (
                <option key={s._id} value={s._id}>
                  {language === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'المستودع' : 'Warehouse'}</label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="select !py-1.5 text-xs"
            >
              <option value="">{language === 'ar' ? 'جميع المستودعات' : 'All Warehouses'}</option>
              {(warehouses || []).map((w) => (
                <option key={w._id} value={w._id}>
                  {language === 'ar' ? w.nameAr || w.nameEn : w.nameEn || w.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Top Metric Cards Grid */}
      <div className={shell}>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 lg:grid-cols-5 dark:bg-white/[0.08]">
          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'إجمالي المشتريات' : 'Total Spend'}
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
              <Money value={summary.totalSpend || 0} />
            </p>
            <span className="text-[11px] text-slate-400">
              {summary.totalOrders || 0} {language === 'ar' ? 'أمر شراء' : 'POs'}
            </span>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'المدفوع للموردين' : 'Total Paid'}
            </span>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              <Money value={summary.totalPaid || 0} />
            </p>
            <span className="text-[11px] text-slate-400">{language === 'ar' ? 'دفعات مسددة' : 'Settled amount'}</span>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'المتبقي للموردين' : 'Outstanding Balance'}
            </span>
            <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              <Money value={summary.totalBalance || 0} />
            </p>
            <span className="text-[11px] text-slate-400">{language === 'ar' ? 'ذمم غير مسددة' : 'Pending balance'}</span>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'نسبة الاستلام' : 'Fulfillment Rate'}
            </span>
            <p className="mt-2 text-2xl font-bold text-teal-700 dark:text-teal-300 tabular-nums">
              {summary.fulfillmentRate || 0}%
            </p>
            <span className="text-[11px] text-slate-400">
              {summary.totalReceivedQty || 0} / {summary.totalOrderedQty || 0} {language === 'ar' ? 'وحدة' : 'units'}
            </span>
          </div>

          <div className="bg-white p-4 sm:p-5 dark:bg-[#0c111a] col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'متوسط قيمة الطلب' : 'Average PO Value'}
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              <Money value={summary.averageOrderValue || 0} />
            </p>
            <span className="text-[11px] text-slate-400">{language === 'ar' ? 'لكل أمر شراء' : 'Per purchase order'}</span>
          </div>
        </div>
      </div>

      {/* CHARTS GRID (Responsive Recharts) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Monthly Purchases Spend Trend */}
        <div className={`${shell} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'اتجاه الإنفاق الشهري (Purchases Trend)' : 'Monthly Purchases Spend Trend'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">SAR</span>
          </div>

          <div className="h-64 w-full">
            {monthlyTrends.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {language === 'ar' ? 'لا توجد بيانات كافية للرسم البياني' : 'No trend data available'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toLocaleString()} SAR`, '']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="spend" name={language === 'ar' ? 'إجمالي المشتريات' : 'Committed Spend'} stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#spendGrad)" />
                  <Area type="monotone" dataKey="paid" name={language === 'ar' ? 'المدفوع' : 'Paid Amount'} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#paidGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Spend by Top Suppliers */}
        <div className={`${shell} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'أعلى الموردين حجماً (Top Suppliers by Spend)' : 'Top Suppliers by Spend Volume'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">SAR</span>
          </div>

          <div className="h-64 w-full">
            {bySupplier.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {language === 'ar' ? 'لا توجد بيانات موردين' : 'No supplier spend data'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySupplier.slice(0, 5)} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey={language === 'ar' ? 'nameAr' : 'nameEn'} tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toLocaleString()} SAR`, '']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)' }}
                  />
                  <Bar dataKey="totalSpend" name={language === 'ar' ? 'قيمة المشتريات' : 'Spend'} fill="#0d9488" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="balanceDue" name={language === 'ar' ? 'المتبقي' : 'Balance Due'} fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Purchase Orders Status Distribution */}
        <div className={`${shell} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'توزيع حالات أوامر الشراء' : 'PO Status Breakdown'}
              </h3>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {byStatus.length === 0 ? (
              <div className="text-xs text-slate-400">{language === 'ar' ? 'لا توجد بيانات' : 'No status data'}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus.map((s) => ({
                      name: language === 'ar' ? STATUS_LABELS_MAP[s.status]?.ar || s.status : STATUS_LABELS_MAP[s.status]?.en || s.status,
                      value: s.count,
                      color: STATUS_LABELS_MAP[s.status]?.color || '#0d9488',
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {byStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_LABELS_MAP[entry.status]?.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Fulfillment & Backorder Breakdown */}
        <div className={`${shell} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'صحة الاستلام والطلب المتبقي (Fulfillment)' : 'Fulfillment & Backorder Health'}
              </h3>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: language === 'ar' ? 'الكميات الإجمالية' : 'Total Units',
                    ordered: summary.totalOrderedQty || 0,
                    received: summary.totalReceivedQty || 0,
                    backorder: summary.totalBackorderQty || 0,
                  },
                ]}
                margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ordered" name={language === 'ar' ? 'المطلوب' : 'Ordered'} fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="received" name={language === 'ar' ? 'المستلم' : 'Received'} fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="backorder" name={language === 'ar' ? 'المتبقي (Backorder)' : 'Backorder'} fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DYNAMIC INTERACTIVE PIVOT TABLE */}
      <div className={`${shell} p-5 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <TableIcon className="h-4 w-4 text-teal-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'الجدول المحوري التفاعلي (Interactive Pivot Matrix)' : 'Interactive Purchases Pivot Matrix'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ar' ? 'قم بالتجميع حسب البعد المفضل لتحليل البيانات بالتفصيل' : 'Group and analyze purchases data by dynamic dimensions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">{language === 'ar' ? 'تجميع حسب:' : 'Group by:'}</span>
            {[
              { id: 'supplier', label: language === 'ar' ? 'المورد' : 'Supplier' },
              { id: 'product', label: language === 'ar' ? 'المنتج' : 'Product' },
              { id: 'month', label: language === 'ar' ? 'الشهر' : 'Month' },
              { id: 'status', label: language === 'ar' ? 'الحالة' : 'Status' },
            ].map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => setPivotGroupBy(grp.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                  pivotGroupBy === grp.id
                    ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-950'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300'
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pivot Table Rendering */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0c111a]">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50/90 font-bold uppercase tracking-wider text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                <th
                  onClick={() => handleSort('dimension')}
                  className="cursor-pointer p-3 text-start hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    {language === 'ar' ? 'البعد / الفئة' : 'Dimension'}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('poCount')}
                  className="cursor-pointer p-3 text-center hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1">
                    {language === 'ar' ? 'عدد الطلبات' : 'Orders'}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                {pivotGroupBy === 'product' && (
                  <>
                    <th className="p-3 text-center">{language === 'ar' ? 'المطلوب' : 'Ordered'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'المستلم' : 'Received'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'المتبقي' : 'Backorder'}</th>
                    <th className="p-3 text-center">{language === 'ar' ? 'الإنجاز' : 'Fulfillment'}</th>
                  </>
                )}
                <th
                  onClick={() => handleSort('totalSpend')}
                  className="cursor-pointer p-3 text-end hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1">
                    {language === 'ar' ? 'إجمالي المشتريات' : 'Total Spend'}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                {pivotGroupBy !== 'product' && (
                  <>
                    <th
                      onClick={() => handleSort('totalPaid')}
                      className="cursor-pointer p-3 text-end hover:text-slate-900 dark:hover:text-white"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {language === 'ar' ? 'المدفوع' : 'Paid'}
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('balanceDue')}
                      className="cursor-pointer p-3 text-end hover:text-slate-900 dark:hover:text-white"
                    >
                      <div className="flex items-center justify-end gap-1">
                        {language === 'ar' ? 'الرصيد المتبقي' : 'Balance'}
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {sortedPivotData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
                  </td>
                </tr>
              ) : (
                sortedPivotData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {row.dimension || '—'}
                      {row.code && <span className="ms-2 font-mono text-[10px] text-slate-400">({row.code})</span>}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      {row.poCount || 0}
                    </td>
                    {pivotGroupBy === 'product' && (
                      <>
                        <td className="p-3 text-center font-semibold tabular-nums">{row.orderedQty || 0}</td>
                        <td className="p-3 text-center font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{row.receivedQty || 0}</td>
                        <td className="p-3 text-center tabular-nums">
                          {row.backorderQty > 0 ? (
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                              {row.backorderQty}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-teal-700 dark:text-teal-300">{row.fulfillmentRate}%</td>
                      </>
                    )}
                    <td className="p-3 text-end font-bold text-slate-950 dark:text-white tabular-nums">
                      <Money value={row.totalSpend || 0} />
                    </td>
                    {pivotGroupBy !== 'product' && (
                      <>
                        <td className="p-3 text-end font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          <Money value={row.totalPaid || 0} />
                        </td>
                        <td className="p-3 text-end font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          <Money value={row.balanceDue || 0} />
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {/* Total Row */}
            {sortedPivotData.length > 0 && (
              <tfoot className="bg-slate-100/80 font-bold text-slate-900 dark:bg-white/[0.08] dark:text-white border-t-2 border-slate-300 dark:border-white/20">
                <tr>
                  <td className="p-3">{language === 'ar' ? 'الإجمالي العام' : 'Grand Total'}</td>
                  <td className="p-3 text-center tabular-nums">
                    {sortedPivotData.reduce((sum, r) => sum + (r.poCount || 0), 0)}
                  </td>
                  {pivotGroupBy === 'product' && (
                    <>
                      <td className="p-3 text-center tabular-nums">{sortedPivotData.reduce((sum, r) => sum + (r.orderedQty || 0), 0)}</td>
                      <td className="p-3 text-center tabular-nums text-emerald-600 dark:text-emerald-400">{sortedPivotData.reduce((sum, r) => sum + (r.receivedQty || 0), 0)}</td>
                      <td className="p-3 text-center tabular-nums text-amber-600">{sortedPivotData.reduce((sum, r) => sum + (r.backorderQty || 0), 0)}</td>
                      <td className="p-3 text-center">{summary.fulfillmentRate || 0}%</td>
                    </>
                  )}
                  <td className="p-3 text-end tabular-nums">
                    <Money value={sortedPivotData.reduce((sum, r) => sum + (r.totalSpend || 0), 0)} />
                  </td>
                  {pivotGroupBy !== 'product' && (
                    <>
                      <td className="p-3 text-end tabular-nums text-emerald-600 dark:text-emerald-400">
                        <Money value={sortedPivotData.reduce((sum, r) => sum + (r.totalPaid || 0), 0)} />
                      </td>
                      <td className="p-3 text-end tabular-nums text-rose-600 dark:text-rose-400">
                        <Money value={sortedPivotData.reduce((sum, r) => sum + (r.balanceDue || 0), 0)} />
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
