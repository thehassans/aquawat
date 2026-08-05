import { useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
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
  UserPlus,
  Receipt,
  Plane,
  BarChart3,
  Calendar,
  Star,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Boxes,
  Percent
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

const COLORS = ['rgb(var(--color-primary-500))', '#f59e0b', '#ef4444', 'rgb(var(--color-secondary-500))']
const DASHBOARD_REFRESH_MS = 60 * 1000 // 60s
const DASHBOARD_CHART_REFRESH_MS = 120 * 1000 // 2m

export default function Dashboard() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const navigate = useNavigate()

  const businessTypes = getTenantBusinessTypes(tenant)
  const isTrading = businessTypes.includes('trading')
  const isTravelAgency = businessTypes.includes('travel_agency')
  const isRestaurant = businessTypes.includes('restaurant')
  const isBoutique = businessTypes.includes('boutique')
  const isBakala = businessTypes.includes('bakala')
  const isSaloon = businessTypes.includes('saloon')
  const isLaundry = businessTypes.includes('laundry')
  const isKhayyat = businessTypes.includes('khayyat')
  const isBookstore = businessTypes.includes('bookstore')
  const isEcommerce = businessTypes.includes('ecommerce')
  const isFurniture = businessTypes.includes('furniture') || businessTypes.includes('furniture_shop')
  
  const isPosRedirected = isBoutique || isBakala || isSaloon || isLaundry || isRestaurant || isKhayyat || isBookstore || isFurniture || isEcommerce

  // Redirect POS tenants directly to their checkout screen
  useEffect(() => {
    if (isBoutique) {
      navigate('/app/dashboard/boutique/pos', { replace: true })
    } else if (isBakala) {
      navigate('/app/dashboard/bakala/pos', { replace: true })
    } else if (isSaloon) {
      navigate('/app/saloon/pos', { replace: true })
    } else if (isLaundry) {
      navigate('/app/laundry/pos', { replace: true })
    } else if (isRestaurant) {
      navigate('/app/dashboard/restaurant/pos', { replace: true })
    } else if (isKhayyat) {
      navigate('/app/dashboard/khayyat/analytics', { replace: true })
    } else if (isBookstore) {
      navigate('/app/dashboard/bookstore/pos', { replace: true })
    } else if (isFurniture) {
      navigate('/app/dashboard/furniture/pos', { replace: true })
    } else if (isEcommerce) {
      navigate('/app/dashboard/ecommerce', { replace: true })
    }
  }, [isBoutique, isBakala, isSaloon, isLaundry, isRestaurant, isKhayyat, isBookstore, isFurniture, isEcommerce, navigate])

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    enabled: !isPosRedirected
  })

  const { data: revenueData } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: () => api.get('/dashboard/charts/revenue').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    enabled: !isPosRedirected
  })

  const { data: expensesData } = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: () => api.get('/dashboard/charts/expenses').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    enabled: !isPosRedirected
  })

  const { data: poStats } = useQuery({
    queryKey: ['dashboard-po-stats'],
    queryFn: () => api.get('/purchase-orders/stats').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: !isPosRedirected && isTrading
  })

  const { data: shipmentStats } = useQuery({
    queryKey: ['dashboard-shipment-stats'],
    queryFn: () => api.get('/shipments/stats').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: !isPosRedirected && isTrading
  })

  const { data: taskStats } = useQuery({
    queryKey: ['dashboard-task-stats'],
    queryFn: () => api.get('/tasks/stats').then(res => res.data),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS,
    retry: false,
    enabled: !isPosRedirected && isTrading
  })

  const { data: mrpStats } = useQuery({
    queryKey: ['dashboard-mrp-stats'],
    queryFn: () => api.get('/mrp/stats?multiplier=2').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    retry: false,
    enabled: !isPosRedirected && isTrading
  })

  const { data: mrpTop } = useQuery({
    queryKey: ['dashboard-mrp-top'],
    queryFn: () => api.get('/mrp/suggestions?limit=5&page=1&multiplier=2').then(res => res.data),
    refetchInterval: DASHBOARD_CHART_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_CHART_REFRESH_MS,
    retry: false,
    enabled: !isPosRedirected && isTrading
  })

  const payrollPaidNet = (dashboard?.payroll?.stats || []).find((s) => s._id === 'paid')?.totalNet || 0
  const openPoCount = poStats?.totals?.[0]?.openCount || 0
  const inTransitShipments = shipmentStats?.totals?.[0]?.inTransit || 0
  const overdueTasks = taskStats?.overdue?.[0]?.count || 0
  const mrpSuggestions = mrpStats?.totals?.suggestions || 0

  const openTravelBookings = dashboard?.travel?.totals?.[0]?.open || 0
  const travelRevenue = dashboard?.travel?.totals?.[0]?.revenue || 0
  const openRestaurantOrders = dashboard?.restaurant?.totals?.[0]?.open || 0
  const restaurantRevenue = dashboard?.restaurant?.totals?.[0]?.revenue || 0

  const stats = [
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
      label: language === 'ar' ? 'إجمالي الخصومات' : 'Invoice Discounts',
      value: dashboard?.invoices?.total?.discount || 0,
      format: 'currency',
      icon: Percent,
      color: 'from-amber-500 to-amber-600',
      change: language === 'ar' ? 'على جميع الفواتير' : 'Across all invoices',
      positive: true
    },
    {
      label: language === 'ar' ? 'مصروفات الرواتب' : 'Payroll Expenses',
      value: payrollPaidNet,
      format: 'currency',
      icon: Wallet,
      color: 'from-rose-500 to-rose-600',
      change: language === 'ar' ? 'هذا الشهر' : 'This month',
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
    ...(isTravelAgency
      ? [
          {
            label: language === 'ar' ? 'حجوزات مفتوحة' : 'Open Bookings',
            value: openTravelBookings,
            icon: Plane,
            color: 'from-sky-500 to-sky-600',
            change: language === 'ar' ? 'قيد المتابعة' : 'In progress',
            positive: true,
          },
          {
            label: language === 'ar' ? 'إيرادات الحجوزات' : 'Booking Revenue',
            value: travelRevenue,
            format: 'currency',
            icon: TrendingUp,
            color: 'from-emerald-500 to-emerald-600',
            change: language === 'ar' ? 'إجمالي' : 'Total',
            positive: true,
          },
        ]
      : []),
    ...(isRestaurant
      ? [
          {
            label: language === 'ar' ? 'طلبات مفتوحة' : 'Open Orders',
            value: openRestaurantOrders,
            icon: Receipt,
            color: 'from-amber-500 to-amber-600',
            change: language === 'ar' ? 'قيد التحضير' : 'In progress',
            positive: true,
          },
          {
            label: language === 'ar' ? 'إيرادات الطلبات' : 'Order Revenue',
            value: restaurantRevenue,
            format: 'currency',
            icon: TrendingUp,
            color: 'from-emerald-500 to-emerald-600',
            change: language === 'ar' ? 'إجمالي' : 'Total',
            positive: true,
          },
        ]
      : []),
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
            label: language === 'ar' ? 'طلبات شراء مفتوحة' : 'Open Purchase Orders',
            value: openPoCount,
            icon: ShoppingCart,
            color: 'from-sky-500 to-sky-600',
            change: language === 'ar' ? 'تحت التنفيذ' : 'In progress',
            positive: true
          },
          {
            label: language === 'ar' ? 'شحنات قيد النقل' : 'Shipments In Transit',
            value: inTransitShipments,
            icon: Truck,
            color: 'from-indigo-500 to-indigo-600',
            change: language === 'ar' ? 'حي' : 'Live',
            positive: true
          },
          {
            label: language === 'ar' ? 'مهام متأخرة' : 'Overdue Tasks',
            value: overdueTasks,
            icon: ClipboardList,
            color: 'from-red-500 to-red-600',
            change: language === 'ar' ? 'يحتاج متابعة' : 'Needs attention',
            positive: false
          },
          {
            label: language === 'ar' ? 'توصيات MRP' : 'MRP Suggestions',
            value: mrpSuggestions,
            icon: Factory,
            color: 'from-secondary-500 to-secondary-600',
            change: language === 'ar' ? 'إعادة طلب' : 'Reorder',
            positive: true
          },
        ]
      : []),
  ]

  const zatcaStatusData = dashboard?.invoices?.zatcaStatus?.map(s => ({
    name: s._id || 'Pending',
    value: s.count
  })) || []

  const RevenueTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const revenue = payload.find((p) => p.dataKey === 'revenue')?.value
    const expenses = payload.find((p) => p.dataKey === 'expenses')?.value
    return (
      <div className="bg-slate-800 text-white rounded-xl px-3 py-2 text-sm">
        {typeof revenue === 'number' && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-300">{language === 'ar' ? 'الإيرادات' : 'Revenue'}</span>
            <Money value={revenue} minimumFractionDigits={0} maximumFractionDigits={0} />
          </div>
        )}
        {typeof expenses === 'number' && (
          <div className="flex items-center justify-between gap-3 mt-1">
            <span className="text-slate-300">{language === 'ar' ? 'المصروفات' : 'Expenses'}</span>
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
      const label = new Date(x.year, x.month - 1, 1).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short'
      })
      return { ...x, label }
    })
  }, [expensesData, revenueData, language])

  const invoiceStatusData = (dashboard?.invoices?.byStatus || []).map((s) => ({
    name: s._id || 'unknown',
    value: s.count || 0
  }))

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-6">
              <div className="skeleton h-4 w-24 mb-3" />
              <div className="skeleton h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'مرحباً بعودتك! إليك نظرة عامة على أعمالك' : 'Welcome back! Here\'s an overview of your business'}
          </p>
        </div>
      </div>

      {/* Today's Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 bg-gradient-to-r from-[#1a3d28] to-[#2d5a3f] text-white"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white/70 text-sm">{language === 'ar' ? 'ملخص اليوم' : "Today's Summary"}</p>
              <p className="text-lg font-semibold">
                {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <div className="text-center md:text-end">
              <p className="text-white/70 text-sm">{language === 'ar' ? 'فواتير اليوم' : "Today's Invoices"}</p>
              <p className="text-2xl font-bold">{dashboard?.todayStats?.count || 0}</p>
            </div>
            <div className="text-center md:text-end">
              <p className="text-white/70 text-sm">{language === 'ar' ? 'إيرادات اليوم' : "Today's Revenue"}</p>
              <p className="text-2xl font-bold">
                <Money value={dashboard?.todayStats?.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
            </div>
            <div className="text-center md:text-end">
              <p className="text-white/70 text-sm">{language === 'ar' ? 'إيرادات الشهر' : 'Monthly Revenue'}</p>
              <p className="text-2xl font-bold">
                <Money value={dashboard?.invoices?.thisMonth?.revenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
            </div>
            <div className="text-center md:text-end">
              <p className="text-white/70 text-sm">{language === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}</p>
              <p className="text-2xl font-bold">
                <Money value={dashboard?.products?.totalValue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="stat-card xl:col-span-2"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <span className={`flex items-center gap-1 text-sm font-medium ${
                stat.positive ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {stat.positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {stat.change}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.format === 'currency' ? <Money value={stat.value} minimumFractionDigits={0} maximumFractionDigits={0} /> : stat.value.toLocaleString()}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 card p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {language === 'ar' ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'}
          </h3>
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
                      {value === 'revenue' ? (language === 'ar' ? 'الإيرادات' : 'Revenue') : (language === 'ar' ? 'المصروفات' : 'Expenses')}
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

        {/* ZATCA Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {t('zatcaStatus')}
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zatcaStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
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
          <div className="grid grid-cols-2 gap-2 mt-4">
            {zatcaStatusData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="card p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {language === 'ar' ? 'حالة الفواتير' : 'Invoice Status'}
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invoiceStatusData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="rgb(var(--color-secondary-500))" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
        >
          <div className="p-6 border-b border-gray-100 dark:border-dark-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('recentInvoices')}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {dashboard?.recentInvoices?.map((invoice) => (
              <div key={invoice._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
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
                    <p className="font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.buyer?.name}</p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    <Money value={invoice.grandTotal} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(invoice.issueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Expiring Documents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="card"
        >
          <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('expiringDocuments')}
            </h3>
            <span className="badge badge-warning">
              <AlertTriangle className="w-3 h-3 me-1" />
              {dashboard?.expiringDocuments?.length || 0}
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {dashboard?.expiringDocuments?.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {language === 'ar' ? 'لا توجد وثائق تنتهي قريباً' : 'No documents expiring soon'}
              </div>
            ) : (
              dashboard?.expiringDocuments?.map((doc) => (
                <div key={doc._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{doc.fullName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{doc.documentType}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-medium text-red-600">
                      {new Date(doc.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Customers & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          className="card"
        >
          <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {language === 'ar' ? 'أحدث العملاء' : 'Recent Customers'}
            </h3>
            <Link to="/customers" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              {language === 'ar' ? 'عرض الكل' : 'View All'}
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {(dashboard?.recentCustomers || []).length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{language === 'ar' ? 'لا يوجد عملاء بعد' : 'No customers yet'}</p>
                <Link to="/customers/new" className="text-primary-600 text-sm mt-2 inline-block">
                  {language === 'ar' ? 'إضافة أول عميل' : 'Add first customer'}
                </Link>
              </div>
            ) : (
              (dashboard?.recentCustomers || []).map((customer) => (
                <div key={customer._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      customer.type === 'business' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
                    }`}>
                      {customer.type === 'business' ? 
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" /> :
                        <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {language === 'ar' ? customer.nameAr || customer.name : customer.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className={`badge ${customer.type === 'business' ? 'badge-primary' : 'badge-success'}`}>
                      {customer.type === 'business' ? (language === 'ar' ? 'شركة' : 'Business') : (language === 'ar' ? 'فرد' : 'Individual')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {isTrading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.74 }}
            className="card"
          >
            <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'أفضل المنتجات مبيعاً' : 'Top Selling Products'}
              </h3>
              <Link to="/products" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                {language === 'ar' ? 'عرض الكل' : 'View All'}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700">
              {(dashboard?.topProducts || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{language === 'ar' ? 'لا توجد مبيعات بعد' : 'No sales yet'}</p>
                </div>
              ) : (
                (dashboard?.topProducts || []).map((product, index) => (
                  <div key={product._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
                        index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {index === 0 ? <Star className="w-4 h-4" /> : index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {language === 'ar' ? product.nameAr || product.name : product.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {language === 'ar' ? 'الكمية المباعة' : 'Qty Sold'}: {product.totalQty}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        <Money value={product.totalRevenue || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </div>

      {isTrading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.76 }}
            className="card"
          >
            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'أحدث طلبات الشراء' : 'Recent Purchase Orders'}
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700">
              {(poStats?.recent || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
                </div>
              ) : (
                (poStats?.recent || []).map((po) => (
                  <div key={po._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{po.poNumber}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{po.status}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        <Money value={po.grandTotal || 0} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {po.orderDate ? new Date(po.orderDate).toLocaleDateString() : ''}
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
            transition={{ delay: 0.78 }}
            className="card"
          >
            <div className="p-6 border-b border-gray-100 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'أحدث الشحنات' : 'Recent Shipments'}
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700">
              {(shipmentStats?.recent || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
                </div>
              ) : (
                (shipmentStats?.recent || []).map((s) => (
                  <div key={s._id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{s.shipmentNumber}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{s.status} • {s.type}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString() : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {s.expectedDelivery ? new Date(s.expectedDelivery).toLocaleDateString() : ''}
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
            transition={{ delay: 0.80 }}
            className="card"
          >
            <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {language === 'ar' ? 'توصيات MRP' : 'MRP Suggestions'}
              </h3>
              <span className="badge badge-neutral">{mrpSuggestions}</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700">
              {(mrpTop?.suggestions || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'لا توجد توصيات حالياً' : 'No suggestions right now'}
                </div>
              ) : (
                (mrpTop?.suggestions || []).map((row) => (
                  <div key={row.productId} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {language === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {row.sku} • {language === 'ar' ? 'الكمية' : 'Qty'}: {Math.round(row.recommendedQty || 0)}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold text-gray-900 dark:text-white">
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
    </div>
  )
}
