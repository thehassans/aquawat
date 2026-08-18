import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { showArabicFields } from '../../lib/saudiTenant'
import { Sun, Calendar, Crown, Gem, GraduationCap, Building, Users, Check, X, Plus, Edit2, Trash2, ShieldCheck, Zap } from 'lucide-react'

export default function GymPlans() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const isMiddleEast = showArabicFields(tenant)
  const currency = tenant?.settings?.currency || 'SAR'
  const queryClient = useQueryClient()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)

  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    planType: 'monthly',
    durationDays: 30,
    price: 299,
    maxFreezeDays: 7,
    includesClasses: true,
    includesPool: false,
    includesLocker: true,
    includesPTSessions: 0,
    branchAccess: 'single',
    isActive: true,
  })

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['gym-plans'],
    queryFn: () => api.get('/api/gym/plans').then(res => res.data.data)
  })

  const plans = plansData || []

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingPlan?._id) {
        return api.put(`/api/gym/plans/${editingPlan._id}`, data)
      }
      return api.post('/api/gym/plans', data)
    },
    onSuccess: () => {
      toast.success(editingPlan ? (isAr ? 'تم تحديث الباقة بنجاح' : 'Plan updated successfully') : (isAr ? 'تم إنشاء الباقة بنجاح' : 'Plan created successfully'))
      queryClient.invalidateQueries(['gym-plans'])
      setIsModalOpen(false)
      setEditingPlan(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ في حفظ الباقة' : 'Failed to save plan'))
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/gym/plans/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الخطة بنجاح' : 'Plan deleted successfully')
      queryClient.invalidateQueries(['gym-plans'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || (isAr ? 'فشل حذف الخطة' : 'Failed to delete plan'))
    }
  })

  const handleOpenModal = (plan = null) => {
    if (plan) {
      setEditingPlan(plan)
      setFormData({
        nameEn: plan.nameEn || '',
        nameAr: plan.nameAr || '',
        descriptionEn: plan.descriptionEn || '',
        descriptionAr: plan.descriptionAr || '',
        planType: plan.planType || 'monthly',
        durationDays: plan.durationDays || 30,
        price: plan.price || 0,
        maxFreezeDays: plan.maxFreezeDays || 0,
        includesClasses: plan.includesClasses ?? true,
        includesPool: plan.includesPool ?? false,
        includesLocker: plan.includesLocker ?? false,
        includesPTSessions: plan.includesPTSessions || 0,
        branchAccess: plan.branchAccess || 'single',
        isActive: plan.isActive ?? true,
      })
    } else {
      setEditingPlan(null)
      setFormData({
        nameEn: '',
        nameAr: '',
        descriptionEn: '',
        descriptionAr: '',
        planType: 'monthly',
        durationDays: 30,
        price: 299,
        maxFreezeDays: 7,
        includesClasses: true,
        includesPool: false,
        includesLocker: false,
        includesPTSessions: 0,
        branchAccess: 'single',
        isActive: true,
      })
    }
    setIsModalOpen(true)
  }

  const handleDelete = (id) => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الخطة؟' : 'Are you sure you want to delete this plan?')) {
      deleteMutation.mutate(id)
    }
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: currency
    }).format(amount || 0)
  }

  const getPlanIcon = (type) => {
    switch (type) {
      case 'day_pass': return <Sun size={28} className="text-amber-500" />
      case 'monthly': return <Calendar size={28} className="text-blue-500" />
      case 'quarterly': return <Zap size={28} className="text-indigo-500" />
      case 'annual': return <Crown size={28} className="text-purple-500" />
      case 'vip': return <Gem size={28} className="text-emerald-500" />
      case 'student': return <GraduationCap size={28} className="text-orange-500" />
      case 'corporate': return <Building size={28} className="text-slate-500" />
      case 'family': return <Users size={28} className="text-pink-500" />
      default: return <Calendar size={28} className="text-blue-500" />
    }
  }

  const handlePlanTypeChange = (type) => {
    let days = 30
    let freeze = 7
    if (type === 'day_pass') { days = 1; freeze = 0; }
    else if (type === 'weekly') { days = 7; freeze = 0; }
    else if (type === 'monthly') { days = 30; freeze = 7; }
    else if (type === 'quarterly') { days = 90; freeze = 14; }
    else if (type === 'semi_annual') { days = 180; freeze = 21; }
    else if (type === 'annual' || type === 'vip') { days = 365; freeze = 30; }
    
    setFormData(prev => ({
      ...prev,
      planType: type,
      durationDays: days,
      maxFreezeDays: freeze
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.nameEn && !formData.nameAr) {
      toast.error(isAr ? 'يرجى إدخال اسم الخطة' : 'Please enter plan name')
      return
    }
    saveMutation.mutate(formData)
  }

  return (
    <div className={`min-h-screen bg-slate-50/50 p-4 md:p-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-50 to-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3">
              <Crown className="w-8 h-8 text-amber-500 fill-amber-500" />
              {isAr ? 'خطط العضوية والأسعار' : 'Membership Plans & Pricing'}
            </h1>
            <p className="text-slate-500 mt-2 text-sm md:text-base">
              {isAr ? 'إدارة باقات النادي الرياضي، المزايا، وفترات التجميد' : 'Manage gym membership tiers, perks, and freeze allowances'}
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal(null)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
          >
            <Plus size={18} />
            {isAr ? 'إضافة باقة جديدة' : 'Create New Plan'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div></div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4">
              <Crown size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">{isAr ? 'لا توجد خطط عضوية' : 'No Membership Plans Yet'}</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-6">
              {isAr ? 'قم بإنشاء باقات الاشتراك الخاصة بصالتك الرياضية (شهرية، سنوية، VIP)' : 'Create your first membership tiers (Monthly, Annual, VIP passes)'}
            </p>
            <button
              onClick={() => handleOpenModal(null)}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800"
            >
              {isAr ? 'إنشاء باقة الآن' : 'Create Plan Now'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                key={plan._id} 
                className={`bg-white rounded-3xl p-6 shadow-sm relative flex flex-col h-full border-2 transition-all hover:shadow-xl ${
                  plan.planType === 'vip' ? 'border-amber-300 shadow-amber-50' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                {!plan.isActive && (
                  <div className="absolute top-4 end-4 bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {isAr ? 'غير نشط' : 'Inactive'}
                  </div>
                )}
                
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 shadow-xs border border-slate-100">
                  {getPlanIcon(plan.planType)}
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-1">
                  {isAr ? (plan.nameAr || plan.nameEn) : (plan.nameEn || plan.nameAr)}
                </h3>
                
                <div className="flex items-baseline gap-1.5 mb-6">
                  <span className="text-3xl font-black text-slate-900">{formatMoney(plan.price)}</span>
                  <span className="text-slate-500 text-xs font-semibold">/ {plan.durationDays} {isAr ? 'يوم' : 'days'}</span>
                </div>

                <div className="flex-1 space-y-2.5 mb-6 text-xs text-slate-600">
                  {plan.includesClasses && (
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full"><Check size={12} /></div>
                      <span className="font-medium">{isAr ? 'يشمل الحصص الجماعية' : 'Group Classes Included'}</span>
                    </div>
                  )}
                  {plan.includesPool && (
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full"><Check size={12} /></div>
                      <span className="font-medium">{isAr ? 'دخول المسبح والجاكوزي' : 'Pool & Jacuzzi Access'}</span>
                    </div>
                  )}
                  {plan.includesLocker && (
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full"><Check size={12} /></div>
                      <span className="font-medium">{isAr ? 'خزانة ملابس مخصصة' : 'Locker Access'}</span>
                    </div>
                  )}
                  {plan.includesPTSessions > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-100 text-emerald-600 p-0.5 rounded-full"><Check size={12} /></div>
                      <span className="font-medium">{plan.includesPTSessions} {isAr ? 'جلسات تدريب شخصي (PT)' : 'PT Sessions Included'}</span>
                    </div>
                  )}
                  {plan.maxFreezeDays > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 text-blue-600 p-0.5 rounded-full"><Check size={12} /></div>
                      <span className="font-medium">{isAr ? `إمكانية تجميد حتى ${plan.maxFreezeDays} يوم` : `Up to ${plan.maxFreezeDays} Freeze Days`}</span>
                    </div>
                  )}
                  {plan.branchAccess === 'all' && (
                    <div className="flex items-center gap-2">
                      <div className="bg-purple-100 text-purple-600 p-0.5 rounded-full"><Check size={12} /></div>
                      <span className="font-medium">{isAr ? 'دخول لجميع الفروع' : 'Multi-Branch Roaming'}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => handleOpenModal(plan)}
                    className="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                  >
                    <Edit2 size={14} /> {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button 
                    onClick={() => handleDelete(plan._id)}
                    className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-rose-100"
                  >
                    <Trash2 size={14} /> {isAr ? 'حذف' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create / Edit Plan Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-2xl relative z-10 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">
                    {editingPlan ? (isAr ? 'تعديل باقة العضوية' : 'Edit Membership Plan') : (isAr ? 'إنشاء باقة عضوية جديدة' : 'Create Membership Plan')}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className={`grid grid-cols-1 ${isMiddleEast ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isMiddleEast ? (isAr ? 'اسم الباقة (بالإنجليزية) *' : 'Plan Name (English) *') : (isAr ? 'اسم الباقة *' : 'Plan Name *')}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1 Month Gold Access"
                        value={formData.nameEn}
                        onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    {isMiddleEast && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'اسم الباقة (بالعربية)' : 'Plan Name (Arabic)'}</label>
                        <input
                          type="text"
                          placeholder="مثال: اشتراك شهر ذهبي"
                          value={formData.nameAr}
                          onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'نوع الباقة' : 'Plan Tier'}</label>
                      <select
                        value={formData.planType}
                        onChange={(e) => handlePlanTypeChange(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="day_pass">{isAr ? 'يومي (Day Pass)' : 'Day Pass'}</option>
                        <option value="weekly">{isAr ? 'أسبوعي (Weekly)' : 'Weekly'}</option>
                        <option value="monthly">{isAr ? 'شهري (Monthly 30d)' : 'Monthly (30 Days)'}</option>
                        <option value="quarterly">{isAr ? '3 أشهر (Quarterly 90d)' : 'Quarterly (90 Days)'}</option>
                        <option value="semi_annual">{isAr ? '6 أشهر (Semi-Annual 180d)' : 'Semi-Annual (180 Days)'}</option>
                        <option value="annual">{isAr ? 'سنوي (Annual 365d)' : 'Annual (365 Days)'}</option>
                        <option value="vip">{isAr ? 'في آي بي (VIP)' : 'VIP Tier'}</option>
                        <option value="student">{isAr ? 'طلاب (Student)' : 'Student Discount'}</option>
                        <option value="corporate">{isAr ? 'شركات (Corporate)' : 'Corporate Pass'}</option>
                        <option value="family">{isAr ? 'عائلي (Family)' : 'Family Plan'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'المدة (بالأيام) *' : 'Duration (Days) *'}</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.durationDays}
                        onChange={(e) => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? `السعر (${currency}) *` : `Price (${currency}) *`}</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'أيام التجميد المسموحة' : 'Max Freeze Days'}</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.maxFreezeDays}
                        onChange={(e) => setFormData({ ...formData, maxFreezeDays: Number(e.target.value) })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'جلسات التدريب الشخصي (PT)' : 'Included PT Sessions'}</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.includesPTSessions}
                        onChange={(e) => setFormData({ ...formData, includesPTSessions: Number(e.target.value) })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  {/* Perks Checklist */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">{isAr ? 'المزايا المشمولة' : 'Included Amenities & Perks'}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={formData.includesClasses}
                          onChange={(e) => setFormData({ ...formData, includesClasses: e.target.checked })}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4"
                        />
                        <span>{isAr ? 'حصص جماعية' : 'Group Classes'}</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={formData.includesPool}
                          onChange={(e) => setFormData({ ...formData, includesPool: e.target.checked })}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4"
                        />
                        <span>{isAr ? 'مسبح وجاكوزي' : 'Pool & Spa'}</span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={formData.includesLocker}
                          onChange={(e) => setFormData({ ...formData, includesLocker: e.target.checked })}
                          className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4"
                        />
                        <span>{isAr ? 'خزانة ملابس' : 'Locker Access'}</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)} 
                      className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button 
                      type="submit"
                      disabled={saveMutation.isLoading}
                      className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-md disabled:opacity-50"
                    >
                      {saveMutation.isLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editingPlan ? (isAr ? 'تحديث الباقة' : 'Update Plan') : (isAr ? 'حفظ الباقة' : 'Save Plan'))}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
