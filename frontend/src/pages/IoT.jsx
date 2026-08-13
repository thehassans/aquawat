import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Cpu, MapPin, Clock, Edit, Wifi, WifiOff,
  Activity, Zap, Radio, Shield, Network, BarChart3,
  Thermometer, Gauge, ArrowUpRight, Settings2, ChevronRight,
  CheckCircle2, AlertCircle, Building2, Globe2, Lock
} from 'lucide-react'
import api from '../lib/api'
import { useTranslation } from '../lib/translations'
import ExportMenu from '../components/ui/ExportMenu'
import { tenantHasEntitlement } from '../lib/appEntitlements'

const iotFeatures = [
  {
    icon: Network,
    titleEn: 'Smart Building Automation',
    titleAr: 'أتمتة المباني الذكية',
    descEn: 'Control HVAC, lighting, and access systems across all your facilities.',
    descAr: 'تحكم في أنظمة التكييف والإضاءة والوصول في جميع مرافقك.',
    color: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20'
  },
  {
    icon: Activity,
    titleEn: 'Real-Time Asset Tracking',
    titleAr: 'تتبع الأصول في الوقت الفعلي',
    descEn: 'Monitor equipment health, location, and performance 24/7.',
    descAr: 'راقب صحة المعدات وموقعها وأدائها على مدار الساعة.',
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20'
  },
  {
    icon: Gauge,
    titleEn: 'Energy Management',
    titleAr: 'إدارة الطاقة',
    descEn: 'Optimize energy consumption with intelligent sensor networks.',
    descAr: 'تحسين استهلاك الطاقة باستخدام شبكات المستشعرات الذكية.',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20'
  },
  {
    icon: Shield,
    titleEn: 'Security & Compliance',
    titleAr: 'الأمان والامتثال',
    descEn: 'End-to-end encrypted IoT data with full audit trail.',
    descAr: 'بيانات إنترنت الأشياء مشفرة بالكامل مع سجل تدقيق شامل.',
    color: 'from-emerald-500 to-green-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20'
  },
]

