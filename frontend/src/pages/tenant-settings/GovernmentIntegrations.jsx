import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { updateTenant } from '../../store/slices/authSlice'
import {
  Shield, Key, Lock, Users, Server, Globe, ExternalLink,
  CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Building, Sliders, Play, Check, X, FileText, WifiOff, HelpCircle, Eye
} from 'lucide-react'
import ZatcaHealthPanel from '../../components/zatca/ZatcaHealthPanel'

// ── ZOD VALIDATION SCHEMA (Saudi Structural Rules) ───────────────────────────
const schema = z.object({
  zatca: z.object({
    environment: z.enum(['sandbox', 'simulation', 'production']),
    otp: z.string().refine(val => !val || /^\d{6}$/.test(val), {
      message: 'OTP must be exactly 6 digits / يجب أن يتكون رمز التحقق من 6 أرقام'
    }),
    privateKey: z.string().refine(val => !val || val.includes('-----BEGIN') && val.includes('-----END'), {
      message: 'Invalid PEM format / صيغة مفتاح غير صالحة'
    })
  }),
  elm: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    appId: z.string().optional(),
    agencyId: z.string().optional(),
    nafathOtpEnabled: z.boolean().default(false),
    tammEnabled: z.boolean().default(false)
  }),
  qiwa: z.object({
    establishmentId: z.string().refine(val => !val || (/^7\d{9}$/.test(val)), {
      message: 'Qiwa ID must be exactly 10 digits starting with 7 / رقم المنشأة يجب أن يكون 10 أرقام ويبدأ بـ 7'
    }),
    accessToken: z.string().optional(),
    contractAuthAutomationEnabled: z.boolean().default(false),
    saudizationWidgetEnabled: z.boolean().default(false)
  }),
  gosi: z.object({
    registrationNumber: z.string().refine(val => !val || /^\d{9,10}$/.test(val), {
      message: 'GOSI Number must be 9 or 10 digits / رقم التأمينات يجب أن يكون 9 أو 10 أرقام'
    }),
    enabled: z.boolean().default(false)
  }),
  mudad: z.object({
    registrationNumber: z.string().optional(),
    clientCertificate: z.string().refine(val => !val || val.includes('-----BEGIN CERTIFICATE-----') && val.includes('-----END CERTIFICATE-----'), {
      message: 'Invalid certificate format / صيغة الشهادة غير صالحة'
    }),
    autoSifUploadEnabled: z.boolean().default(false)
  }),
  carRentalIntegrations: z.object({
    tamm: z.object({
      enabled: z.boolean().default(false),
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      companyLicenseNumber: z.string().optional(),
      environment: z.enum(['sandbox', 'production']).default('sandbox'),
      autoSyncContracts: z.boolean().default(false)
    }),
    najm: z.object({
      enabled: z.boolean().default(false),
      apiKey: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      environment: z.enum(['sandbox', 'production']).default('sandbox'),
      autoCheckOnCheckout: z.boolean().default(true)
    }),
    wathiq: z.object({
      enabled: z.boolean().default(false),
      apiKey: z.string().optional(),
      appId: z.string().optional(),
      environment: z.enum(['sandbox', 'production']).default('sandbox'),
      autoVerifyId: z.boolean().default(true)
    }),
    sms: z.object({
      enabled: z.boolean().default(false),
      provider: z.enum(['taqnyat', 'unifonic', 'msegat', 'custom']).default('taqnyat'),
      apiKey: z.string().optional(),
      senderId: z.string().optional(),
      sendOnCheckout: z.boolean().default(true),
      sendOnCheckin: z.boolean().default(true),
      sendOnOverdue: z.boolean().default(true)
    })
  }),
  industrySpecific: z.object({
    baladyApiKey: z.string().optional(),
    saberToken: z.string().optional(),
    etimadUser: z.string().optional(),
    etimadPassword: z.string().optional()
  })
});

// Reuse Toggle layout
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
      checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-600'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
      checked ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
)

