import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, 
  FileText, 
  Users, 
  Package, 
  AlertTriangle,
  Wallet,
  ShoppingCart,
  Truck,
  ClipboardList,
  Factory,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Receipt,
  Plane,
  BarChart3,
  Calendar,
  Star,
  Mail,
  Building2,
  Boxes,
  Percent,
  Layers,
  LayoutGrid,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ExternalLink
} from 'lucide-react'
import { 
  BarChart,
  Bar,
  Area, 
  Line,
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import Money from '../components/ui/Money'
import { getTenantBusinessTypes } from '../lib/businessTypes'
import { App3DIcon } from '../components/ui/App3DIcon'
import { AppWorkspaceDock } from '../components/dashboard/AppWorkspaceDock'
import { AppVerticalView } from '../components/dashboard/AppVerticalView'

const COLORS = ['rgb(var(--color-primary-500))', '#f59e0b', '#ef4444', 'rgb(var(--color-secondary-500))', '#8b5cf6', '#06b6d4', '#ec4899']
const DASHBOARD_REFRESH_MS = 60 * 1000 // 60s
const DASHBOARD_CHART_REFRESH_MS = 120 * 1000 // 2m

export default function Dashboard() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const navigate = useNavigate()
  const isAr = language === 'ar'

  // Active Tab state: 'overview' or an appId / businessTypeGrant
  const [activeTab, setActiveTab] = useState('overview')

  const businessTypes = getTenantBusinessTypes(tenant)
  const isTrading = businessTypes.includes('trading')

  // Fetch Dashboard Aggregated Data
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
  })

  // Fetch Charts Data
  const { data: revenueData } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: () => api.get('/dashboard/charts/revenue').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
  })

  const { data: expensesData } = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: () => api.get('/dashboard/charts/expenses').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
  })

  // Trading specific stats
  const { data: poStats } = useQuery({
    queryKey: ['dashboard-po-stats'],
    queryFn: () => api.get('/purchase-orders/stats').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: shipmentStats } = useQuery({
    queryKey: ['dashboard-shipment-stats'],
    queryFn: () => api.get('/shipments/stats').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: taskStats } = useQuery({
    queryKey: ['dashboard-task-stats'],
    queryFn: () => api.get('/tasks/stats').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: mrpStats } = useQuery({
    queryKey: ['dashboard-mrp-stats'],
    queryFn: () => api.get('/mrp/stats?multiplier=2').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const { data: mrpTop } = useQuery({
    queryKey: ['dashboard-mrp-top'],
    queryFn: () => api.get('/mrp/suggestions?limit=5&page=1&multiplier=2').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    retry: false,
    enabled: isTrading
  })

  const installedApps = dashboard?.installedApps || []
  const appsOverview = dashboard?.appsOverview || {}

  const payrollPaidNet = (dashboard?.payroll?.stats || []).find((s) => s._id === 'paid')?.totalNet || 0
  const openPoCount = poStats?.totals?.[0]?.openCount || 0
  const inTransitShipments = shipmentStats?.totals?.[0]?.inTransit || 0
  const overdueTasks = taskStats?.overdue?.[0]?.count || 0
  const mrpSuggestions = mrpStats?.totals?.suggestions || 0

  // Top General Stats
  const stats = useMemo(() => [
    {
      label: t('totalRevenue'),
      value: dashboard?.invoices?.total?.revenue || 0,
      format: 'currency',
      icon: TrendingUp,
      color: 'from-primary-500 to-primary-600',
      change: '+12.5%',
      positive: true
    },
    {
      label: isAr ? 'إجمالي الخصومات' : 'Invoice Discounts',
      value: dashboard?.invoices?.total?.discount || 0,
      format: 'currency',
      icon: Percent,
      color: 'from-amber-500 to-amber-600',
      change: isAr ? 'على جميع الفواتير' : 'Across all invoices',
      positive: true
    },
    {
      label: isAr ? 'مصروفات الرواتب' : 'Payroll Expenses',
      value: payrollPaidNet,
      format: 'currency',
      icon: Wallet,
      color: 'from-rose-500 to-rose-600',
      change: isAr ? 'هذا الشهر' : 'This month',
      positive: true
    },
    {
      label: t('totalInvoices'),
      value: dashboard?.invoices?.total?.count || 0,
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      change: '+8.2%',
      positive: true
    },
    {
      label: t('activeEmployees'),
      value: dashboard?.employees?.total || 0,
      icon: Users,
      color: 'from-violet-500 to-violet-600',
      change: '+2',
      positive: true
    },
    ...(isTrading
      ? [
          {
            label: t('lowStockItems'),
            value: dashboard?.products?.lowStock || 0,
            icon: Package,
            color: 'from-amber-500 to-amber-600',
            change: '-3',
            positive: false
          },
          {
            label: isAr ? 'طلبات شراء مفتوحة' : 'Open Purchase Orders',
            value: openPoCount,
            icon: ShoppingCart,
            color: 'from-sky-500 to-sky-600',
            change: isAr ? 'تحت التنفيذ' : 'In progress',
            positive: true
          },
          {
            label: isAr ? 'شحنات قيد النقل' : 'Shipments In Transit',
            value: inTransitShipments,
            icon: Truck,
            color: 'from-indigo-500 to-indigo-600',
            change: isAr ? 'حي' : 'Live',
            positive: true
          },
          {
            label: isAr ? 'مهام متأخرة' : 'Overdue Tasks',
            value: overdueTasks,
            icon: ClipboardList,
            color: 'from-red-500 to-red-600',
            change: isAr ? 'يحتاج متابعة' : 'Needs attention',
            positive: false
          },
          {
            label: isAr ? 'توصيات MRP' : 'MRP Suggestions',
            value: mrpSuggestions,
            icon: Factory,
            color: 'from-secondary-500 to-secondary-600',
            change: isAr ? 'إعادة طلب' : 'Reorder',
            positive: true
          },
        ]
      : []),
  ], [dashboard, payrollPaidNet, openPoCount, inTransitShipments, overdueTasks, mrpSuggestions, isTrading, isAr, t])

  const zatcaStatusData = dashboard?.invoices?.zatcaStatus?.map(s => ({
    name: s._id || 'Pending',
    value: s.count
  })) || []

  const RevenueTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const revenue = payload.find((p) => p.dataKey === 'revenue')?.value
    const expenses = payload.find((p) => p.dataKey === 'expenses')?.value
    return (
      <div className="bg-slate-800 text-white rounded-xl px-3 py-2 text-sm shadow-xl border border-slate-700">
        {typeof revenue === 'number' && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{isAr ? 'الإيرادات' : 'Revenue'}</span>
            <Money value={revenue} minimumFractionDigits={0} maximumFractionDigits={0} />
          </div>
        )}
        {typeof expenses === 'number' && (
          <div className="flex items-center justify-between gap-3 mt-1">
            <span className="text-slate-300">{isAr ? 'المصروفات' : 'Expenses'}</span>
            <Money value={expenses} minimumFractionDigits={0} maximumFractionDigits={0} />
          </div>
        )}
      </div>
    )
  }

  const trendData = useMemo(() => {
    const byKey = new Map()

    ;(revenueData || []).forEach((r) => {
      const key = `${r._id?.year}-${r._id?.month}`
      byKey.set(key, { ...byKey.get(key), year: r._id?.year, month: r._id?.month, revenue: r.revenue || 0, tax: r.tax || 0 })
    })

    ;(expensesData || []).forEach((e) => {
      const key = `${e._id?.year}-${e._id?.month}`
      byKey.set(key, { ...byKey.get(key), year: e._id?.year, month: e._id?.month, expenses: (e.salaries || 0) + (e.gosi || 0) + (e.other || 0) })
    })

    const items = Array.from(byKey.values())
      .filter((x) => x.year && x.month)
      .sort((a, b) => (a.year - b.year) || (a.month - b.month))
      .slice(-12)

    return items.map((x) => {
      const label = new Date(x.year, x.month - 1, 1).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
        month: 'short'
      })
      return { ...x, label }
    })
  }, [expensesData, revenueData, isAr])

  const invoiceStatusData = (dashboard?.invoices?.byStatus || []).map((s) => ({
    name: s._id || 'unknown',
    value: s.count || 0
  }))

  // Available tabs
  const tabItems = useMemo(() => {
    const tabs = [
      { id: 'overview', label: isAr ? 'النظرة العامة وجميع التطبيقات' : 'Overview & Workspaces', icon: LayoutGrid }
    ]

    installedApps.forEach(app => {
      const grant = app.businessTypeGrant || app.appId
      tabs.push({
        id: grant,
        label: isAr ? app.nameAr || app.nameEn : app.nameEn || app.nameAr,
        appId: app.appId,
        icon: app.icon
      })
    })

    return tabs
  }, [installedApps, isAr])

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-dark-700 rounded-xl w-1/4" />
        <div className="h-36 bg-gray-200 dark:bg-dark-700 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-6 h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Header & App Store Shortcut */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {t('dashboard')}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-ping" />
              {installedApps.length} {isAr ? 'تطبيق مفعّل' : 'Active Apps'}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {isAr 
              ? 'مرحباً بعودتك! مركز القيادة الموحد لجميع مساحات العمل والتطبيقات التشغيلية' 
              : "Welcome back! Unified command center for all business verticals and operational apps"}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-xl shadow-md shadow-primary-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'فاتورة جديدة' : 'New Invoice'}</span>
          </Link>

          <Link
            to="/app/dashboard/app-store"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-xl border border-gray-200/80 dark:border-dark-700 shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{isAr ? 'متجر التطبيقات' : 'App Store'}</span>
          </Link>
        </div>
      </div>

      {/* Modern App Switcher Tab Bar */}
      {tabItems.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-dark-700">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id
            const IconComp = tab.icon || LayoutGrid
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25 scale-[1.02]'
                    : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-200/70 dark:border-dark-700/70'
                }`}
              >
                {tab.appId ? (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <App3DIcon appId={tab.appId} icon={tab.icon} className="w-5 h-5" />
                  </div>
                ) : (
                  <IconComp className="w-4 h-4" />
                )}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Today's Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 bg-gradient-to-r from-[#143120] via-[#1b432c] to-[#26593b] text-white shadow-xl relative overflow-hidden"
            >
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-inner">
                    <Calendar className="w-7 h-7 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-emerald-200/80 text-xs font-semibold uppercase tracking-wider">
                      {isAr ? 'ملخص العمليات الفورية' : "Today's Live Summary"}
                    </p>
                    <p className="text-lg font-bold text-white mt-0.5">
                      {new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8">
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'فواتير اليوم' : "Today's Invoices"}</p>
                    <p className="text-2xl font-black mt-0.5">{dashboard?.todayStats?.count || 0}</p>
                  </div>
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'إيرادات اليوم' : "Today's Revenue"}</p>
                    <p className="text-2xl font-black mt-0.5">
                      <Money value={dashboard?.todayStats?.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </p>
                  </div>
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'إيرادات الشهر' : 'Monthly Revenue'}</p>
                    <p className="text-2xl font-black mt-0.5">
                      <Money value={dashboard?.invoices?.thisMonth?.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </p>
                  </div>
                  <div className="text-center md:text-end">
                    <p className="text-white/70 text-xs font-medium">{isAr ? 'قيمة المخزون' : 'Inventory Value'}</p>
                    <p className="text-2xl font-black mt-0.5">
                      <Money value={dashboard?.products?.totalValue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Installed Apps Live Command Grid */}
            <AppWorkspaceDock 
              installedApps={installedApps}
              appsOverview={appsOverview}
              language={language}
              onSelectAppTab={(grant) => setActiveTab(grant)}
            />

            {/* Master Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="stat-card xl:col-span-2"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-md text-white`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-bold ${
                      stat.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {stat.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {stat.format === 'currency' ? <Money value={stat.value} minimumFractionDigits={0} maximumFractionDigits={0} /> : stat.value.toLocaleString()}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Multi-stream Revenue vs Expenses Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-2 card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'الإيرادات التشغيلية مقابل المصروفات' : 'Multi-Stream Revenue vs Expenses'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAr ? 'تتبع التدفق المالي الشهري على مدار 12 شهراً' : 'Monthly financial trend tracking across all vertical revenue streams'}
                    </p>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgb(var(--color-primary-500))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="rgb(var(--color-primary-500))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        content={<RevenueTooltip />}
                      />
                      <Legend
                        verticalAlign="top"
                        height={32}
                        formatter={(value) => (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {value === 'revenue' ? (isAr ? 'الإيرادات' : 'Revenue') : (isAr ? 'المصروفات' : 'Expenses')}
                          </span>
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="rgb(var(--color-primary-500))"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExpenses)"
                      />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* ZATCA Clearance Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="card p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      {t('zatcaStatus')}
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {isAr ? 'المرحلة 2' : 'Phase 2'}
                    </span>
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={zatcaStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {zatcaStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
                  {zatcaStatusData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate capitalize">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Bottom Row: Recent Invoices & Expiring Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices with ZATCA Pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {t('recentInvoices')}
                  </h3>
                  <Link to="/invoices" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'عرض الكل' : 'View All'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(dashboard?.recentInvoices || []).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      {isAr ? 'لا توجد فواتير بعد' : 'No invoices yet'}
                    </div>
                  ) : (
                    dashboard?.recentInvoices?.map((invoice) => (
                      <div key={invoice._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                            invoice.zatca?.submissionStatus === 'cleared' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                            invoice.zatca?.submissionStatus === 'reported' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            invoice.zatca?.submissionStatus === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                            'bg-amber-100 dark:bg-amber-900/30'
                          }`}>
                            {invoice.zatca?.submissionStatus === 'cleared' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                             invoice.zatca?.submissionStatus === 'rejected' ? <XCircle className="w-4 h-4 text-red-600" /> :
                             <Clock className="w-4 h-4 text-amber-600" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{invoice.buyer?.name || (isAr ? 'عميل نقدي' : 'Cash Customer')}</p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            <Money value={invoice.grandTotal} minimumFractionDigits={0} maximumFractionDigits={0} />
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(invoice.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Expiring Government Documents & Iqamas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {t('expiringDocuments')}
                    </h3>
                    <span className="badge badge-warning text-[10px]">
                      <AlertTriangle className="w-3 h-3 me-1" />
                      {dashboard?.expiringDocuments?.length || 0}
                    </span>
                  </div>
                  <Link to="/app/dashboard/tenant-settings/government-integrations" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'بوابة الامتثال' : 'Gov Portal'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {dashboard?.expiringDocuments?.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                      {isAr ? 'جميع الوثائق والإقامات سارية ومتوافقة' : 'All documents and Iqamas are valid & compliant'}
                    </div>
                  ) : (
                    dashboard?.expiringDocuments?.map((doc) => (
                      <div key={doc._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">{doc.fullName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{doc.documentType}</p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="text-xs font-bold text-red-600">
                            {new Date(doc.expiryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            {/* Customers & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Customers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {isAr ? 'أحدث العملاء' : 'Recent Customers'}
                  </h3>
                  <Link to="/customers" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'عرض الكل' : 'View All'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(dashboard?.recentCustomers || []).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>{isAr ? 'لا يوجد عملاء بعد' : 'No customers yet'}</p>
                      <Link to="/customers/new" className="text-primary-600 text-xs font-bold mt-2 inline-block">
                        {isAr ? '+ إضافة أول عميل' : '+ Add first customer'}
                      </Link>
                    </div>
                  ) : (
                    (dashboard?.recentCustomers || []).map((customer) => (
                      <div key={customer._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            customer.type === 'business' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
                          }`}>
                            {customer.type === 'business' ? 
                              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /> :
                              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                            }
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">
                              {isAr ? customer.nameAr || customer.name : customer.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-end">
                          <span className={`badge ${customer.type === 'business' ? 'badge-primary' : 'badge-success'}`}>
                            {customer.type === 'business' ? (isAr ? 'شركة' : 'Business') : (isAr ? 'فرد' : 'Individual')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Top Selling Products */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="card"
              >
                <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {isAr ? 'أفضل المنتجات مبيعاً' : 'Top Selling Products'}
                  </h3>
                  <Link to="/products" className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1">
                    {isAr ? 'عرض الكل' : 'View All'}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(dashboard?.topProducts || []).length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>{isAr ? 'لا توجد مبيعات منتجات بعد' : 'No product sales yet'}</p>
                    </div>
                  ) : (
                    (dashboard?.topProducts || []).map((product, index) => (
                      <div key={product._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                            index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {index === 0 ? <Star className="w-4 h-4" /> : index + 1}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">
                              {isAr ? product.nameAr || product.name : product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {isAr ? 'الكمية المباعة' : 'Qty Sold'}: {product.totalQty}
                            </p>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            <Money value={product.totalRevenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{isAr ? 'إجمالي المبيعات' : 'Total Sales'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>

            {/* Trading Supply Chain Cards (PO, Shipments, MRP) */}
            {isTrading && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="card"
                >
                  <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'أحدث طلبات الشراء' : 'Recent Purchase Orders'}
                    </h3>
                    <Link to="/app/dashboard/purchase-orders" className="text-xs text-primary-600 font-bold">
                      {isAr ? 'الكل' : 'All'}
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(poStats?.recent || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        {isAr ? 'لا توجد بيانات' : 'No data'}
                      </div>
                    ) : (
                      (poStats?.recent || []).map((po) => (
                        <div key={po._id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-gray-900 dark:text-white">{po.poNumber}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{po.status}</p>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-xs text-gray-900 dark:text-white">
                              <Money value={po.grandTotal || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className="card"
                >
                  <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'أحدث الشحنات' : 'Recent Shipments'}
                    </h3>
                    <Link to="/app/dashboard/shipments" className="text-xs text-primary-600 font-bold">
                      {isAr ? 'الكل' : 'All'}
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(shipmentStats?.recent || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        {isAr ? 'لا توجد بيانات' : 'No data'}
                      </div>
                    ) : (
                      (shipmentStats?.recent || []).map((s) => (
                        <div key={s._id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-gray-900 dark:text-white">{s.shipmentNumber}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{s.status} • {s.type}</p>
                          </div>
                          <div className="text-end">
                            <p className="text-[10px] text-gray-400">
                              {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="card"
                >
                  <div className="p-5 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {isAr ? 'توصيات MRP' : 'MRP Suggestions'}
                    </h3>
                    <span className="badge badge-neutral text-xs">{mrpSuggestions}</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {(mrpTop?.suggestions || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">
                        {isAr ? 'لا توجد توصيات حالياً' : 'No suggestions right now'}
                      </div>
                    ) : (
                      (mrpTop?.suggestions || []).map((row) => (
                        <div key={row.productId} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-gray-900 dark:text-white">
                              {isAr ? row.nameAr || row.nameEn : row.nameEn || row.nameAr}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {row.sku} • {isAr ? 'الكمية' : 'Qty'}: {Math.round(row.recommendedQty || 0)}
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-xs text-gray-900 dark:text-white">
                              <Money value={row.estimatedCost || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <AppVerticalView
              verticalKey={activeTab}
              appsOverview={appsOverview}
              language={language}
              tenant={tenant}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