function PulsingDot({ color = 'bg-emerald-500' }) {
  return (
    <span className="relative inline-flex">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-50`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  )
}

function IoTHeroOrb() {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* Outer rings */}
      <div className="absolute inset-0 rounded-full border border-primary-500/20 animate-ping" style={{ animationDuration: '3s' }} />
      <div className="absolute inset-3 rounded-full border border-primary-500/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      <div className="absolute inset-6 rounded-full border border-primary-500/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
      {/* Main orb */}
      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-primary-400 via-teal-500 to-cyan-600 shadow-2xl shadow-primary-500/40 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        <Network className="w-10 h-10 text-white relative z-10" />
      </div>
      {/* Orbiting nodes */}
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <div
          key={i}
          className="absolute w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 border-2 border-white shadow-lg shadow-cyan-500/40"
          style={{
            top: '50%',
            left: '50%',
            transform: `rotate(${deg}deg) translateX(68px) translateY(-50%)`,
          }}
        />
      ))}
    </div>
  )
}

export default function IoT() {
  const { language } = useSelector((state) => state.ui)
  const { user, tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ status: '', type: '' })
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  const hasIotAddon = tenantHasEntitlement(tenant, { appId: 'iot_devices', flag: 'hasIotAddon' })
  const isSuperAdmin = user?.role === 'super_admin'

  const exportColumns = [
    { key: 'code', label: language === 'ar' ? 'الكود' : 'Code', value: (r) => r?.code || '' },
    { key: 'name', label: language === 'ar' ? 'الاسم' : 'Name', value: (r) => (language === 'ar' ? r?.nameAr || r?.nameEn : r?.nameEn || r?.nameAr) || '' },
    { key: 'type', label: language === 'ar' ? 'النوع' : 'Type', value: (r) => r?.type || '' },
    { key: 'status', label: t('status'), value: (r) => r?.status || '' },
    { key: 'lastSeenAt', label: language === 'ar' ? 'آخر اتصال' : 'Last Seen', value: (r) => (r?.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : '') },
    { key: 'location', label: language === 'ar' ? 'الموقع' : 'Location', value: (r) => (r?.location?.name || r?.location?.zone) ? ((r.location.name || '-') + (r.location.zone ? ` · ${r.location.zone}` : '')) : '' },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['iot-devices', page, search, filters],
    queryFn: () =>
      api.get('/iot/devices', { params: { page, limit: 25, search, status: filters.status, type: filters.type } }).then((res) => res.data),
    enabled: hasIotAddon,
  })

  const getExportRows = async () => {
    const limit = 200
    let currentPage = 1
    let all = []
    while (true) {
      const res = await api.get('/iot/devices', { params: { page: currentPage, limit, search, status: filters.status, type: filters.type } })
      const batch = res.data?.devices || []
      all = all.concat(batch)
      const pages = res.data?.pagination?.pages || 1
      if (currentPage >= pages) break
      currentPage += 1
      if (all.length >= 10000) break
    }
    return all
  }

  const { data: stats } = useQuery({
    queryKey: ['iot-devices-stats'],
    queryFn: () => api.get('/iot/devices/stats').then((res) => res.data),
    enabled: hasIotAddon,
  })

  const totals = stats?.totals?.[0]
  const totalDevices = totals?.total || 0
  const activeDevices = totals?.active || 0
  const maintenanceDevices = totals?.maintenance || 0
  const recentlySeen = stats?.recentlySeen?.[0]?.count || 0

  const devices = data?.devices || []
  const pagination = data?.pagination

  const statusConfig = {
    active: { badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30', dot: 'bg-emerald-500', label: language === 'ar' ? 'نشط' : 'Active' },
    maintenance: { badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30', dot: 'bg-amber-500', label: language === 'ar' ? 'صيانة' : 'Maintenance' },
    inactive: { badge: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border border-gray-500/20', dot: 'bg-gray-400', label: language === 'ar' ? 'غير نشط' : 'Inactive' },
  }

  const typeIconMap = {
    sensor: Thermometer,
    gateway: Radio,
    meter: Gauge,
    tracker: MapPin,
    custom: Cpu,
  }

  const typeLabel = (type) => {
    if (language === 'ar') {
      if (type === 'sensor') return 'حساس'
      if (type === 'gateway') return 'بوابة'
      if (type === 'meter') return 'عداد'
      if (type === 'tracker') return 'متعقب'
      if (type === 'custom') return 'مخصص'
    }
    return type
  }

  // ─── Not subscribed: show premium upsell hero ───
  if (!hasIotAddon && !isSuperAdmin) {
    return (
      <div className="space-y-8 pb-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a2018] via-[#0d2d20] to-[#071810] border border-primary-500/20 p-8 md:p-12"
        >
          {/* Grid bg */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(20,184,166,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.3) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
          {/* Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-start">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/20 border border-primary-500/30 text-primary-400 text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                {language === 'ar' ? 'إضافة بريميوم' : 'Premium Add-on'}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                {language === 'ar' ? (
                  <>حوّل شركتك إلى<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-cyan-400">مؤسسة ذكية</span></>
                ) : (
                  <>Transform Your Corp into a<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-cyan-400">Smart Enterprise</span></>
                )}
              </h1>
              <p className="text-gray-400 text-lg max-w-xl mb-8">
                {language === 'ar'
                  ? 'مقدر يمكّنك من دمج وإدارة بنيتك التحتية الكاملة عبر شبكة إنترنت الأشياء — من المستشعرات إلى الأجهزة والأنظمة المؤسسية.'
                  : 'Maqder enables you to integrate and manage your complete corporate infrastructure through a unified IoT network — from sensors to gateways to enterprise systems.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white">
                  <Lock className="w-5 h-5 text-primary-400" />
                  <div className="text-start">
                    <p className="text-xs text-gray-400">{language === 'ar' ? 'مُفعَّل من قِبل' : 'Activated by'}</p>
                    <p className="font-semibold text-sm">{language === 'ar' ? 'المشرف العام' : 'Super Admin'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-primary-500/10 border border-primary-500/30 text-white">
                  <CheckCircle2 className="w-5 h-5 text-primary-400" />
                  <div className="text-start">
                    <p className="text-xs text-primary-300">{language === 'ar' ? 'يشمل' : 'Includes'}</p>
                    <p className="font-semibold text-sm">{language === 'ar' ? 'أجهزة غير محدودة' : 'Unlimited Devices'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <IoTHeroOrb />
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-medium uppercase tracking-wider">
            {language === 'ar' ? 'ما يشمله الإضافة' : 'What\'s Included'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {iotFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.2 }}
                className={`group relative overflow-hidden rounded-2xl border p-6 ${feature.bg} ${feature.border} transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {language === 'ar' ? feature.titleAr : feature.titleEn}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? feature.descAr : feature.descEn}
                </p>
                <ChevronRight className="absolute bottom-5 end-5 w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center py-6"
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {language === 'ar'
              ? 'تواصل مع مشرفك لتفعيل إضافة إنترنت الأشياء لمؤسستك'
              : 'Contact your administrator to activate the IoT add-on for your organization'}
          </p>
        </motion.div>
      </div>
    )
  }

  // ─── Full IoT dashboard ───
  const statCards = [
    { label: language === 'ar' ? 'إجمالي الأجهزة' : 'Total Devices', value: totalDevices, icon: Cpu, color: 'from-primary-500 to-teal-500', glow: 'shadow-primary-500/25' },
    { label: language === 'ar' ? 'أجهزة نشطة' : 'Active', value: activeDevices, icon: Wifi, color: 'from-emerald-500 to-green-500', glow: 'shadow-emerald-500/25' },
    { label: language === 'ar' ? 'صيانة' : 'Maintenance', value: maintenanceDevices, icon: Settings2, color: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/25' },
    { label: language === 'ar' ? 'آخر 24 ساعة' : 'Active (24h)', value: recentlySeen, icon: Activity, color: 'from-violet-500 to-purple-500', glow: 'shadow-violet-500/25' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-teal-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Network className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'إنترنت الأشياء' : 'Internet of Things'}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <PulsingDot color="bg-emerald-500" />
              {language === 'ar' ? 'نشط' : 'Live'}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm ms-12">
            {language === 'ar' ? 'إدارة الأجهزة وقراءات المستشعرات' : 'Manage devices and sensor readings'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            language={language}
            t={t}
            rows={devices}
            getRows={getExportRows}
            columns={exportColumns}
            fileBaseName="IoT"
            title={language === 'ar' ? 'إنترنت الأشياء' : 'Internet of Things'}
            disabled={isLoading || devices.length === 0}
          />
          <Link to="/iot/devices/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'إضافة جهاز' : 'Add Device'}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card p-5 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50 dark:to-dark-700/30 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 shadow-lg ${stat.glow}`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stat.value.toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث بالكود / الاسم / الموقع...' : 'Search by code / name / location...'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="input ps-10"
            />
          </div>
          <select value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1) }} className="select w-full lg:w-44">
            <option value="">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
            <option value="sensor">{language === 'ar' ? 'حساس' : 'Sensor'}</option>
            <option value="gateway">{language === 'ar' ? 'بوابة' : 'Gateway'}</option>
            <option value="meter">{language === 'ar' ? 'عداد' : 'Meter'}</option>
            <option value="tracker">{language === 'ar' ? 'متعقب' : 'Tracker'}</option>
            <option value="custom">{language === 'ar' ? 'مخصص' : 'Custom'}</option>
          </select>
          <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1) }} className="select w-full lg:w-44">
            <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
            <option value="active">{language === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="inactive">{language === 'ar' ? 'غير نشط' : 'Inactive'}</option>
            <option value="maintenance">{language === 'ar' ? 'صيانة' : 'Maintenance'}</option>
          </select>
          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-dark-700 rounded-xl">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-800 shadow text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <BarChart3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-dark-800 shadow text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Devices */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {isLoading ? (
          <div className="card p-16 flex items-center justify-center">
            <div className="relative">
              <div className="w-14 h-14 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
              <Network className="absolute inset-0 m-auto w-5 h-5 text-primary-500" />
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {devices.map((d, i) => {
                const sc = statusConfig[d.status] || statusConfig.inactive
                const TypeIcon = typeIconMap[d.type] || Cpu
                return (
                  <motion.div
                    key={d._id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="card p-5 group relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-xl"
                  >
                    {/* Status glow */}
                    {d.status === 'active' && (
                      <div className="absolute top-0 end-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500/10 to-teal-500/10 border border-primary-500/20 flex items-center justify-center">
                            <TypeIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">
                              {language === 'ar' ? d.nameAr || d.nameEn : d.nameEn}
                            </p>
                            <p className="text-xs font-mono text-gray-400">{d.code}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </div>

                      {d.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {d.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400 text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                        {d.location?.name || d.location?.zone ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{d.location?.name || d.location?.zone}</span>
                          </div>
                        ) : <div />}
                        {d.lastSeenAt ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 justify-end">
                            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{new Date(d.lastSeenAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                          </div>
                        ) : null}
                      </div>

                      <Link
                        to={`/iot/devices/${d._id}`}
                        className="mt-4 flex items-center justify-between w-full text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 group/link"
                      >
                        <span>{language === 'ar' ? 'تعديل الجهاز' : 'Edit Device'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {devices.length === 0 && (
              <div className="col-span-full card p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Cpu className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {language === 'ar' ? 'لا توجد أجهزة حتى الآن' : 'No devices yet'}
                </p>
                <Link to="/iot/devices/new" className="btn btn-primary mt-4">
                  <Plus className="w-4 h-4" />
                  {language === 'ar' ? 'أضف أول جهاز' : 'Add first device'}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{language === 'ar' ? 'الجهاز' : 'Device'}</th>
                    <th>{language === 'ar' ? 'النوع' : 'Type'}</th>
                    <th>{t('status')}</th>
                    <th>{language === 'ar' ? 'آخر اتصال' : 'Last Seen'}</th>
                    <th>{language === 'ar' ? 'الموقع' : 'Location'}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => {
                    const sc = statusConfig[d.status] || statusConfig.inactive
                    const TypeIcon = typeIconMap[d.type] || Cpu
                    return (
                      <tr key={d._id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                              <TypeIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                {language === 'ar' ? d.nameAr || d.nameEn : d.nameEn}
                              </p>
                              <p className="text-xs font-mono text-gray-400">{d.code}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{typeLabel(d.type)}</span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>
                        <td>
                          {d.lastSeenAt ? (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(d.lastSeenAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td>
                          {d.location?.name || d.location?.zone ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              {(d.location?.name || '-') + (d.location?.zone ? ` · ${d.location.zone}` : '')}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td>
                          <Link to={`/iot/devices/${d._id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'تعديل' : 'Edit'}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {devices.length === 0 && (
                <div className="p-12 text-center">
                  <Cpu className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'لا توجد أجهزة' : 'No devices found'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      {pagination?.pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {language === 'ar' ? 'السابق' : 'Previous'}
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                  page === p ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25' : 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-300 hover:border-primary-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}>
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}
