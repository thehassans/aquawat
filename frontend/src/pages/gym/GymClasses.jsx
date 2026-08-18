import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Calendar, Plus, Users, Clock, MapPin, Edit, Trash2, X, ChevronRight, ChevronLeft } from 'lucide-react'

export default function GymClasses() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const queryClient = useQueryClient()

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  
  const [selectedDay, setSelectedDay] = useState(new Date().getDay()) // 0 = Sunday
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)

  const { data: classesData, isLoading } = useQuery({
    queryKey: ['gym-classes'],
    queryFn: () => api.get('/api/gym/classes').then(res => res.data)
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/gym/classes/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحذف' : 'Class deleted')
      queryClient.invalidateQueries(['gym-classes'])
      setIsModalOpen(false)
    }
  })

  const classes = classesData?.data || []
  
  const dayClasses = classes.filter(c => c.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const getColor = (type) => {
    const colors = {
      yoga: 'bg-teal-100 text-teal-800 border-teal-200',
      boxing: 'bg-red-100 text-red-800 border-red-200',
      crossfit: 'bg-orange-100 text-orange-800 border-orange-200',
      spinning: 'bg-blue-100 text-blue-800 border-blue-200',
      hiit: 'bg-rose-100 text-rose-800 border-rose-200',
      zumba: 'bg-purple-100 text-purple-800 border-purple-200',
      pilates: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      default: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    }
    return colors[type?.toLowerCase()] || colors.default
  }

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-6 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-50 to-white p-6 rounded-2xl shadow-sm border border-slate-100 backdrop-blur">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            {isAr ? 'جدول الحصص' : 'Class Schedule'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isAr ? 'إدارة حصص النادي والمواعيد' : 'Manage gym classes and timetables'}
          </p>
        </div>
        <button 
          className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium"
        >
          <Plus className="w-5 h-5" />
          {isAr ? 'إضافة حصة' : 'Add Class'}
        </button>
      </div>

      {/* Days Tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 p-2 overflow-x-auto hide-scrollbar">
        {days.map((day, index) => (
          <button
            key={day}
            onClick={() => setSelectedDay(index)}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-center transition-all whitespace-nowrap min-w-[100px] ${
              selectedDay === index 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {isAr ? daysAr[index] : day}
          </button>
        ))}
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : dayClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
            <Calendar className="w-16 h-16 opacity-20" />
            <p className="text-lg">{isAr ? 'لا توجد حصص في هذا اليوم' : 'No classes scheduled for this day'}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dayClasses.map((c, i) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                key={c._id}
                onClick={() => { setSelectedClass(c); setIsModalOpen(true); }}
                className={`p-5 rounded-2xl border cursor-pointer hover:shadow-lg transition-all ${getColor(c.type)}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold">{isAr ? c.nameAr : c.nameEn}</h3>
                  <span className="bg-white/50 px-2 py-1 rounded-md text-xs font-bold uppercase backdrop-blur-sm">
                    {c.difficulty || 'All Levels'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm font-medium opacity-90">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {c.startTime} - {c.endTime}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {c.trainer?.nameEn || 'Trainer'}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {c.room || 'Main Studio'}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-black/10">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>{isAr ? 'التسجيل' : 'Enrolled'}</span>
                    <span>{c.enrolledCount || 0} / {c.capacity}</span>
                  </div>
                  <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-current rounded-full" 
                      style={{ width: `${Math.min(((c.enrolledCount || 0) / c.capacity) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Class Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className={`p-6 text-white ${getColor(selectedClass.type).replace('text-', 'bg-').replace('100', '600')}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase backdrop-blur-md">
                      {selectedClass.type}
                    </span>
                    <h2 className="text-3xl font-black mt-3 mb-1">
                      {isAr ? selectedClass.nameAr : selectedClass.nameEn}
                    </h2>
                    <p className="opacity-90">{selectedClass.trainer?.nameEn}</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 border border-slate-100">
                    <Clock className="w-8 h-8 text-indigo-500" />
                    <div>
                      <div className="text-xs text-slate-500 font-bold uppercase">{isAr ? 'الوقت' : 'Time'}</div>
                      <div className="font-semibold text-slate-800">{selectedClass.startTime}</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 border border-slate-100">
                    <MapPin className="w-8 h-8 text-rose-500" />
                    <div>
                      <div className="text-xs text-slate-500 font-bold uppercase">{isAr ? 'القاعة' : 'Room'}</div>
                      <div className="font-semibold text-slate-800">{selectedClass.room || 'Studio 1'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-2">{isAr ? 'الوصف' : 'Description'}</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {isAr ? selectedClass.descriptionAr : selectedClass.descriptionEn || (isAr ? 'لا يوجد وصف متاح.' : 'No description available.')}
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-colors">
                    {isAr ? 'حجز عضو' : 'Book Member'}
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure?')) deleteMutation.mutate(selectedClass._id)
                    }}
                    className="p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
