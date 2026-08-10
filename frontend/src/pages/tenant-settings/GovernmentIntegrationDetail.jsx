import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Shield, CheckCircle, XCircle, RefreshCw, Server,
  AlertTriangle, Key, Calendar, FileText, Check,
  Zap, Activity, Info, TrendingUp, AlertCircle, Clock
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { updateTenant } from '../../store/slices/authSlice'

function formatDateTime(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString([], { 
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    })
  } catch { return '-' }
}

function timeAgo(value) {
  if (!value) return '-'
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const STATUS_STYLES = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/30', icon: CheckCircle, label: 'SUCCESS' },
  failed: { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-900/30', icon: XCircle, label: 'FAILED' },
  pending: { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/30', icon: Clock, label: 'PENDING' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-900/30', icon: Info, label: 'INFO' },
}

export default function GovernmentIntegrationDetail() {
  const { service } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dispatch = useDispatch()
  const { language } = useSelector(state => state.ui)
  const { tenant } = useSelector(state => state.auth)
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en
  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'

  const [testResult, setTestResult] = useState(null)
  const [logFilter, setLogFilter] = useState('all')

  // 1. Fetch dashboard data (real API)
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['gov-integration-dashboard', service],
    queryFn: () => api.get(`/tenant/compliance/${service}/dashboard`).then(res => res.data),
    refetchInterval: 10000,
  })

  // 2. Fetch paginated logs (real API)
  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['gov-integration-logs', service, logFilter],
    queryFn: () => api.get(`/tenant/compliance/${service}/logs`, { 
      params: { page: 1, limit: 50, status: logFilter === 'all' ? undefined : logFilter } 
    }).then(res => res.data),
  })

  // 3. Test Connection Mutation
  const testConnectionMutation = useMutation({
    mutationFn: () => api.post('/tenant/compliance/config/test-connection', { service }).then(res => res.data),
    onSuccess: async (res) => {
      setTestResult(res)
      if (res.success) {
        toast.success(t('Connection test passed successfully!', 'نجح اختبار الاتصال بنجاح!'))
        // Refresh tenant data so sidebar updates with new sub-menus
        try {
          const { data: tenantData } = await api.get('/auth/me')
          if (tenantData?.tenant) dispatch(updateTenant(tenantData.tenant))
        } catch (e) { /* best-effort */ }
        queryClient.invalidateQueries(['gov-integration-dashboard', service])
        queryClient.invalidateQueries(['gov-integration-logs', service])
        queryClient.invalidateQueries(['government-integrations-config'])
      } else {
        toast.error(t('Connection check failed.', 'فشل فحص الاتصال.'))
      }
    },
    onError: (err) => {
      setTestResult({ success: false, message: err.response?.data?.error || 'Connection handshake timeout.' })
      toast.error(t('Handshake test failed.', 'فشل اختبار الاتصال.'))
    }
  })

  // 4. Manual Sync Mutation
  const syncMutation = useMutation({
    mutationFn: () => api.post(`/tenant/compliance/${service}/sync`).then(res => res.data),
    onSuccess: (res) => {
      toast.success(t('Sync completed successfully!', 'اكتملت المزامنة بنجاح!'))
      queryClient.invalidateQueries(['gov-integration-dashboard', service])
      queryClient.invalidateQueries(['gov-integration-logs', service])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || t('Sync failed.', 'فشلت المزامنة.'))
    }
  })

  // Service metadata
  const getServiceMeta = () => {
    switch (service) {
      case 'zatca': {
        const isPhase2 = dashboard?.stats?.phase === 2;
        return {
          title: isPhase2
            ? t('ZATCA Integration (Fatoora Phase 2)', 'ربط هيئة الزكاة والضريبة والجمارك (فاتورة المرحلة 2)')
            : t('ZATCA Integration (Fatoora Phase 1)', 'ربط هيئة الزكاة والضريبة والجمارك (فاتورة المرحلة الأولى)'),
          subtitle: isPhase2
            ? t('Monitor XML invoice clearance, cryptographic stamps, and compliance reports.', 'مراقبة اعتماد فواتير XML، الأختام الرقمية، وتقارير الامتثال.')
            : t('Generate ZATCA-compliant QR codes and locally-signed XML invoices. No live portal submission required for Phase 1.', 'إنشاء رموز QR وفواتير XML موقعة محلياً متوافقة مع الزكاة. لا يتطلب المرحلة الأولى إرسالاً مباشراً للبوابة.'),
          icon: Shield,
          gradient: 'from-emerald-500 to-teal-600',
          accent: 'emerald',
          endpoint: 'zatca.gov.sa/fatoora',
          protocol: isPhase2 ? 'OAuth 2.0 (mTLS)' : 'Local XML / TLV QR',
        }
      }
      case 'elm':
        return {
          title: t('Elm DevPortal (Yakeen & Tamm)', 'بوابة علم (خدمات يقين وتم)'),
          subtitle: t('Identity verification, Nafath OTP, and MOT contract registration.', 'التحقق من الهوية، نفاذ OTP، وتسجيل عقود وزارة النقل.'),
          icon: Key,
          gradient: 'from-blue-500 to-indigo-600',
          accent: 'blue',
          endpoint: 'devportal.elm.sa/api',
          protocol: 'OAuth 2.0',
        }
      case 'qiwa':
        return {
          title: t('Qiwa & MHRSD Integration', 'بوابة قوى (وزارة الموارد البشرية)'),
          subtitle: t('Establishment contracts, auto-sign automation, and Saudization tracking.', 'عقود المنشأة، الأتمتة التلقائية للتوقيع، ومتابعة التوطين.'),
          icon: Server,
          gradient: 'from-amber-500 to-orange-600',
          accent: 'amber',
          endpoint: 'api.qiwa.sa',
          protocol: 'Bearer Token',
        }
      case 'gosi':
        return {
          title: t('GOSI & Mudad (WPS)', 'التأمينات ومدد (حماية الأجور)'),
          subtitle: t('Wage Protection SIF files, payroll approvals, and GOSI certificates.', 'ملفات حماية الأجور SIF، موافقات الرواتب، وشهادات التأمينات.'),
          icon: FileText,
          gradient: 'from-purple-500 to-pink-600',
          accent: 'purple',
          endpoint: 'mudad.com.sa/api',
          protocol: 'mTLS + Client Cert',
        }
      default:
        return null
    }
  }

  const meta = getServiceMeta()

  if (!isSarCurrencyTenant) {
    return (
      <div className="card p-8 text-center space-y-4">
        <Shield className="w-12 h-12 text-gray-400 mx-auto" />
        <h3 className="text-lg font-bold">{t('Not Applicable For Your Tenant Currency', 'غير متاح لعملة منشأتك الحالية')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {t('This Saudi government integration only applies to SAR-denominated businesses.', 'هذا التكامل الحكومي السعودي ينطبق فقط على المنشآت التي تتعامل بالريال السعودي.')}
        </p>
        <button onClick={() => navigate('/app/dashboard/tenant-settings/government-integrations')} className="btn btn-primary">{t('Go Back', 'الرجوع')}</button>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="card p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold">{t('Integration Not Found', 'التكامل غير موجود')}</h3>
        <button onClick={() => navigate('/app/dashboard/tenant-settings/government-integrations')} className="btn btn-primary">{t('Go Back', 'الرجوع')}</button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const Icon = meta.icon
  const isConnected = dashboard?.connectionStatus === 'connected'
  const logs = logsData?.logs || []
  const stats = dashboard?.stats || {}

  // Build stat cards from real data
  const statCards = [
    { label: t('Total Events', 'إجمالي الأحداث'), value: stats.totalEvents || 0, icon: Activity },
    { label: t('Success Rate', 'معدل النجاح'), value: `${stats.successRate || 0}%`, icon: TrendingUp },
    { label: t('Failed Events', 'الأحداث الفاشلة'), value: stats.failedCount || 0, icon: AlertCircle },
  ]

  // Service-specific stat card
  if (service === 'zatca') {
    const isPhase2 = stats.phase === 2;
    statCards[0] = { label: t('Phase', 'المرحلة'), value: isPhase2 ? 'Phase 2' : 'Phase 1', icon: Shield }
    statCards[1] = { label: isPhase2 ? t('Onboarded', 'تم الربط') : t('VAT Configured', 'ضريبة القيمة المضافة مهيأة'), value: isPhase2 ? (stats.isOnboarded ? t('Yes', 'نعم') : t('No', 'لا')) : (stats.hasVat ? t('Yes', 'نعم') : t('No', 'لا')), icon: CheckCircle }
    statCards[2] = { label: isPhase2 ? t('Device ID', 'معرف الجهاز') : t('Environment', 'البيئة'), value: isPhase2 ? (stats.deviceSerialNumber ? stats.deviceSerialNumber.slice(0, 12) : 'N/A') : (stats.environment || 'sandbox').toUpperCase(), icon: isPhase2 ? Key : Server }
  } else if (service === 'elm') {
    statCards[0] = { label: t('Client ID', 'معرف العميل'), value: stats.clientId ? stats.clientId.slice(0, 8) + '...' : 'N/A', icon: Key }
    statCards[1] = { label: t('Nafath OTP', 'نفاذ OTP'), value: stats.nafathOtpEnabled ? t('Enabled', 'مفعّل') : t('Disabled', 'معطل'), icon: Shield }
    statCards[2] = { label: t('TAMM', 'تم'), value: stats.tammConnected ? t('Connected', 'متصل') : t('Off', 'معطل'), icon: CheckCircle }
  } else if (service === 'qiwa') {
    statCards[0] = { label: t('Establishment ID', 'رقم المنشأة'), value: stats.establishmentId || 'N/A', icon: Server }
    statCards[1] = { label: t('Contract Auto-Sign', 'توقيع تلقائي'), value: stats.contractAuthAutomationEnabled ? t('Active', 'نشط') : t('Off', 'معطل'), icon: CheckCircle }
    statCards[2] = { label: t('Saudization Widget', 'ودجة التوطين'), value: stats.saudizationWidgetEnabled ? t('On', 'مفعّل') : t('Off', 'معطل'), icon: TrendingUp }
  } else if (service === 'gosi') {
    statCards[0] = { label: t('GOSI Reg #', 'رقم التأمينات'), value: stats.gosiRegistrationNumber || 'N/A', icon: Key }
    statCards[1] = { label: t('GOSI Status', 'حالة التأمينات'), value: stats.gosiEnabled ? t('Active', 'نشط') : t('Inactive', 'غير نشط'), icon: CheckCircle }
    statCards[2] = { label: t('Auto SIF Upload', 'رفع تلقائي SIF'), value: stats.autoSifUploadEnabled ? t('On', 'مفعّل') : t('Off', 'معطل'), icon: FileText }
  }

  return (
    <div className={`space-y-6 ${isAr ? 'rtl' : 'ltr'}`}>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-150 dark:border-dark-750 shadow-lg">
        <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-5`} />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${meta.gradient} opacity-5 rounded-full blur-3xl" />
        
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/app/dashboard/tenant-settings/government-integrations')}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-750 transition-all shadow-sm flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-lg flex-shrink-0`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{meta.title}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                  isConnected
                    ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-dark-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'} inline-block`} />
                  {isConnected ? t('Connected', 'متصل') : t('Disconnected', 'غير متصل')}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{meta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !isConnected}
              className="btn btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? t('Syncing...', 'جارٍ المزامنة...') : t('Sync Now', 'مزامنة الآن')}
            </button>
            <Link
              to="/app/dashboard/tenant-settings/government-integrations"
              className="btn btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:scale-[1.01] transition-transform"
            >
              <Key className="w-4 h-4" />
              {t('Manage Config', 'إدارة الإعدادات')}
            </Link>
          </div>
        </div>
      </div>

      {/* Connection Status Banner */}
      {!isConnected && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">
              {t('Integration Not Connected', 'التكامل غير متصل')}
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {dashboard?.lastError || t('Go to the configuration page to set up credentials and test the connection.', 'انتقل إلى صفحة الإعدادات لإدخال بيانات الاعتماد واختبار الاتصال.')}
            </p>
            <Link to="/app/dashboard/tenant-settings/government-integrations" className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 mt-2 hover:underline">
              {t('Configure now →', 'إعداد الآن ←')}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {statCards.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="card p-5 bg-white dark:bg-dark-800 border border-gray-150 dark:border-dark-750 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-sm flex-shrink-0`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold truncate">{stat.label}</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white mt-0.5 truncate">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Connection Test & Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Connection Test */}
          <div className="card p-6 bg-white dark:bg-dark-800 border border-gray-150 dark:border-dark-750 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              {t('Connection Test', 'اختبار الاتصال')}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 leading-relaxed">
              {t('Run a live handshake test to verify endpoint connectivity and credentials.',
                'قم بإجراء اختبار مصافحة مباشر للتحقق من اتصال نقطة النهاية وبيانات الاعتماد.')}
            </p>

            <button
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white shadow-md transition-all hover:scale-[1.01] bg-gradient-to-r ${meta.gradient}`}
            >
              {testConnectionMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {t('Test Connection', 'اختبار الاتصال')}
                </>
              )}
            </button>

            <AnimatePresence>
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-5 space-y-3"
                >
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    testResult.success
                      ? 'border-emerald-200 bg-emerald-50/30 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-400'
                      : 'border-red-200 bg-red-50/30 text-red-800 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400'
                  }`}>
                    {testResult.success ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
                    <div className="text-xs">
                      <p className="font-bold">{testResult.success ? t('Passed', 'نجح') : t('Failed', 'فشل')}</p>
                      <p className="mt-1 leading-relaxed">{testResult.message}</p>
                    </div>
                  </div>

                  {testResult.checks && (
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-dark-750 border border-gray-150 dark:border-dark-700/60 space-y-2 text-xs">
                      {Object.entries(testResult.checks).map(([key, ok]) => (
                        <div key={key} className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          {ok ? (
                            <span className="text-emerald-500 flex items-center gap-1 font-bold"><Check className="w-3.5 h-3.5" /> OK</span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1 font-bold"><XCircle className="w-3.5 h-3.5" /> FAIL</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Connection Info */}
          <div className="card p-6 bg-white dark:bg-dark-800 border border-gray-150 dark:border-dark-750 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-500" />
              {t('Connection Info', 'معلومات الاتصال')}
            </h3>
            <div className="space-y-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-dark-750">
                <span className="text-gray-400">{t('API Endpoint', 'نقطة API')}</span>
                <span className="font-mono font-bold">{meta.endpoint}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-dark-750">
                <span className="text-gray-400">{t('Protocol', 'البروتوكول')}</span>
                <span className="font-bold">{meta.protocol}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-dark-750">
                <span className="text-gray-400">{t('Connected Since', 'متصل منذ')}</span>
                <span className="font-bold">{dashboard?.connectedAt ? timeAgo(dashboard.connectedAt) : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-dark-750">
                <span className="text-gray-400">{t('Last Tested', 'آخر اختبار')}</span>
                <span className="font-bold">{dashboard?.lastTestedAt ? timeAgo(dashboard.lastTestedAt) : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Log */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 bg-white dark:bg-dark-800 border border-gray-150 dark:border-dark-750 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {t('Activity Log', 'سجل النشاط')}
                </h3>
                {isConnected && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {['all', 'success', 'failed', 'pending'].map(f => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${
                      logFilter === f
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}>
                    {f === 'all' ? t('All', 'الكل') : f}
                  </button>
                ))}
                <button
                  onClick={() => refetchLogs()}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                  title={t('Refresh', 'تحديث')}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Log List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                  <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <p className="text-sm">{t('No activity logged yet.', 'لا يوجد نشاط مسجل بعد.')}</p>
                </div>
              ) : (
                logs.map((log) => {
                  const style = STATUS_STYLES[log.status] || STATUS_STYLES.info
                  const StatusIcon = style.icon
                  return (
                    <div
                      key={log._id || log.id}
                      className="p-4 rounded-2xl border border-gray-100 dark:border-dark-750 bg-gray-50/50 dark:bg-dark-750/30 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-gray-200 dark:hover:border-dark-600 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl ${style.bg} ${style.border} border flex-shrink-0`}>
                          <StatusIcon className={`w-4 h-4 ${style.text}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{log.type}</span>
                            {log.reference && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono font-semibold">({log.reference})</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{log.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(log.timestamp || log.createdAt)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide uppercase border ${style.bg} ${style.text} ${style.border}`}>
                          {style.label}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
