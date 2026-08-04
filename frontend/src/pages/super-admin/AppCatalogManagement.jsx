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
  Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'

const PRICING_TIERS = [
  { value: 'free', labelEn: 'Free', labelAr: 'مجاني', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { value: 'paid', labelEn: 'Paid', labelAr: 'مدفوع', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { value: 'enterprise', labelEn: 'Enterprise', labelAr: 'مؤسسات', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800' }
]

export default function AppCatalogManagement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const isAr = language === 'ar'

  const [search, setSearch] = useState('')
  const [editingApp, setEditingApp] = useState(null)
  const [formState, setFormState] = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-app-catalog'],
    queryFn: () => api.get('/super-admin/app-catalog').then(res => res.data)
  })

  const updateMutation = useMutation({
    mutationFn: ({ appId, payload }) => api.put(`/super-admin/app-catalog/${appId}`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث بيانات التطبيق والأسعار بنجاح' : 'App pricing and details updated successfully')
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

  const apps = data?.apps || []
  const filteredApps = apps.filter(app => {
    const q = search.toLowerCase()
    return !q ||
      app.nameEn?.toLowerCase().includes(q) ||
      app.nameAr?.includes(q) ||
      app.appId?.toLowerCase().includes(q) ||
      app.category?.toLowerCase().includes(q)
  })

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
            {isAr ? 'تحديد أسعار وتوفر تطبيقات وإضافات النظام لجميع المستأجرين' : 'Configure pricing tiers and availability for all system apps and add-ons'}
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Search & Filter */}
      <div className="card p-4 flex items-center gap-4">
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
        <div className="text-xs text-gray-500 font-medium">
          {isAr ? `${filteredApps.length} تطبيق` : `${filteredApps.length} Apps`}
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
            const currentTier = PRICING_TIERS.find(t => t.value === app.pricingTier) || PRICING_TIERS[0]
            return (
              <motion.div
                key={app.appId}
                layout
                className="card p-5 flex flex-col justify-between border hover:border-primary-400/50 hover:shadow-md transition-all relative overflow-hidden"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-xl shadow-inner border border-gray-200 dark:border-dark-600">
                        {app.icon === 'factory' ? '🏭' : app.icon === 'truck' ? '🚛' : app.icon === 'anchor' ? '⚓' : app.icon === 'cpu' ? '📡' : app.icon === 'target' ? '🎯' : app.icon === 'users' ? '👥' : app.icon === 'bike' ? '🛵' : app.icon === 'credit-card' ? '💳' : app.icon === 'shield' ? '🛡️' : app.icon === 'printer' ? '🖨️' : app.icon === 'scale' ? '⚖️' : app.icon === 'message-circle' ? '💬' : app.icon === 'brain' ? '🧠' : '📦'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {isAr ? app.nameAr : app.nameEn}
                        </h3>
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
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                  <span className={`text-xs flex items-center gap-1.5 ${app.isActive !== false ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${app.isActive !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {app.isActive !== false ? (isAr ? 'نشط في المتجر' : 'Active') : (isAr ? 'معطل' : 'Disabled')}
                  </span>

                  <button
                    onClick={() => handleOpenEdit(app)}
                    className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {isAr ? 'تعديل السعر والميزات' : 'Edit Pricing'}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setEditingApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 max-w-xl mx-auto my-auto h-fit max-h-[90vh] overflow-y-auto bg-white dark:bg-dark-800 rounded-2xl shadow-2xl z-50 p-6 border border-gray-200 dark:border-dark-700"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-dark-700 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {isAr ? 'تعديل أسعار التطبيق' : 'Edit App Pricing & Settings'}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">{editingApp.appId}</p>
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
                        onChange={(e) => setFormState(s => ({ ...s, monthlyPrice: Number(e.target.value) }))}
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
                    </div>
                  </div>
                )}

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

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50">
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {isAr ? 'إتاحة التطبيق في المتجر' : 'Publish in App Store'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {isAr ? 'إذا تم تعطيله، لن يتمكن المستأجرون الجدد من رؤيته أو تثبيته' : 'If disabled, tenants will not see or install this app'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) => setFormState(s => ({ ...s, isActive: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
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
    </div>
  )
}