export default function GovernmentIntegrations() {
  const queryClient = useQueryClient()
  const dispatch = useDispatch()
  const { language } = useSelector(state => state.ui)
  const { tenant, user } = useSelector(state => state.auth)
  
  const isAr = language === 'ar'
  const t = (en, ar) => isAr ? ar : en

  // Retrieve tenant business type (trading, construction, car_rental, manpower, restaurant, etc.)
  const industryType = tenant?.businessType || 'trading'

  // Map business type to suggested default active tab
  const getSuggestedTab = () => {
    switch (industryType) {
      case 'car_rental': return 'elm'
      case 'construction': return 'qiwa'
      case 'manpower': return 'gosi'
      case 'trading': return 'zatca'
      case 'restaurant':
      case 'bakala':
        return 'zatca'
      default: return 'zatca'
    }
  }

  const [activeTab, setActiveTab] = useState(getSuggestedTab())
  const [complianceTestResult, setComplianceTestResult] = useState(null)
  
  // Background Sync state simulation (BullMQ queue progress)
  const [syncProgress, setSyncProgress] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatusText, setSyncStatusText] = useState('')

  // Accordion details for Elm sub-integrations
  const [expandedSections, setExpandedSections] = useState({
    tamm: true,
    najm: false,
    wathiq: false,
    sms: false
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // 1. Fetch config from API
  const { data: config, isLoading: isConfigLoading } = useQuery({
    queryKey: ['government-integrations-config'],
    queryFn: () => api.get('/tenant/compliance/config').then(res => res.data)
  })

  // 2. React Hook Form setup
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      zatca: { environment: 'sandbox', otp: '', privateKey: '' },
      elm: { clientId: '', clientSecret: '', appId: '', agencyId: '', nafathOtpEnabled: false, tammEnabled: false },
      qiwa: { establishmentId: '', accessToken: '', contractAuthAutomationEnabled: false, saudizationWidgetEnabled: false },
      gosi: { registrationNumber: '', enabled: false },
      mudad: { registrationNumber: '', clientCertificate: '', autoSifUploadEnabled: false },
      carRentalIntegrations: {
        tamm: { enabled: false, apiKey: '', apiSecret: '', companyLicenseNumber: '', environment: 'sandbox', autoSyncContracts: false },
        najm: { enabled: false, apiKey: '', clientId: '', clientSecret: '', environment: 'sandbox', autoCheckOnCheckout: true },
        wathiq: { enabled: false, apiKey: '', appId: '', environment: 'sandbox', autoVerifyId: true },
        sms: { enabled: false, provider: 'taqnyat', apiKey: '', senderId: '', sendOnCheckout: true, sendOnCheckin: true, sendOnOverdue: true }
      },
      industrySpecific: { baladyApiKey: '', saberToken: '', etimadUser: '', etimadPassword: '' }
    }
  })

  // Populate form values when config is loaded
  useEffect(() => {
    if (config) {
      reset({
        zatca: {
          environment: config.zatca?.environment || 'sandbox',
          otp: '',
          privateKey: config.zatca?.hasPrivateKey ? '-----BEGIN PRIVATE KEY-----\n****************\n-----END PRIVATE KEY-----' : ''
        },
        elm: {
          clientId: config.elm?.clientId || '',
          clientSecret: config.elm?.hasClientSecret ? '****************' : '',
          appId: config.elm?.appId || '',
          agencyId: config.elm?.agencyId || '',
          nafathOtpEnabled: config.elm?.nafathOtpEnabled || false,
          tammEnabled: config.elm?.tammEnabled || false
        },
        qiwa: {
          establishmentId: config.qiwa?.establishmentId || '',
          accessToken: config.qiwa?.hasAccessToken ? '****************' : '',
          contractAuthAutomationEnabled: config.qiwa?.contractAuthAutomationEnabled || false,
          saudizationWidgetEnabled: config.qiwa?.saudizationWidgetEnabled || false
        },
        gosi: {
          registrationNumber: config.gosi?.registrationNumber || '',
          enabled: config.gosi?.enabled || false
        },
        mudad: {
          registrationNumber: config.mudad?.registrationNumber || '',
          clientCertificate: config.mudad?.hasClientCertificate ? '-----BEGIN CERTIFICATE-----\n****************\n-----END CERTIFICATE-----' : '',
          autoSifUploadEnabled: config.mudad?.autoSifUploadEnabled || false
        },
        carRentalIntegrations: {
          tamm: {
            enabled: config.carRentalIntegrations?.tamm?.enabled || false,
            apiKey: config.carRentalIntegrations?.tamm?.apiKey ? '****************' : '',
            apiSecret: config.carRentalIntegrations?.tamm?.apiSecret ? '****************' : '',
            companyLicenseNumber: config.carRentalIntegrations?.tamm?.companyLicenseNumber || '',
            environment: config.carRentalIntegrations?.tamm?.environment || 'sandbox',
            autoSyncContracts: config.carRentalIntegrations?.tamm?.autoSyncContracts || false,
          },
          najm: {
            enabled: config.carRentalIntegrations?.najm?.enabled || false,
            apiKey: config.carRentalIntegrations?.najm?.apiKey ? '****************' : '',
            clientId: config.carRentalIntegrations?.najm?.clientId || '',
            clientSecret: config.carRentalIntegrations?.najm?.clientSecret ? '****************' : '',
            environment: config.carRentalIntegrations?.najm?.environment || 'sandbox',
            autoCheckOnCheckout: config.carRentalIntegrations?.najm?.autoCheckOnCheckout !== false,
          },
          wathiq: {
            enabled: config.carRentalIntegrations?.wathiq?.enabled || false,
            apiKey: config.carRentalIntegrations?.wathiq?.apiKey ? '****************' : '',
            appId: config.carRentalIntegrations?.wathiq?.appId || '',
            environment: config.carRentalIntegrations?.wathiq?.environment || 'sandbox',
            autoVerifyId: config.carRentalIntegrations?.wathiq?.autoVerifyId !== false,
          },
          sms: {
            enabled: config.carRentalIntegrations?.sms?.enabled || false,
            provider: config.carRentalIntegrations?.sms?.provider || 'taqnyat',
            apiKey: config.carRentalIntegrations?.sms?.apiKey ? '****************' : '',
            senderId: config.carRentalIntegrations?.sms?.senderId || '',
            sendOnCheckout: config.carRentalIntegrations?.sms?.sendOnCheckout !== false,
            sendOnCheckin: config.carRentalIntegrations?.sms?.sendOnCheckin !== false,
            sendOnOverdue: config.carRentalIntegrations?.sms?.sendOnOverdue !== false,
          }
        },
        industrySpecific: {
          baladyApiKey: '',
          saberToken: '',
          etimadUser: '',
          etimadPassword: ''
        }
      })
    }
  }, [config, reset])

  // Save configurations mutation
  const saveMutation = useMutation({
    mutationFn: (data) => api.post('/tenant/compliance/config', data),
    onSuccess: () => {
      toast.success(t('Government integration settings saved successfully.', 'تم حفظ إعدادات التكاملات الحكومية بنجاح.'))
      queryClient.invalidateQueries(['government-integrations-config'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || t('Failed to save settings.', 'فشل حفظ الإعدادات.'))
    }
  })

  // Run ZATCA Compliance Test mutation
  const testHandshakeMutation = useMutation({
    mutationFn: (env) => api.post('/tenant/compliance/config/test-handshake', { environment: env }).then(res => res.data),
    onSuccess: (res) => {
      setComplianceTestResult(res)
      toast.success(t('Compliance handshake test passed!', 'نجح اختبار المصافحة والتوافق!'))
    },
    onError: (err) => {
      setComplianceTestResult(err.response?.data || { success: false, message: 'Handshake failed.' })
      toast.error(t('Compliance handshake test failed.', 'فشل اختبار التوافق.'))
    }
  })

  // Per-service connection test mutation
  const testConnectionMutation = useMutation({
    mutationFn: (service) => api.post('/tenant/compliance/config/test-connection', { service }).then(res => res.data),
    onSuccess: async (res) => {
      if (res.success) {
        toast.success(t('Connection test passed!', 'نجح اختبار الاتصال!'))
        // Refresh tenant data so sidebar updates with new sub-menus
        try {
          const { data: tenantData } = await api.get('/auth/me')
          if (tenantData?.tenant) dispatch(updateTenant(tenantData.tenant))
        } catch (e) { /* best-effort */ }
      } else {
        toast.error(res.message || t('Connection test failed.', 'فشل اختبار الاتصال.'))
      }
      queryClient.invalidateQueries(['government-integrations-config'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || t('Connection test failed.', 'فشل اختبار الاتصال.'))
    }
  })

  // Background Sync simulator (BullMQ progress bar trigger)
  const triggerBulkSync = () => {
    setIsSyncing(true)
    setSyncProgress(0)
    setSyncStatusText(t('Queueing sync job in BullMQ...', 'جاري جدولة مهمة المزامنة في BullMQ...'))

    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsSyncing(false)
          setSyncStatusText(t('Sync completed successfully!', 'اكتملت المزامنة بنجاح!'))
          toast.success(t('Database synced with Government Portal API!', 'تمت مزامنة قاعدة البيانات مع بوابة الحكومة!'))
          return 100
        }
        if (prev === 20) setSyncStatusText(t('VPC Tunnel established with Elm/Qiwa servers...', 'تم إنشاء نفق VPC مع خوادم علم وقوى...'))
        if (prev === 50) setSyncStatusText(t('Fetching payroll files & contractor records...', 'جاري جلب ملفات الأجور وسجلات المقاولين...'))
        if (prev === 80) setSyncStatusText(t('Writing records to MongoDB database...', 'جاري كتابة السجلات في قاعدة بيانات MongoDB...'))
        return prev + 10
      })
    }, 400)
  }

  const onSubmit = (data) => {
    saveMutation.mutate(data)
  }

  // ── DYNAMIC STATUS CALCULATIONS ─────────────────────────────────────────────
  const hasIndustrySpecificConfig = () => {
    if (!config?.industrySpecific) return false
    const { baladyApiKey, saberToken, etimadUser, etimadPassword } = config.industrySpecific
    return !!(baladyApiKey || saberToken || etimadUser || etimadPassword)
  }

  const getStatus = (tabId) => {
    if (!config) return 'disconnected'
    
    switch (tabId) {
      case 'zatca': {
        if (config.zatca?.connectionStatus === 'connected') return 'connected'
        // Phase 1 only needs business VAT/name/address to generate QR/XML locally
        const isPhase1 = config.zatca?.phase === 1 || tenant?.zatca?.phase === 1
        if (isPhase1) {
          const business = tenant?.business || {}
          const hasVat = !!business.vatNumber
          const hasName = !!(business.legalNameEn || business.legalNameAr)
          const hasAddress = !!(business.address?.city && business.address?.country)
          if (hasVat && hasName && hasAddress) return 'connected'
        }
        if (config.zatca?.isOnboarded) return 'connected'
        if (config.zatca?.hasPrivateKey) return 'action_required'
        return 'disconnected'
      }
      case 'elm':
        if (config.elm?.connectionStatus === 'connected') return 'connected'
        // Active if any of Tamm, NAJM, or Wathiq is enabled
        const cri = config.carRentalIntegrations || {}
        if (cri.tamm?.enabled || cri.najm?.enabled || cri.wathiq?.enabled) {
          return 'connected'
        }
        if (config.elm?.clientId) return 'action_required'
        return 'disconnected'
      case 'qiwa':
        if (config.qiwa?.connectionStatus === 'connected') return 'connected'
        if (config.qiwa?.establishmentId && config.qiwa?.hasAccessToken) {
          return config.qiwa.contractAuthAutomationEnabled ? 'connected' : 'action_required'
        }
        if (config.qiwa?.establishmentId) return 'action_required'
        return 'disconnected'
      case 'gosi':
        if (config.gosi?.connectionStatus === 'connected') return 'connected'
        if (config.gosi?.registrationNumber && config.mudad?.hasClientCertificate) {
          return config.mudad.autoSifUploadEnabled ? 'connected' : 'action_required'
        }
        if (config.gosi?.registrationNumber) return 'action_required'
        return 'disconnected'
      case 'industry':
        return hasIndustrySpecificConfig() ? 'connected' : 'disconnected'
      default:
        return 'disconnected'
    }
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('Connected', 'متصل')}
          </span>
        )
      case 'action_required':
        return (
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            {t('Action Required', 'مطلوب إجراء')}
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 dark:bg-dark-750 dark:text-gray-400 border border-gray-200/50 dark:border-dark-600/50">
            <WifiOff className="w-3 h-3 text-gray-400" />
            {t('Disconnected', 'غير متصل')}
          </span>
        )
    }
  }

  // Tabs mapping config
  const tabs = [
    { id: 'zatca', label: t('ZATCA (Fatoora)', 'هيئة الزكاة (فاتورة)'), icon: Shield, highlight: industryType === 'trading' || industryType === 'restaurant' || industryType === 'bakala' },
    { id: 'elm', label: t('Elm / Yakeen / Tamm', 'علم / يقين / تم'), icon: Key, highlight: industryType === 'car_rental' },
    { id: 'qiwa', label: t('Qiwa & MHRSD', 'قوى والموارد البشرية'), icon: Users, highlight: industryType === 'construction' || industryType === 'manpower' },
    { id: 'gosi', label: t('GOSI & Mudad (WPS)', 'التأمينات ومدد (WPS)'), icon: Building, highlight: industryType === 'construction' || industryType === 'manpower' },
    { id: 'industry', label: t('Industry Specific', 'خاص بالقطاع'), icon: Sliders, highlight: true }
  ]

  const isSarCurrencyTenant = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR'
  if (!isSarCurrencyTenant) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-5">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t('Not Applicable For Your Tenant Currency', 'غير متاح لعملة منشأتك الحالية')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {t(
            'ZATCA, Elm, Qiwa and GOSI are Saudi Arabian government integrations that only apply to SAR-denominated businesses. Set your default currency to SAR in Settings to enable this section.',
            'زاتكا وعلم وقوى والتأمينات الاجتماعية تكاملات حكومية سعودية تنطبق فقط على المنشآت التي تتعامل بالريال السعودي. غيّر العملة الافتراضية إلى الريال السعودي من الإعدادات لتفعيل هذا القسم.'
          )}
        </p>
      </div>
    )
  }

  if (isConfigLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-dark-600 rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="h-80 bg-gray-200 dark:bg-dark-600 rounded-2xl col-span-1" />
          <div className="h-80 bg-gray-200 dark:bg-dark-600 rounded-2xl col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 pb-12 ${isAr ? 'rtl' : 'ltr'}`}>
      
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            🇸🇦 {t('Saudi Government Integrations', 'بوابة التكاملات الحكومية السعودية')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('Manage cryptographic keys, portal authorizations, and synchronization schedules under the Shared-Gateway Pattern.', 
               'إدارة مفاتيح التشفير، تفويضات البوابات، وجداول المزامنة في إطار نمط البوابة المشتركة.')}
          </p>
        </div>

        {/* Sync queue trigger (BullMQ) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={triggerBulkSync}
            disabled={isSyncing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-primary-500' : ''}`} />
            {t('Sync Portals Bulk', 'مزامنة البوابات جماعياً')}
          </button>
        </div>
      </div>

      {/* BullMQ Sync progress bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl space-y-2 overflow-hidden"
          >
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-primary-700 dark:text-primary-400">{syncStatusText}</span>
              <span className="text-primary-700 dark:text-primary-400">{syncProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CORE GRID LAYOUT ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* SIDEBAR TABS NAVIGATION */}
        <div className="card p-3 space-y-2 lg:col-span-1">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">
            {t('Integration Services', 'خدمات الربط والتكامل')}
          </div>
          <div className="flex flex-col gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const status = getStatus(tab.id)
              const isSelected = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id)
                    setComplianceTestResult(null)
                  }}
                  className={`flex flex-col w-full text-start p-3 rounded-xl transition-all relative ${
                    isSelected
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/10'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-750'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold text-sm">{tab.label}</span>
                    </div>
                    {/* Glowing highlight indicator for industry fit */}
                    {tab.highlight && !isSelected && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between w-full">
                    {renderStatusBadge(status)}
                    {tab.highlight && (
                      <span className={`text-[10px] uppercase font-bold tracking-tight ${isSelected ? 'text-primary-100' : 'text-primary-500'}`}>
                        {t('Recommended', 'موصى به')}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* MAIN CONFIGURATION FORMS */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <fieldset disabled={user?.role !== 'super_admin' && user?.role !== 'superadmin' && user?.role !== 'admin'} className="space-y-6">
            {/* TAB CONTENT: ZATCA */}
            {activeTab === 'zatca' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-6">
                <div className="border-b border-gray-150 dark:border-dark-750 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Shield className="w-6 h-6 text-primary-500" />
                      {(config?.zatca?.phase === 2 || tenant?.zatca?.phase === 2)
                        ? t('ZATCA E-Invoicing Phase 2 Integration', 'تكامل هيئة الزكاة والجمارك (المرحلة الثانية)')
                        : t('ZATCA E-Invoicing Phase 1 Integration', 'تكامل هيئة الزكاة والجمارك (المرحلة الأولى)')
                      }
                    </h3>
                    {(config?.zatca?.isOnboarded || getStatus('zatca') === 'connected') && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => testConnectionMutation.mutate('zatca')}
                          disabled={testConnectionMutation.isPending}
                          className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform"
                        >
                          {testConnectionMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          {t('Test', 'اختبار')}
                        </button>
                        <Link to="/app/dashboard/tenant-settings/government-integrations/zatca" className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
                          <Eye className="w-4 h-4 text-emerald-500" />
                          {t('View Dashboard', 'عرض لوحة التحكم')}
                        </Link>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {(config?.zatca?.phase === 2 || tenant?.zatca?.phase === 2)
                      ? t('ZATCA Phase 2 (Fatoora) integration ensures complete compliance with the Saudi e-invoicing mandate. It automatically generates ZATCA-compliant QR codes, digitally signs invoices using your cryptographic stamp, and transmits B2B invoices for clearance and B2C invoices for reporting in real-time.',
                          'تكامل هيئة الزكاة والجمارك (المرحلة الثانية) يضمن الامتثال الكامل لمتطلبات الفوترة الإلكترونية السعودية. يقوم تلقائياً بإنشاء رموز QR المتوافقة، ويوقع الفواتير رقمياً باستخدام ختم التشفير، ويرسل الفواتير الضريبية (B2B) للاعتماد والمبسطة (B2C) للإبلاغ في الوقت الفعلي.')
                      : t('ZATCA Phase 1 (Fatoora) integration generates ZATCA-compliant QR codes and locally-signed XML invoices using your company VAT and address. No live portal submission is required for Phase 1. This protects your business from compliance penalties while operating under the Phase 1 mandate.',
                          'تكامل هيئة الزكاة والجمارك (المرحلة الأولى) ينشئ رموز QR متوافقة وفواتير XML موقعة محلياً باستخدام ضريبة القيمة المضافة وعنوان الشركة. لا يتطلب المرحلة الأولى إرسال مباشر للبوابة. هذا يحمي عملك من غرامات عدم الامتثال أثناء العمل بموجب متطلبات المرحلة الأولى.')
                    }
                  </p>
                </div>

                {/* ZATCA Health Panel */}
                <div className="mt-4">
                  <ZatcaHealthPanel />
                </div>

                {/* Restaurant & Grocery Offline signing banner */}
                {(industryType === 'restaurant' || industryType === 'bakala') && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                    <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">
                        {t('High-Velocity POS Optimization Active', 'تفعيل التحسين الفوري لنقاط البيع السريعة')}
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                        {t('Your local terminal is configured to sign invoices cryptographically in offline mode (<100ms checkout). Signed payloads will automatically batch-sync to ZATCA\'s servers via backend workers within the regulatory 24-hour window if connectivity drops.',
                           'تم تكوين المحطة الطرفية المحلية لتوقيع الفواتير رقمياً في وضع عدم الاتصال (أقل من 100 مللي ثانية). سيتم إرسال الفواتير الموقعة كحزم تلقائياً عبر مشغلات الخلفية خلال المهلة النظامية (24 ساعة) في حال انقطاع الشبكة.')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('ZATCA Environment Toggle', 'بيئة الربط (الزكاة)')}</label>
                    <select {...register('zatca.environment')} className="select mt-1">
                      <option value="sandbox">Sandbox / البيئة التجريبية المفتوحة</option>
                      <option value="simulation">Simulation / بيئة المحاكاة</option>
                      <option value="production">Production / البيئة الفعلية</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">{t('OTP Code Input (6 Digits)', 'رمز التحقق الثنائي من بوابة فاتورة')}</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      {...register('zatca.otp')}
                      className={`input mt-1 ${errors.zatca?.otp ? 'border-red-500' : ''}`}
                    />
                    {errors.zatca?.otp && <p className="text-xs text-red-500 mt-1">{errors.zatca.otp.message}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {t('Generate a one-time onboarding code from the ZATCA Fatoora Portal to exchange for CSID.', 
                         'قم بإنشاء رمز تسجيل مؤقت من بوابة فاتورة لإتمام عملية الربط والحصول على CSID.')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label">{t('Cryptographic Stamp Certificate (CSIDL) — Read Only', 'شهادة ختم التشفير (CSID) — للقراءة فقط')}</label>
                  <textarea
                    readOnly
                    rows={4}
                    value={config?.zatca?.complianceCsid || t('No certificate loaded. Enter OTP above and save to onboard.', 'لم يتم تحميل شهادة. أدخل رمز التحقق OTP لحفظ وبدء عملية الدمج.')}
                    className="input font-mono text-xs bg-gray-50 dark:bg-dark-750 text-gray-500 cursor-not-allowed mt-1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="label">{t('Private Key (.pem)', 'المفتاح الخاص (.pem)')}</label>
                  <textarea
                    rows={4}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    {...register('zatca.privateKey')}
                    className={`input font-mono text-xs mt-1 ${errors.zatca?.privateKey ? 'border-red-500' : ''}`}
                  />
                  {errors.zatca?.privateKey && <p className="text-xs text-red-500 mt-1">{errors.zatca.privateKey.message}</p>}
                </div>

                {/* Handshake test action */}
                <div className="p-4 bg-gray-50 dark:bg-dark-750 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm">{t('Verify Cryptographic Handshake', 'التحقق من مصافحة التشفير')}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('Test key validity and send a mock simplified invoice to ZATCA server.', 
                         'اختبار صلاحية المفتاح وإرسال فاتورة مبسطة تجريبية لخادم هيئة الزكاة.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => testHandshakeMutation.mutate(watch('zatca.environment'))}
                    disabled={testHandshakeMutation.isPending}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    {testHandshakeMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {t('Run Compliance Test', 'تشغيل اختبار التوافق')}
                  </button>
                </div>

                {/* Handshake test result UI */}
                {complianceTestResult && (
                  <div className={`p-5 rounded-2xl border ${complianceTestResult.success ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'} space-y-3`}>
                    <div className="flex items-center gap-2">
                      {complianceTestResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-bold text-sm">{complianceTestResult.message}</span>
                    </div>

                    {complianceTestResult.checks && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(complianceTestResult.checks).map(([key, ok]) => (
                          <div key={key} className="flex items-center gap-2 text-xs bg-white dark:bg-dark-800 p-2 rounded-lg border border-gray-100 dark:border-dark-700">
                            {ok ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {complianceTestResult.sample && (
                      <div className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 text-xs font-mono space-y-1">
                        <div><span className="text-gray-400">UUID:</span> {complianceTestResult.sample.uuid}</div>
                        <div><span className="text-gray-400">Hash:</span> {complianceTestResult.sample.invoiceHash}</div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB CONTENT: ELM (Yakeen, Tamm, NAJM, Wathiq, SMS) */}
            {activeTab === 'elm' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                
                {/* 1. Elm DevPortal (Yakeen) */}
                <div className="card p-6 space-y-4">
                  <div className="border-b border-gray-150 dark:border-dark-750 pb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary-500" />
                        {t('Elm DevPortal Integration (Yakeen)', 'بوابة المطورين علم (يقين)')}
                      </h3>
                      {config?.elm?.clientId && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => testConnectionMutation.mutate('elm')}
                            disabled={testConnectionMutation.isPending}
                            className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform"
                          >
                            {testConnectionMutation.isPending ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            {t('Test', 'اختبار')}
                          </button>
                          <Link to="/app/dashboard/tenant-settings/government-integrations/elm" className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
                            <Eye className="w-4 h-4 text-emerald-500" />
                            {t('View Dashboard', 'عرض لوحة التحكم')}
                          </Link>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {t('Elm Yakeen integration connects directly to the National Information Center (NIC). It automatically verifies customer identities, fetches accurate Iqama/National ID details, and secures high-risk transactions with Nafath OTP. This prevents identity fraud and ensures accurate customer data entry.',
                         'تكامل علم (يقين) يتصل مباشرة بمركز المعلومات الوطني (NIC). يتحقق تلقائياً من هويات العملاء، ويجلب تفاصيل الإقامة/الهوية الوطنية الدقيقة، ويؤمن المعاملات عالية المخاطر برمز نفاذ (Nafath OTP). يمنع هذا الاحتيال في الهوية ويضمن إدخال بيانات دقيقة للعملاء.')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs">{t('Elm Client ID', 'معرف العميل (علم)')}</label>
                      <input
                        type="text"
                        placeholder="e.g. client_id_..."
                        {...register('elm.clientId')}
                        className="input mt-1"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">{t('Elm Client Secret', 'السر الخاص بالعميل (علم)')}</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        {...register('elm.clientSecret')}
                        className="input mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-750">
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{t('Enable Nafath OTP Identity Verification', 'تفعيل التحقق من الهوية عبر نفاذ OTP')}</p>
                      <p className="text-[10px] text-gray-400">{t('Trigger live Nafath OTP check during customer registration.', 'إرسال رمز نفاذ للتحقق الفوري عند تسجيل العميل.')}</p>
                    </div>
                    <Controller
                      name="elm.nafathOtpEnabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                </div>

                {/* 2. Tamm (Amakin) */}
                <div className="card p-0 overflow-hidden border border-gray-200 dark:border-dark-700">
                  <div className="p-4 flex items-center justify-between bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏛️</span>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          {t('Tamm (Amakin)', 'تمم (أماكن)')}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">MOT</span>
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('Mandatory integration with the Ministry of Transport (Tamm) to register vehicle rental contracts. It legally authorizes the renter to drive the vehicle and protects the rental agency from traffic violations and liabilities.', 'تكامل إلزامي مع وزارة النقل (تمم) لتسجيل عقود تأجير المركبات. يفوض المستأجر قانونياً بقيادة المركبة ويحمي مكتب التأجير من المخالفات المرورية والمسؤوليات.')}</p>
                      </div>
                    </div>
                    <Controller
                      name="carRentalIntegrations.tamm.enabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                  
                  {watch('carRentalIntegrations.tamm.enabled') && (
                    <div className="p-5 space-y-4 bg-white dark:bg-dark-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label text-xs">{t('API Key', 'مفتاح API')}</label>
                          <input type="password" placeholder="tamm_key_..." {...register('carRentalIntegrations.tamm.apiKey')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('API Secret', 'سر API')}</label>
                          <input type="password" placeholder="tamm_secret_..." {...register('carRentalIntegrations.tamm.apiSecret')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Company License No.', 'رقم رخصة الشركة')}</label>
                          <input placeholder="7100XXXXXXX" {...register('carRentalIntegrations.tamm.companyLicenseNumber')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Environment', 'البيئة')}</label>
                          <div className="flex gap-2 mt-1">
                            {['sandbox', 'production'].map(env => (
                              <button
                                key={env}
                                type="button"
                                onClick={() => control._fields['carRentalIntegrations.tamm.environment']._f.onChange(env)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                  watch('carRentalIntegrations.tamm.environment') === env
                                    ? env === 'production'
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-amber-500 text-white'
                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-500'
                                }`}
                              >
                                {env === 'sandbox' ? '🧪 Sandbox' : '🚀 Production'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-750">
                        <div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{t('Auto-sync contracts to Tamm', 'مزامنة العقود تلقائياً إلى تمم')}</p>
                          <p className="text-[10px] text-gray-400">{t('Push every checkout to the government registry', 'إرسال كل عقد تأجير إلى سجل وزارة النقل')}</p>
                        </div>
                        <Controller
                          name="carRentalIntegrations.tamm.autoSyncContracts"
                          control={control}
                          render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. NAJM */}
                <div className="card p-0 overflow-hidden border border-gray-200 dark:border-dark-700">
                  <div className="p-4 flex items-center justify-between bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🛡️</span>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          {t('NAJM Insurance', 'نجم للتأمين')}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">NAJM</span>
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('Direct integration with NAJM allows you to verify a customer\'s accident history and active insurance coverage instantly before renting out a vehicle, significantly reducing operational risks.', 'ربط مباشر مع نجم يتيح لك التحقق من تاريخ الحوادث والتغطية التأمينية الفعالة للعميل فوراً قبل تأجير المركبة، مما يقلل بشكل كبير من المخاطر التشغيلية.')}</p>
                      </div>
                    </div>
                    <Controller
                      name="carRentalIntegrations.najm.enabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                  
                  {watch('carRentalIntegrations.najm.enabled') && (
                    <div className="p-5 space-y-4 bg-white dark:bg-dark-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label text-xs">{t('API Key', 'مفتاح API')}</label>
                          <input type="password" placeholder="najm_..." {...register('carRentalIntegrations.najm.apiKey')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Client ID', 'معرف العميل')}</label>
                          <input placeholder="client_id" {...register('carRentalIntegrations.najm.clientId')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Client Secret', 'سر العميل')}</label>
                          <input type="password" placeholder="client_secret" {...register('carRentalIntegrations.najm.clientSecret')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Environment', 'البيئة')}</label>
                          <div className="flex gap-2 mt-1">
                            {['sandbox', 'production'].map(env => (
                              <button
                                key={env}
                                type="button"
                                onClick={() => control._fields['carRentalIntegrations.najm.environment']._f.onChange(env)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                  watch('carRentalIntegrations.najm.environment') === env
                                    ? env === 'production'
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-amber-500 text-white'
                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-500'
                                }`}
                              >
                                {env === 'sandbox' ? '🧪 Sandbox' : '🚀 Production'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-750">
                        <div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{t('Auto-check customer at checkout', 'التحقق التلقائي عند التأجير')}</p>
                          <p className="text-[10px] text-gray-400">{t('Verify insurance & accident history before rental', 'التحقق من التأمين وتاريخ الحوادث قبل التأجير')}</p>
                        </div>
                        <Controller
                          name="carRentalIntegrations.najm.autoCheckOnCheckout"
                          control={control}
                          render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Wathiq */}
                <div className="card p-0 overflow-hidden border border-gray-200 dark:border-dark-700">
                  <div className="p-4 flex items-center justify-between bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🪪</span>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          {t('Wathiq (SAFCSP)', 'وثيق')}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">NIC</span>
                        </h4>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('Wathiq integration provides real-time verification of commercial registrations, national IDs, and business licenses, ensuring B2B clients and individuals are legally verified and active.', 'تكامل وثيق يوفر تحققاً في الوقت الفعلي للسجلات التجارية والهويات الوطنية والتراخيص، مما يضمن التحقق القانوني ونشاط العملاء من الشركات والأفراد.')}</p>
                      </div>
                    </div>
                    <Controller
                      name="carRentalIntegrations.wathiq.enabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                  
                  {watch('carRentalIntegrations.wathiq.enabled') && (
                    <div className="p-5 space-y-4 bg-white dark:bg-dark-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label text-xs">{t('API Key', 'مفتاح API')}</label>
                          <input type="password" placeholder="wathiq_..." {...register('carRentalIntegrations.wathiq.apiKey')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('App ID', 'معرف التطبيق')}</label>
                          <input placeholder="app_id" {...register('carRentalIntegrations.wathiq.appId')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Environment', 'البيئة')}</label>
                          <div className="flex gap-2 mt-1">
                            {['sandbox', 'production'].map(env => (
                              <button
                                key={env}
                                type="button"
                                onClick={() => control._fields['carRentalIntegrations.wathiq.environment']._f.onChange(env)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                  watch('carRentalIntegrations.wathiq.environment') === env
                                    ? env === 'production'
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-amber-500 text-white'
                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-500'
                                }`}
                              >
                                {env === 'sandbox' ? '🧪 Sandbox' : '🚀 Production'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-750">
                        <div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{t('Auto-verify ID on customer registration', 'تحقق تلقائي عند تسجيل العميل')}</p>
                          <p className="text-[10px] text-gray-400">{t('Verify Iqama/National ID against government DB', 'التحقق من الإقامة/الهوية من قاعدة بيانات الحكومة')}</p>
                        </div>
                        <Controller
                          name="carRentalIntegrations.wathiq.autoVerifyId"
                          control={control}
                          render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. SMS */}
                <div className="card p-0 overflow-hidden border border-gray-200 dark:border-dark-700">
                  <div className="p-4 flex items-center justify-between bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📱</span>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{t('SMS Notifications', 'إشعارات SMS')}</h4>
                        <p className="text-xs text-gray-400">{t('Taqnyat / Unifonic / Msegat – automated customer alerts', 'تقنيات / يونيفونيك / مسجات – إشعارات تلقائية')}</p>
                      </div>
                    </div>
                    <Controller
                      name="carRentalIntegrations.sms.enabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                  
                  {watch('carRentalIntegrations.sms.enabled') && (
                    <div className="p-5 space-y-4 bg-white dark:bg-dark-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-full space-y-1">
                          <label className="label text-xs">{t('Provider', 'المزود')}</label>
                          <div className="flex gap-2 mt-1">
                            {['taqnyat', 'unifonic', 'msegat', 'custom'].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => control._fields['carRentalIntegrations.sms.provider']._f.onChange(p)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                                  watch('carRentalIntegrations.sms.provider') === p
                                    ? 'bg-emerald-500 text-white shadow-md'
                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-500'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="label text-xs">{t('API Key', 'مفتاح API')}</label>
                          <input type="password" placeholder="sms_api_key..." {...register('carRentalIntegrations.sms.apiKey')} className="input mt-1" />
                        </div>
                        <div>
                          <label className="label text-xs">{t('Sender ID', 'معرف المرسل')}</label>
                          <input placeholder="MAQDER" maxLength={11} {...register('carRentalIntegrations.sms.senderId')} className="input mt-1" />
                          <p className="text-[10px] text-gray-400 mt-1">{t('Max 11 characters', 'حد أقصى 11 حرف')}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-gray-100 dark:border-dark-750 pt-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-700">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">🚗 {t('On Checkout', 'عند التأجير')}</span>
                          <Controller
                            name="carRentalIntegrations.sms.sendOnCheckout"
                            control={control}
                            render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-700">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">✅ {t('On Check-In', 'عند الإرجاع')}</span>
                          <Controller
                            name="carRentalIntegrations.sms.sendOnCheckin"
                            control={control}
                            render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-700">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">⚠️ {t('On Overdue', 'عند التأخر')}</span>
                          <Controller
                            name="carRentalIntegrations.sms.sendOnOverdue"
                            control={control}
                            render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Integration Documentation Notice */}
                <div className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 flex gap-3">
                  <span className="text-xl flex-shrink-0">ℹ️</span>
                  <div className="text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-bold mb-1 text-sm">{t('Integration Documentation', 'توثيق التكاملات')}</p>
                    <ul className="space-y-0.5 text-blue-700 dark:text-blue-400">
                      <li>• <strong>Tamm:</strong> developer.tamm.sa</li>
                      <li>• <strong>NAJM:</strong> developer.najm.sa</li>
                      <li>• <strong>Wathiq:</strong> wathiq.com/api</li>
                      <li>• <strong>Taqnyat:</strong> api.taqnyat.sa</li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: QIWA */}
            {activeTab === 'qiwa' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-6">
                <div className="border-b border-gray-150 dark:border-dark-750 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Users className="w-6 h-6 text-primary-500" />
                      {t('Qiwa & MHRSD Labor Integration', 'تكامل منصة قوى ووزارة الموارد البشرية')}
                    </h3>
                    {config?.qiwa?.establishmentId && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => testConnectionMutation.mutate('qiwa')}
                          disabled={testConnectionMutation.isPending}
                          className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform"
                        >
                          {testConnectionMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          {t('Test', 'اختبار')}
                        </button>
                        <Link to="/app/dashboard/tenant-settings/government-integrations/qiwa" className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
                          <Eye className="w-4 h-4 text-emerald-500" />
                          {t('View Dashboard', 'عرض لوحة التحكم')}
                        </Link>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('Qiwa integration fully digitalizes your HR operations with the Ministry of Human Resources. It automatically authenticates employment contracts, continuously monitors your Nitaqat band, tracks Saudization percentages, and ensures your work permits and visas are compliant with Saudi labor laws without manual portal logins.',
                       'تكامل منصة قوى يرقمن عمليات الموارد البشرية بالكامل مع وزارة الموارد البشرية. يقوم بتوثيق عقود العمل تلقائياً، ويراقب باستمرار نطاق المنشأة ونسب التوطين، ويضمن توافق تصاريح العمل والتأشيرات مع قوانين العمل السعودية دون الحاجة للدخول اليدوي للبوابة.')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('Establishment ID (700xxxxxxx)', 'الرقم الموحد للمنشأة (700xxxxxxxx)')}</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="7001234567"
                      {...register('qiwa.establishmentId')}
                      className={`input mt-1 ${errors.qiwa?.establishmentId ? 'border-red-500' : ''}`}
                    />
                    {errors.qiwa?.establishmentId && <p className="text-xs text-red-500 mt-1">{errors.qiwa.establishmentId.message}</p>}
                  </div>

                  <div>
                    <label className="label">{t('Qiwa API Access Token', 'رمز الوصول لواجهة قوى (Qiwa API Token)')}</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      {...register('qiwa.accessToken')}
                      className="input mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-gray-100 dark:border-dark-750 pt-4">
                  <h4 className="font-bold text-sm">{t('MHRSD Automations', 'أتمتة وزارة الموارد البشرية')}</h4>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-750 rounded-2xl">
                    <div>
                      <span className="font-semibold text-sm">{t('Employment Contract Authentication Automation', 'توثيق عقود الموظفين المؤتمت')}</span>
                      <p className="text-xs text-gray-400">{t('Automatically sends signed contracts to Qiwa portal for verification.', 'يرسل عقود العمل الموقعة تلقائياً لبوابة قوى للتصديق عليها.')}</p>
                    </div>
                    <Controller
                      name="qiwa.contractAuthAutomationEnabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-750 rounded-2xl">
                    <div>
                      <span className="font-semibold text-sm">{t('Nitaqat & Saudization Calculator Widget', 'عنصر حساب نطاقات ونسب التوطين')}</span>
                      <p className="text-xs text-gray-400">{t('Display live organization band status directly on the HR dashboard.', 'يعرض نطاق المنشأة الحالي ونسب التوطين في لوحة شؤون الموظفين.')}</p>
                    </div>
                    <Controller
                      name="qiwa.saudizationWidgetEnabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: GOSI / MUDAD */}
            {activeTab === 'gosi' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-6">
                <div className="border-b border-gray-150 dark:border-dark-750 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Building className="w-6 h-6 text-primary-500" />
                      {t('GOSI & Mudad WPS Integration', 'تكامل التأمينات الاجتماعية ومنصة مدد (حماية الأجور)')}
                    </h3>
                    {(config?.gosi?.registrationNumber || config?.mudad?.registrationNumber) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => testConnectionMutation.mutate('gosi')}
                          disabled={testConnectionMutation.isPending}
                          className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform"
                        >
                          {testConnectionMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-primary-500" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          {t('Test', 'اختبار')}
                        </button>
                        <Link to="/app/dashboard/tenant-settings/government-integrations/gosi" className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
                          <Eye className="w-4 h-4 text-emerald-500" />
                          {t('View Dashboard', 'عرض لوحة التحكم')}
                        </Link>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('GOSI and Mudad integration automates your Wage Protection System (WPS) compliance. It seamlessly syncs employee registration data with GOSI and automatically generates and uploads standard .SIF payroll files to Mudad at the end of every billing cycle. This protects your business from labor disputes, salary delays, and Ministry penalties.',
                       'تكامل التأمينات الاجتماعية ومدد يؤتمت التزامك بنظام حماية الأجور (WPS). يقوم بمزامنة بيانات تسجيل الموظفين مع التأمينات بسلاسة، ويقوم تلقائياً بإنشاء ورفع ملفات الأجور القياسية (.SIF) إلى منصة مدد في نهاية كل دورة مالية. هذا يحمي عملك من النزاعات العمالية، تأخير الرواتب، وغرامات الوزارة.')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('GOSI Registration Number', 'رقم التسجيل في التأمينات (GOSI)')}</label>
                    <input
                      type="text"
                      placeholder="e.g. 10982347"
                      {...register('gosi.registrationNumber')}
                      className={`input mt-1 ${errors.gosi?.registrationNumber ? 'border-red-500' : ''}`}
                    />
                    {errors.gosi?.registrationNumber && <p className="text-xs text-red-500 mt-1">{errors.gosi.registrationNumber.message}</p>}
                  </div>

                  <div>
                    <label className="label">{t('Mudad API Client Certificate', 'شهادة عميل واجهة مدد (Client Certificate)')}</label>
                    <textarea
                      rows={3}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      {...register('mudad.clientCertificate')}
                      className={`input font-mono text-xs mt-1 ${errors.mudad?.clientCertificate ? 'border-red-500' : ''}`}
                    />
                    {errors.mudad?.clientCertificate && <p className="text-xs text-red-500 mt-1">{errors.mudad.clientCertificate.message}</p>}
                  </div>
                </div>

                <div className="space-y-3 border-t border-gray-100 dark:border-dark-750 pt-4">
                  <h4 className="font-bold text-sm">{t('Payroll & Compliance', 'الأجور والامتثال')}</h4>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-750 rounded-2xl">
                    <div>
                      <span className="font-semibold text-sm">{t('Automated Monthly .SIF Payroll Upload to Mudad', 'الرفع التلقائي لملفات حماية الأجور (.SIF) إلى مدد')}</span>
                      <p className="text-xs text-gray-400">{t('Generates and signs WPS files, uploading them dynamically at fiscal cutoff.', 'يقوم بإنشاء وتوقيع ملفات الأجور ورفعها تلقائياً عند نهاية الفترة المالية.')}</p>
                    </div>
                    <Controller
                      name="mudad.autoSifUploadEnabled"
                      control={control}
                      render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: INDUSTRY SPECIFIC */}
            {activeTab === 'industry' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-6">
                <div className="border-b border-gray-150 dark:border-dark-750 pb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Sliders className="w-6 h-6 text-primary-500" />
                    {t('Industry Specific Portals', 'التكاملات الخاصة بنوع النشاط')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('Configure niche portal endpoints according to your tenant industry classification.',
                       'تهيئة نقاط الاتصال الحكومية الخاصة بنشاط منشأتك التجاري.')}
                  </p>
                </div>

                <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-2xl">
                  <span className="font-bold text-sm text-primary-700 dark:text-primary-400 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    {t(`Tenant Active Industry: ${industryType.toUpperCase()}`, `نشاط المنشأة الفعال: ${industryType.toUpperCase()}`)}
                  </span>
                  <p className="text-xs text-primary-600 dark:text-primary-300 mt-1">
                    {t('Relevant portal configurations have been prioritized below for easy setup.',
                       'تم تقديم بوابات الربط الأكثر أهمية لنشاطك في الأسفل لتسهيل التهيئة.')}
                  </p>
                </div>

                {/* 1. TRADING: Saber */}
                {industryType === 'trading' && (
                  <div className="space-y-4 border border-gray-100 dark:border-dark-700 p-4 rounded-2xl bg-white dark:bg-dark-800">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">🇸🇦 Saber Platform Integration / منصة سابر للمطابقة</h4>
                    <div>
                      <label className="label text-xs">{t('Saber Access Token', 'رمز الوصول لمنصة سابر')}</label>
                      <input
                        type="password"
                        placeholder="saber_token_••••••••"
                        {...register('industrySpecific.saberToken')}
                        className="input mt-1"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        {t('Saber integration directly links your inventory with the Saudi Standards, Metrology and Quality Organization (SASO). It allows you to instantly fetch product conformity certificates, manage customs clearance documentation securely, and ensure imported goods meet local regulatory standards without navigating external platforms.',
                           'تكامل سابر يربط مخزونك مباشرة بالهيئة السعودية للمواصفات والمقاييس والجودة (SASO). يسمح لك بجلب شهادات مطابقة المنتجات فورياً، وإدارة وثائق التخليص الجمركي بشكل آمن، وضمان تلبية السلع المستوردة للمعايير التنظيمية المحلية دون الحاجة لاستخدام منصات خارجية.')}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. CONSTRUCTION: Etimad */}
                {industryType === 'construction' && (
                  <div className="space-y-4 border border-gray-100 dark:border-dark-700 p-4 rounded-2xl bg-white dark:bg-dark-800">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">🇸🇦 Etimad Portal Sync / بوابة اعتماد للمشتريات الحكومية</h4>
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                      {t('Etimad integration streamlines your participation in government tenders and procurement. It allows automatic syncing of project invoices, financial claims, and contract statuses directly with the Ministry of Finance, ensuring timely payments and strict compliance with public sector regulations.',
                         'تكامل منصة اعتماد يسهل مشاركتك في المناقصات والمشتريات الحكومية. يتيح لك المزامنة التلقائية لفواتير المشاريع، المطالبات المالية، وحالات العقود مباشرة مع وزارة المالية، مما يضمن الدفع في الوقت المناسب والامتثال الصارم للوائح القطاع العام.')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label text-xs">{t('Etimad API Username', 'اسم المستخدم لواجهة اعتماد')}</label>
                        <input
                          type="text"
                          placeholder="etimad_user"
                          {...register('industrySpecific.etimadUser')}
                          className="input mt-1"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">{t('Etimad API Password', 'كلمة مرور واجهة اعتماد')}</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          {...register('industrySpecific.etimadPassword')}
                          className="input mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. CAR RENTAL: TAMM Trafffic verification (handled, but extra fields here) */}
                {industryType === 'car_rental' && (
                  <div className="space-y-4 border border-gray-100 dark:border-dark-700 p-4 rounded-2xl bg-white dark:bg-dark-800">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">🇸🇦 Muqeem Live Resident Verification / الاستعلام الفوري عبر مقيم</h4>
                    <p className="text-xs text-gray-500">
                      {t('Verifies Iqama status, residency duration, and sponsorship status dynamically on booking checkout.',
                         'يتحقق من صلاحية الإقامة ومدة إقامة الوافد ونقل الكفالة فورياً عند حجز وتأجير المركبة.')}
                    </p>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-750 rounded-xl">
                      <span className="text-xs font-semibold">{t('Enable Live Muqeem Verification', 'تفعيل التحقق الفوري عبر مقيم')}</span>
                      <input type="checkbox" defaultChecked className="w-10 h-6 bg-gray-200 rounded-full appearance-none checked:bg-primary-500 relative transition-colors cursor-pointer before:content-[\'\'] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-1 before:left-1 checked:before:left-5 before:transition-all" />
                    </div>
                  </div>
                )}

                {/* 4. RESTAURANT / GROCERY: Balady Platform */}
                {(industryType === 'restaurant' || industryType === 'bakala') && (
                  <div className="space-y-4 border border-gray-100 dark:border-dark-700 p-4 rounded-2xl bg-white dark:bg-dark-800">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">🇸🇦 Balady Platform Integration / منصة بلدي للمجالس البلدية</h4>
                    <div>
                      <label className="label text-xs">{t('Balady License API Key', 'رمز ترخيص منصة بلدي')}</label>
                      <input
                        type="password"
                        placeholder="balady_api_key_••••••••"
                        {...register('industrySpecific.baladyApiKey')}
                        className="input mt-1"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        {t('Balady integration connects your operations with the Ministry of Municipal and Rural Affairs. It automatically tracks the validity of your commercial municipal licenses and employee health certificates, providing proactive alerts to prevent business interruptions and municipal fines.',
                           'تكامل بلدي يربط عملياتك بوزارة الشؤون البلدية والقروية. يقوم بتتبع صلاحية الرخص البلدية التجارية والشهادات الصحية للموظفين تلقائياً، مع تقديم تنبيهات استباقية لمنع توقف العمل وتجنب الغرامات البلدية.')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 flex items-center gap-2 mt-4 bg-gray-50 dark:bg-dark-750 p-3 rounded-xl border border-gray-200/50 dark:border-dark-700/50">
                  <HelpCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>
                    {t('Need to activate integrations for another industry sector? Update your business profiles in the company settings tab.',
                       'هل تحتاج تفعيل تكاملات لقطاع نشاط آخر؟ قم بتحديث أنشطة منشأتك في علامة تبويب إعدادات الشركة.')}
                  </span>
                </div>
              </motion.div>
            )}

            </fieldset>
            {/* FORM FOOTER ACTIONS */}
            {(user?.role === 'super_admin' || user?.role === 'superadmin' || user?.role === 'admin') && (
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-750">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn btn-primary px-6 py-2.5 flex items-center gap-2"
                >
                  {saveMutation.isPending ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  {t('Save Configurations', 'حفظ التكوينات')}
                </button>
              </div>
            )}
            
          </form>
        </div>
      </div>
    </div>
  )
}
