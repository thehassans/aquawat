import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store,
  Search,
  DollarSign,
  Edit2,
  Save,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Tag,
  Shield,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import { App3DIcon } from '../../components/ui/App3DIcon'
import SuperAdminPortal, { SA_BACKDROP_Z, SA_MODAL_Z } from '../../components/super-admin/SuperAdminPortal'

const PRICING_TIERS = [
  { value: 'free', labelEn: 'Free', labelAr: 'مجاني', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { value: 'paid', labelEn: 'Paid', labelAr: 'مدفوع', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { value: 'enterprise', labelEn: 'Enterprise', labelAr: 'مؤسسات', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800' }
]

const SAAS_PLANS = [
  { id: 'starter', labelEn: 'Starter', labelAr: 'البداية' },
  { id: 'professional', labelEn: 'Professional', labelAr: 'الاحترافية' },
  { id: 'enterprise', labelEn: 'Enterprise', labelAr: 'المؤسسات' },
]

export default function AppCatalogManagement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const isAr = language === 'ar'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'hidden'
  const [editingApp, setEditingApp] = useState(null)
  const [formState, setFormState] = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-app-catalog'],
    queryFn: () => api.get('/super-admin/app-catalog').then(res => res.data)
  })

  const updateMutation = useMutation({
    mutationFn: ({ appId, payload }) => api.put(`/super-admin/app-catalog/${appId}`, payload),
    onSuccess: (_, variables) => {
      if (variables.payload.isActive !== undefined && Object.keys(variables.payload).length === 1) {
        toast.success(
          variables.payload.isActive
            ? (isAr ? 'تم إظهار التطبيق في متجر التطبيقات' : 'App is now visible in App Store')
            : (isAr ? 'تم إخفاء التطبيق من متجر التطبيقات' : 'App is now hidden from App Store')
        )
      } else {
        toast.success(isAr ? 'تم تحديث بيانات التطبيق والأسعار بنجاح' : 'App pricing and details updated successfully')
      }
      queryClient.invalidateQueries(['super-admin-app-catalog'])
      setEditingApp(null)
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل التحديث' : 'Update failed'))
  })

  const resetMutation = useMutation({
    mutationFn: () => api.post('/super-admin/app-catalog/reset'),
    onSuccess: () => {
      toast.success(isAr ? 'تمت استعادة الإعدادات الافتراضية للكتالوج' : 'App catalog reset to defaults')
      queryClient.invalidateQueries(['super-admin-app-catalog'])
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل إعادة التعيين' : 'Reset failed'))
  })

  const provisionAllMutation = useMutation({
    mutationFn: () => api.post('/super-admin/tenants/provision-all-apps'),
    onSuccess: (res) => {
      toast.success(res.data?.message || (isAr ? 'تم تثبيت التطبيقات لجميع المستأجرين بنجاح' : 'All tenants provisioned successfully'))
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل التثبيت التلقائي' : 'Provisioning failed'))
  })

  const apps = data?.apps || []
  const filteredApps = apps.filter(app => {
    const isAppActive = app.isActive !== false
    if (statusFilter === 'active' && !isAppActive) return false
    if (statusFilter === 'hidden' && isAppActive) return false

    const q = search.toLowerCase()
    return !q ||
      app.nameEn?.toLowerCase().includes(q) ||
      app.nameAr?.includes(q) ||
      app.appId?.toLowerCase().includes(q) ||
      app.category?.toLowerCase().includes(q)
  })

  const handleToggleHide = (app, e) => {
    e.stopPropagation()
    const newActiveState = app.isActive === false
    updateMutation.mutate({
      appId: app.appId,
      payload: { isActive: newActiveState }
    })
  }

  const handleOpenEdit = (app) => {
    setEditingApp(app)
    setFormState({
      nameEn: app.nameEn || '',
      nameAr: app.nameAr || '',
      taglineEn: app.taglineEn || '',
      taglineAr: app.taglineAr || '',
      pricingTier: app.pricingTier || 'free',
      monthlyPrice: app.monthlyPrice || 0,
      yearlyPrice: app.yearlyPrice || 0,
      trialDays: app.trialDays ?? 7,
      includedInPlans: Array.isArray(app.includedInPlans) ? [...app.includedInPlans] : [],
      badge: app.badge || '',
      isActive: app.isActive !== false
    })
  }

  const handleSave = () => {
    if (!editingApp) return
    updateMutation.mutate({
      appId: editingApp.appId,
      payload: formState
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store className="w-6 h-6 text-primary-600" />
            {isAr ? 'إدارة متجر التطبيقات والأسعار' : 'App Store & Pricing Management'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {isAr ? 'تحديد أسعار وإخفاء أو إظهار تطبيقات وإضافات النظام لجميع المستأجرين' : 'Configure pricing tiers, hide or publish system apps and add-ons for all tenants'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm(isAr ? 'هل ترغب في تثبيت وتفعيل جميع التطبيقات الأساسية لجميع المستأجرين الحاليين تلقائياً؟' : 'Auto-provision and install all core apps for all existing tenants?')) {
                provisionAllMutation.mutate()
              }
            }}
            disabled={provisionAllMutation.isPending}
            className="btn btn-primary flex items-center gap-2 text-sm shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            {provisionAllMutation.isPending 
              ? (isAr ? 'جاري التثبيت...' : 'Provisioning...') 
              : (isAr ? 'تثبيت لجميع المستأجرين' : 'Provision All Tenants')}
          </button>
          <button
            onClick={() => {
              if (window.confirm(isAr ? 'هل أنت متأكد من رغبتك في إعادة تعيين الكتالوج للافتراضي؟' : 'Reset app catalog to default presets?')) {
                resetMutation.mutate()
              }
            }}
            disabled={resetMutation.isPending}
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            {isAr ? 'إعادة ضبط للافتراضي' : 'Reset Defaults'}
          </button>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، المعرف، أو الفئة...' : 'Search by name, app ID, or category...'}
            className="input w-full pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-dark-700 p-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-dark-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'الكل' : 'All'} ({apps.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'النشطة والمتاحة' : 'Visible'} ({apps.filter(a => a.isActive !== false).length})
            </button>
            <button
              onClick={() => setStatusFilter('hidden')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'hidden'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'المخفية' : 'Hidden'} ({apps.filter(a => a.isActive === false).length})
            </button>
          </div>
        </div>
      </div>

      {/* App Cards / Table */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 h-48 animate-pulse bg-gray-100 dark:bg-dark-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app) => {
            const isAppActive = app.isActive !== false
            const currentTier = PRICING_TIERS.find(t => t.value === app.pricingTier) || PRICING_TIERS[0]

            return (
              <motion.div
                key={app.appId}
                layout
                className={`card p-5 flex flex-col justify-between border transition-all relative overflow-hidden ${
                  isAppActive
                    ? 'hover:border-primary-400/50 hover:shadow-md'
                    : 'opacity-75 bg-gray-50/50 dark:bg-dark-900/40 border-dashed border-amber-300 dark:border-amber-900/50'
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#1E202E] to-[#12131A] dark:from-[#181A26] dark:to-[#0D0E15] flex items-center justify-center border border-white/10 shadow-md p-1.5 shrink-0">
                        <App3DIcon appId={app.appId} icon={app.icon} path={app.defaultRoute} label={app.nameEn} className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                            {isAr ? app.nameAr : app.nameEn}
                          </h3>
                          {!isAppActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {isAr ? 'مخفي' : 'Hidden'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono">{app.appId}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${currentTier.color}`}>
                      {isAr ? currentTier.labelAr : currentTier.labelEn}
                    </span>
                  </div>

                  {/* Tagline */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                    {isAr ? app.taglineAr : app.taglineEn}
                  </p>

                  {/* Pricing info badge */}
                  <div className="bg-gray-50 dark:bg-dark-700/50 rounded-xl p-3 mb-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{isAr ? 'التسعير الشهري' : 'Monthly Price'}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {app.pricingTier === 'free' ? (isAr ? 'مجاني (0 ر.س)' : 'Free (SAR 0)') : `${app.monthlyPrice || 0} SAR / mo`}
                      </span>
                    </div>
                    {app.pricingTier !== 'free' && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{isAr ? 'التسعير السنوي' : 'Yearly Price'}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{app.yearlyPrice || 0} SAR / yr</span>
                      </div>
                    )}
                    {app.pricingTier !== 'free' && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{isAr ? 'تجربة مجانية' : 'Free trial'}</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {Number(app.trialDays ?? 7) > 0
                            ? (isAr ? `${app.trialDays ?? 7} أيام` : `${app.trialDays ?? 7} days`)
                            : (isAr ? 'بدون تجربة' : 'No trial')}
                        </span>
                      </div>
                    )}
                    {Array.isArray(app.includedInPlans) && app.includedInPlans.length > 0 && (
                      <div className="flex items-start justify-between text-xs gap-2 pt-1 border-t border-gray-100 dark:border-dark-600">
                        <span className="text-gray-500 dark:text-gray-400 shrink-0">{isAr ? 'مجاني في' : 'Free on'}</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-right">
                          {app.includedInPlans.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions: Quick Hide/Show Toggle + Edit */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                  <button
                    onClick={(e) => handleToggleHide(app, e)}
                    disabled={updateMutation.isPending}
                    title={isAppActive ? (isAr ? 'إخفاء التطبيق من المتجر' : 'Hide app from store') : (isAr ? 'إظهار التطبيق في المتجر' : 'Show app in store')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      isAppActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    {isAppActive ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        {isAr ? 'متاح بالمتجر' : 'Visible'}
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        {isAr ? 'مخفي من المتجر' : 'Hidden'}
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(app)}
                    className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {isAr ? 'تعديل السعر والإعدادات' : 'Edit'}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      <SuperAdminPortal>
      <AnimatePresence>
        {editingApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${SA_BACKDROP_Z}`}
              onClick={() => setEditingApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`fixed inset-0 m-auto h-fit w-[min(100%-2rem,36rem)] max-h-[90vh] overflow-y-auto bg-white dark:bg-dark-800 rounded-2xl shadow-2xl ${SA_MODAL_Z} p-6 border border-gray-200 dark:border-dark-700`}
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-700 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#1E202E] to-[#12131A] dark:from-[#181A26] dark:to-[#0D0E15] flex items-center justify-center border border-white/10 shadow-md p-2 shrink-0">
                    <App3DIcon appId={editingApp.appId} icon={editingApp.icon} path={editingApp.defaultRoute} label={editingApp.nameEn} className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {isAr ? 'تعديل أسعار التطبيق والظهور' : 'Edit App Pricing & Visibility'}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono">{editingApp.appId}</p>
                  </div>
                </div>
                <button onClick={() => setEditingApp(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Pricing Tier */}
                <div>
                  <label className="label mb-2 block text-xs font-semibold">{isAr ? 'فئة التسعير' : 'Pricing Tier'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRICING_TIERS.map((tier) => (
                      <button
                        key={tier.value}
                        type="button"
                        onClick={() => setFormState(s => ({ ...s, pricingTier: tier.value }))}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                          formState.pricingTier === tier.value
                            ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                            : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-600'
                        }`}
                      >
                        {isAr ? tier.labelAr : tier.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Fields (only if paid/enterprise) */}
                {formState.pricingTier !== 'free' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1 block text-xs">{isAr ? 'السعر الشهري (ر.س)' : 'Monthly Price (SAR)'}</label>
                      <input
                        type="number"
                        min="0"
                        value={formState.monthlyPrice}
                        onChange={(e) => {
                          const monthlyPrice = Number(e.target.value);
                          setFormState((s) => ({
                            ...s,
                            monthlyPrice,
                            yearlyPrice: Number(s.yearlyPrice) > 0 ? s.yearlyPrice : monthlyPrice * 10,
                          }));
                        }}
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">{isAr ? 'السعر السنوي (ر.س)' : 'Yearly Price (SAR)'}</label>
                      <input
                        type="number"
                        min="0"
                        value={formState.yearlyPrice}
                        onChange={(e) => setFormState(s => ({ ...s, yearlyPrice: Number(e.target.value) }))}
                        className="input w-full text-sm"
                      />
                      <p className="mt-1 text-[10px] text-gray-400">
                        {isAr ? 'اترك 0 ليُحسب تلقائياً = 10 أشهر (شهرين مجاناً).' : 'Leave 0 to auto-bill 10 months (2 months free).'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <label className="label mb-1 block text-xs">{isAr ? 'أيام التجربة المجانية' : 'Free trial days'}</label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={formState.trialDays ?? 7}
                        onChange={(e) => setFormState((s) => ({ ...s, trialDays: Number(e.target.value) }))}
                        className="input w-full text-sm"
                      />
                      <p className="mt-1 text-[10px] text-gray-400">
                        {isAr
                          ? 'افتراضي 7 أيام. مرة واحدة لكل منشأة — إلغاء التثبيت لا يعيد التجربة. 0 = بدون تجربة.'
                          : 'Default 7 days. One trial per tenant — uninstalling does not reset it. 0 = no trial.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Free on selected SaaS plans (e.g. paid on Starter, free on Professional) */}
                <div>
                  <label className="label mb-2 block text-xs font-semibold">
                    {isAr ? 'مجاني ضمن باقات الاشتراك' : 'Included free on SaaS plans'}
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {isAr
                      ? 'مثال: مدفوع في البداية، مجاني في الاحترافية والمؤسسات.'
                      : 'Example: paid on Starter, free on Professional & Enterprise.'}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {SAAS_PLANS.map((plan) => {
                      const selected = (formState.includedInPlans || []).includes(plan.id)
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setFormState((s) => {
                            const current = Array.isArray(s.includedInPlans) ? s.includedInPlans : []
                            const next = selected
                              ? current.filter((p) => p !== plan.id)
                              : [...current, plan.id]
                            return { ...s, includedInPlans: next }
                          })}
                          className={`py-2 px-2 rounded-xl text-[11px] font-semibold border transition-all text-center ${
                            selected
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                              : 'bg-white dark:bg-dark-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-600'
                          }`}
                        >
                          {isAr ? plan.labelAr : plan.labelEn}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Badge */}
                <div>
                  <label className="label mb-1 block text-xs">{isAr ? 'الشارة الترويجية (Badge)' : 'Promotional Badge'}</label>
                  <input
                    type="text"
                    value={formState.badge}
                    onChange={(e) => setFormState(s => ({ ...s, badge: e.target.value }))}
                    placeholder="e.g. Popular, Essential, Enterprise"
                    className="input w-full text-sm"
                  />
                </div>

                {/* Names */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-1 block text-xs">{isAr ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                    <input
                      type="text"
                      value={formState.nameEn}
                      onChange={(e) => setFormState(s => ({ ...s, nameEn: e.target.value }))}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">{isAr ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                    <input
                      type="text"
                      value={formState.nameAr}
                      onChange={(e) => setFormState(s => ({ ...s, nameAr: e.target.value }))}
                      className="input w-full text-sm"
                    />
                  </div>
                </div>

                {/* Hide / Active Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-dark-700/50 border border-gray-200 dark:border-dark-600">
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      {formState.isActive ? (
                        <>
                          <Eye className="w-4 h-4 text-emerald-600" />
                          {isAr ? 'التطبيق متاح وظاهر في المتجر' : 'App is Visible in App Store'}
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 text-amber-600" />
                          {isAr ? 'التطبيق مخفي من المتجر' : 'App is Hidden from App Store'}
                        </>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {isAr ? 'عند إخفاء التطبيق، لن يظهر للمستأجرين في متجر التطبيقات ولا يمكنهم تثبيته' : 'When hidden, tenants cannot see or install this app from the store'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={(e) => setFormState(s => ({ ...s, isActive: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-dark-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-5 mt-5 border-t border-gray-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="btn btn-secondary text-sm"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="btn btn-primary text-sm flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </SuperAdminPortal>
    </div>
  )
}
