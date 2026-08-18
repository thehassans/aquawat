import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { showArabicFields } from '../../lib/saudiTenant'
import { Users, Plus, Star, Phone, Mail, Award, Activity, X, Check, Camera } from 'lucide-react'

export default function GymTrainers() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const isMiddleEast = showArabicFields(tenant)
  const queryClient = useQueryClient()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    phone: '',
    email: '',
    commissionPercent: 40,
    specializations: [],
    bioEn: '',
    bioAr: '',
  })

  const { data: trainersData, isLoading } = useQuery({
    queryKey: ['gym-trainers'],
    queryFn: () => api.get('/api/gym/trainers').then(res => res.data)
  })

  const trainers = trainersData?.data || []

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/api/gym/trainers', data),
    onSuccess: () => {
      toast.success(isAr ? 'تمت إضافة المدرب بنجاح' : 'Trainer added successfully')
      queryClient.invalidateQueries(['gym-trainers'])
      setIsModalOpen(false)
      setFormData({
        nameEn: '', nameAr: '', phone: '', email: '', commissionPercent: 40,
        specializations: [], bioEn: '', bioAr: ''
      })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || (isAr ? 'فشل إضافة المدرب' : 'Failed to add trainer'))
    }
  })

  const handleSpecializationToggle = (spec) => {
    setFormData(prev => {
      const exists = prev.specializations.includes(spec)
      return {
        ...prev,
        specializations: exists
          ? prev.specializations.filter(s => s !== spec)
          : [...prev.specializations, spec]
      }
    })
  }

  const SPECIALIZATION_OPTIONS = [
    { id: 'weight_loss', en: 'Weight Loss', ar: 'خسارة الوزن' },
    { id: 'muscle_gain', en: 'Muscle Building', ar: 'بناء العضلات' },
    { id: 'crossfit', en: 'CrossFit', ar: 'كروس فيت' },
    { id: 'yoga', en: 'Yoga & Mobility', ar: 'اليوغا والمرونة' },
    { id: 'boxing', en: 'Boxing & MMA', ar: 'الملاكمة والفنون القتالية' },
    { id: 'hiit', en: 'HIIT & Cardio', ar: 'كارديو وتحمل' },
    { id: 'rehabilitation', en: 'Rehabilitation', ar: 'تأهيل إصابات' },
    { id: 'nutrition', en: 'Nutrition', ar: 'التغذية الرياضية' },
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.nameEn && !formData.nameAr) {
      toast.error(isAr ? 'يرجى إدخال اسم المدرب' : 'Please enter trainer name')
      return
    }
    createMutation.mutate(formData)
  }

  return (
    <div className={`p-4 md:p-8 max-w-7xl mx-auto space-y-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-50 to-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3">
            <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
            {isAr ? 'المدربون والكوتشات' : 'Trainers & Coaches'}
          </h1>
          <p className="text-slate-500 mt-2 text-base flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 px-3 py-0.5 rounded-full text-xs font-bold">
              {trainers.length} {isAr ? 'مدرب' : 'Trainers'}
            </span>
            {isAr ? 'إدارة فريق التدريب والكوتشات' : 'Manage your coaching and training team'}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="mt-4 md:mt-0 flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl hover:bg-slate-800 transition-all shadow-md font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          {isAr ? 'إضافة مدرب' : 'Add Trainer'}
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center p-12"><Activity className="w-10 h-10 text-indigo-500 animate-spin" /></div>
      ) : trainers.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center min-h-[350px]">
          <div 
            onClick={() => setIsModalOpen(true)}
            className="w-20 h-20 rounded-full bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center shadow-sm cursor-pointer group transition-all mb-4"
          >
            <Plus className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">{isAr ? 'إضافة مدرب جديد' : 'Add New Trainer'}</h3>
          <p className="text-slate-500 text-sm max-w-sm mb-6">
            {isAr ? 'انقر هنا لإضافة أول مدرب أو كوتش إلى صالتك الرياضية' : 'Click below to add your first trainer or personal coach'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
          >
            {isAr ? 'إضافة مدرب الآن' : 'Add Trainer Now'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((trainer, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={trainer._id}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center text-2xl font-black shadow-md group-hover:scale-105 transition-transform overflow-hidden">
                  {trainer.photoUrl ? (
                    <img src={trainer.photoUrl} alt="Trainer" className="w-full h-full object-cover" />
                  ) : (
                    (trainer.nameEn || trainer.nameAr || 'T').charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {isAr ? (trainer.nameAr || trainer.nameEn) : (trainer.nameEn || trainer.nameAr)}
                  </h3>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                    <Award className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{trainer.specializations?.join(', ') || 'General Fitness'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 mb-6 text-xs">
                <div className="flex items-center gap-2.5 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="font-mono">{trainer.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="font-mono truncate">{trainer.email || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-2xl font-black text-indigo-600">{trainer.activeClasses || 0}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAr ? 'حصص نشطة' : 'Active Classes'}</div>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className="text-2xl font-black text-teal-600">{trainer.commissionPercent || 40}%</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAr ? 'العمولة' : 'Commission'}</div>
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Add New Card */}
          <div
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-50/70 rounded-3xl p-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center min-h-[260px] cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform mb-3">
              <Plus className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-slate-700 group-hover:text-indigo-600">{isAr ? 'إضافة مدرب جديد' : 'Add New Trainer'}</h3>
            <p className="text-slate-400 text-center mt-1 text-xs max-w-[180px]">
              {isAr ? 'انقر هنا لإضافة مدرب جديد' : 'Click to register a new coach'}
            </p>
          </div>
        </div>
      )}

      {/* Add Trainer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 md:p-8 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold text-slate-800 mb-6">
                {isAr ? 'إضافة مدرب جديد' : 'Add New Trainer'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className={`grid grid-cols-1 ${isMiddleEast ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isMiddleEast ? (isAr ? 'الاسم بالإنجليزية *' : 'Name (English) *') : (isAr ? 'اسم المدرب *' : 'Trainer Name *')}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {isMiddleEast && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'الاسم بالعربية' : 'Name (Arabic)'}</label>
                      <input
                        type="text"
                        placeholder="مثال: أحمد علي"
                        value={formData.nameAr}
                        onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'الجوال' : 'Phone Number'}</label>
                    <input
                      type="tel"
                      placeholder="+966 50 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <input
                      type="email"
                      placeholder="trainer@gym.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'نسبة عمولة التدريب الشخصي (%)' : 'PT Commission %'}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{isAr ? 'التخصصات' : 'Specializations'}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SPECIALIZATION_OPTIONS.map(opt => {
                      const selected = formData.specializations.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSpecializationToggle(opt.id)}
                          className={`p-2 rounded-xl text-xs font-medium border text-start flex items-center justify-between transition-all ${
                            selected
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{isAr ? opt.ar : opt.en}</span>
                          {selected && <Check size={14} className="text-indigo-600" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isLoading}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    {createMutation.isLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ المدرب' : 'Save Trainer')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
