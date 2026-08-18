import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { Users, Plus, Star, Phone, Mail, Award, Activity } from 'lucide-react'

export default function GymTrainers() {
  const { tenant } = useSelector(s => s.auth)
  const language = tenant?.settings?.language || 'en'
  const isAr = language === 'ar'

  const { data: trainersData, isLoading } = useQuery({
    queryKey: ['gym-trainers'],
    queryFn: () => api.get('/api/gym/trainers').then(res => res.data)
  })

  const trainers = trainersData?.data || []

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-50 to-white p-8 rounded-3xl shadow-sm border border-slate-100 backdrop-blur">
        <div>
          <h1 className="text-4xl font-black text-slate-800 flex items-center gap-4">
            <Star className="w-10 h-10 text-yellow-500 fill-yellow-500" />
            {isAr ? 'المدربون والكوتشات' : 'Trainers & Coaches'}
          </h1>
          <p className="text-slate-500 mt-3 text-lg flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
              {trainers.length} {isAr ? 'مدرب' : 'Trainers'}
            </span>
            {isAr ? 'إدارة فريق التدريب الخاص بك' : 'Manage your coaching team'}
          </p>
        </div>
        <button 
          className="mt-6 md:mt-0 flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 font-bold"
        >
          <Plus className="w-5 h-5" />
          {isAr ? 'إضافة مدرب' : 'Add Trainer'}
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center p-12"><Activity className="w-10 h-10 text-indigo-500 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((trainer, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={trainer._id}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center text-3xl font-black shadow-lg group-hover:scale-105 transition-transform overflow-hidden">
                  {trainer.photoUrl ? (
                    <img src={trainer.photoUrl} alt="Trainer" className="w-full h-full object-cover" />
                  ) : (
                    trainer.nameEn.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">{isAr ? trainer.nameAr : trainer.nameEn}</h3>
                  <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                    <Award className="w-4 h-4 text-rose-500" />
                    {trainer.specializations?.join(', ') || 'General Fitness'}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <span className="font-medium">{trainer.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <span className="font-medium truncate">{trainer.email || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-3xl font-black text-indigo-600">{trainer.activeClasses || 0}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? 'حصص نشطة' : 'Active Classes'}</div>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className="text-3xl font-black text-teal-600">{trainer.ptClients || 0}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isAr ? 'عملاء PT' : 'PT Clients'}</div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                  {isAr ? 'تعديل' : 'Edit'}
                </button>
                <button className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors">
                  {isAr ? 'عرض الملف' : 'View Profile'}
                </button>
              </div>
            </motion.div>
          ))}
          
          {/* Add New Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: trainers.length * 0.1 }}
            className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center min-h-[400px] cursor-pointer group"
          >
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform mb-4">
              <Plus className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-600 group-hover:text-indigo-600">{isAr ? 'إضافة مدرب جديد' : 'Add New Trainer'}</h3>
            <p className="text-slate-400 text-center mt-2 text-sm max-w-[200px]">
              {isAr ? 'انقر هنا لإضافة مدرب جديد إلى فريقك' : 'Click here to add a new trainer to your team'}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  )
}
