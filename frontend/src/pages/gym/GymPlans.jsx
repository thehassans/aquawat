import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Sun, Calendar, Crown, Gem, GraduationCap, Building, Users, Check, X, Plus, Edit2, Trash2 } from 'lucide-react'

export default function GymPlans() {
  const { tenant } = useSelector(s => s.auth)
  const language = tenant?.settings?.language || 'en'
  const isAr = language === 'ar'
  const currency = tenant?.settings?.currency || 'SAR'
  const queryClient = useQueryClient()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)

  const { data: plans, isLoading } = useQuery({
    queryKey: ['gym-plans'],
    queryFn: () => api.get('/api/gym/plans').then(res => res.data.data)
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/gym/plans/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الخطة بنجاح' : 'Plan deleted successfully')
      queryClient.invalidateQueries(['gym-plans'])
    }
  })

  const handleDelete = (id) => {
    if(window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الخطة؟' : 'Are you sure you want to delete this plan?')) {
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
    switch(type) {
      case 'daily': return <Sun size={28} className="text-amber-500" />
      case 'monthly': return <Calendar size={28} className="text-blue-500" />
      case 'annual': return <Crown size={28} className="text-purple-500" />
      case 'vip': return <Gem size={28} className="text-emerald-500" />
      case 'student': return <GraduationCap size={28} className="text-orange-500" />
      case 'corporate': return <Building size={28} className="text-slate-500" />
      case 'family': return <Users size={28} className="text-pink-500" />
      default: return <Calendar size={28} className="text-blue-500" />
    }
  }

  return (
    <div className={`min-h-screen bg-slate-50/50 p-4 md:p-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            {isAr ? 'خطط العضوية' : 'Membership Plans'}
          </h1>
          <p className="text-slate-500 mt-1">{isAr ? 'إدارة باقات وأسعار الاشتراكات' : 'Manage subscription packages and pricing'}</p>
        </div>
        <button 
          onClick={() => { setEditingPlan(null); setIsModalOpen(true); }}
          className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus size={20} />
          {isAr ? 'إضافة خطة' : 'Create Plan'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans?.map(plan => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              key={plan._id} 
              className={`bg-white rounded-3xl p-8 shadow-sm relative flex flex-col h-full border-2 transition-all hover:shadow-xl ${plan.type === 'vip' ? 'border-amber-200 shadow-amber-100/50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              {!plan.isActive && (
                <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  {isAr ? 'غير نشط' : 'Inactive'}
                </div>
              )}
              
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                {getPlanIcon(plan.type)}
              </div>
              
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{isAr ? plan.nameAr || plan.nameEn : plan.nameEn || plan.nameAr}</h3>
              
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-slate-900">{formatMoney(plan.price)}</span>
                <span className="text-slate-500 font-medium">/ {plan.durationInDays} {isAr ? 'يوم' : 'days'}</span>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {plan.includesClasses && (
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full"><Check size={16} /></div>
                    {isAr ? 'يشمل حصص جماعية' : 'Group Classes Included'}
                  </div>
                )}
                {plan.includesPool && (
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full"><Check size={16} /></div>
                    {isAr ? 'دخول المسبح' : 'Pool Access'}
                  </div>
                )}
                {plan.includesLocker && (
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full"><Check size={16} /></div>
                    {isAr ? 'خزانة مخصصة' : 'Locker Access'}
                  </div>
                )}
                {plan.includesPTSessions > 0 && (
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full"><Check size={16} /></div>
                    {plan.includesPTSessions} {isAr ? 'جلسات تدريب شخصي' : 'PT Sessions'}
                  </div>
                )}
                {plan.maxFreezeDays > 0 && (
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="bg-blue-100 text-blue-600 p-1 rounded-full"><Check size={16} /></div>
                    {isAr ? `تجميد حتى ${plan.maxFreezeDays} يوم` : `Up to ${plan.maxFreezeDays} Freeze Days`}
                  </div>
                )}
                {plan.branchAccess === 'all' && (
                  <div className="flex items-center gap-3 text-slate-700 font-medium">
                    <div className="bg-purple-100 text-purple-600 p-1 rounded-full"><Check size={16} /></div>
                    {isAr ? 'دخول لجميع الفروع' : 'Multi-Branch Roaming'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button 
                  onClick={() => { setEditingPlan(plan); setIsModalOpen(true); }}
                  className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-200"
                >
                  <Edit2 size={18} /> {isAr ? 'تعديل' : 'Edit'}
                </button>
                <button 
                  onClick={() => handleDelete(plan._id)}
                  className="py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-rose-100"
                >
                  <Trash2 size={18} /> {isAr ? 'حذف' : 'Delete'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Basic modal skeleton - to be fully implemented with react-hook-form in production */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-2xl relative z-10 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{editingPlan ? (isAr ? 'تعديل الخطة' : 'Edit Plan') : (isAr ? 'إنشاء خطة جديدة' : 'Create New Plan')}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"><X size={20} /></button>
              </div>
              
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 text-sm border border-blue-100 flex items-start gap-3">
                <Building className="shrink-0 mt-0.5 text-blue-500" size={18} />
                <p>{isAr ? 'ملاحظة: سيتم احتساب الضريبة تلقائياً بناءً على إعدادات دولتك في النظام.' : 'Note: Taxes will be calculated automatically based on your country settings in the system.'}</p>
              </div>

              <div className="space-y-4">
                <p className="text-slate-500 text-center py-10">{isAr ? 'نموذج الخطة قيد التطوير...' : 'Plan form is under development...'}</p>
                {/* Full form fields would go here */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button className="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-900 transition-colors">{isAr ? 'حفظ الخطة' : 'Save Plan'}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
