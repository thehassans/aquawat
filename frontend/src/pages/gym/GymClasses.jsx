import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Calendar, Plus, Users, Clock, MapPin, Edit, Trash2, X, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react'

export default function GymClasses() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const queryClient = useQueryClient()

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  
  const [selectedDay, setSelectedDay] = useState(new Date().getDay()) // 0 = Sunday
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedMemberId, setSelectedMemberId] = useState('')

  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    classType: 'hiit',
    trainerId: '',
    dayOfWeek: selectedDay,
    startTime: '08:00',
    endTime: '09:00',
    maxCapacity: 20,
    room: 'Studio A',
    difficulty: 'all_levels',
    color: '#3b82f6'
  })

  // Queries
  const { data: classesData, isLoading } = useQuery({
    queryKey: ['gym-classes'],
    queryFn: () => api.get('/api/gym/classes').then(res => res.data)
  })

  const { data: trainersData } = useQuery({
    queryKey: ['gym-trainers'],
    queryFn: () => api.get('/api/gym/trainers').then(res => res.data.data)
  })

  const { data: membersData } = useQuery({
    queryKey: ['gym-members-class-select'],
    queryFn: () => api.get('/api/gym/members?limit=100').then(res => res.data.data?.docs || res.data.data || [])
  })

  const trainers = trainersData || []
  const members = membersData || []
  const classes = classesData?.data || []
  
  const dayClasses = classes.filter(c => c.dayOfWeek === selectedDay)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

  // Mutations
  const createClassMutation = useMutation({
    mutationFn: (data) => api.post('/api/gym/classes', data),
    onSuccess: () => {
      toast.success(isAr ? 'تمت إضافة الحصة بنجاح' : 'Class created successfully')
      queryClient.invalidateQueries(['gym-classes'])
      setIsCreateModalOpen(false)
      setFormData({
        nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '',
        classType: 'hiit', trainerId: '', dayOfWeek: selectedDay,
        startTime: '08:00', endTime: '09:00', maxCapacity: 20,
        room: 'Studio A', difficulty: 'all_levels', color: '#3b82f6'
      })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || (isAr ? 'فشل إنشاء الحصة' : 'Failed to create class'))
    }
  })

  const bookMutation = useMutation({
    mutationFn: ({ classId, memberId, bookingDate }) => 
      api.post(`/api/gym/classes/${classId}/book`, { memberId, bookingDate }),
    onSuccess: () => {
      toast.success(isAr ? 'تم تأكيد حجز الحصة' : 'Booking confirmed')
      queryClient.invalidateQueries(['gym-classes'])
      setIsBookModalOpen(false)
      setSelectedMemberId('')
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || (isAr ? 'فشل حجز الحصة' : 'Booking failed'))
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/gym/classes/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الحصة' : 'Class deleted')
      queryClient.invalidateQueries(['gym-classes'])
      setIsDetailModalOpen(false)
    }
  })

  const getColor = (type) => {
    const colors = {
      yoga: 'bg-teal-50 text-teal-900 border-teal-200 hover:border-teal-300',
      boxing: 'bg-red-50 text-red-900 border-red-200 hover:border-red-300',
      crossfit: 'bg-orange-50 text-orange-900 border-orange-200 hover:border-orange-300',
      spinning: 'bg-blue-50 text-blue-900 border-blue-200 hover:border-blue-300',
      hiit: 'bg-rose-50 text-rose-900 border-rose-200 hover:border-rose-300',
      zumba: 'bg-purple-50 text-purple-900 border-purple-200 hover:border-purple-300',
      pilates: 'bg-cyan-50 text-cyan-900 border-cyan-200 hover:border-cyan-300',
      default: 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:border-indigo-300'
    }
    return colors[type?.toLowerCase()] || colors.default
  }

  const handleOpenCreateModal = () => {
    setFormData(prev => ({ ...prev, dayOfWeek: selectedDay }))
    setIsCreateModalOpen(true)
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!formData.nameEn && !formData.nameAr) {
      toast.error(isAr ? 'يرجى إدخال اسم الحصة' : 'Please enter class name')
      return
    }
    createClassMutation.mutate(formData)
  }

  const handleBookSubmit = (e) => {
    e.preventDefault()
    if (!selectedMemberId) {
      toast.error(isAr ? 'يرجى اختيار العضو' : 'Please select a member')
      return
    }
    bookMutation.mutate({
      classId: selectedClass._id,
      memberId: selectedMemberId,
      bookingDate: new Date().toISOString().split('T')[0]
    })
  }

  return (
    <div className={`p-4 md:p-8 max-w-7xl mx-auto space-y-6 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-50 to-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            {isAr ? 'جدول الحصص الجماعية' : 'Group Class Timetable'}
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base">
            {isAr ? 'جدول الحصص الأسبوعي، السعة، المدربين والحجوزات' : 'Weekly fitness timetable, capacity limits, trainers & member bookings'}
          </p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-indigo-600 text-white px-5 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-md font-bold text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {isAr ? 'إضافة حصة جديدة' : 'Add New Class'}
        </button>
      </div>

      {/* Days Tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 overflow-x-auto hide-scrollbar gap-1">
        {days.map((day, index) => (
          <button
            key={day}
            onClick={() => setSelectedDay(index)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold text-center transition-all whitespace-nowrap min-w-[90px] ${
              selectedDay === index 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isAr ? daysAr[index] : day}
          </button>
        ))}
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 min-h-[450px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : dayClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3 text-center">
            <Calendar className="w-12 h-12 text-slate-300" />
            <h4 className="text-base font-bold text-slate-700">{isAr ? 'لا توجد حصص مجدولة لهذا اليوم' : 'No Classes Scheduled for This Day'}</h4>
            <p className="text-xs text-slate-400 max-w-xs">{isAr ? 'انقر على زر إضافة حصة لجدولة تدريب في هذا اليوم' : 'Click the Add Class button to schedule a session'}</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100"
            >
              {isAr ? 'إضافة حصة الآن' : 'Schedule Class Now'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dayClasses.map((c, i) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                key={c._id}
                onClick={() => { setSelectedClass(c); setIsDetailModalOpen(true); }}
                className={`p-5 rounded-3xl border-2 cursor-pointer hover:shadow-md transition-all ${getColor(c.classType || c.type)}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-slate-900">
                    {isAr ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)}
                  </h3>
                  <span className="bg-white/80 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border border-black/5">
                    {c.difficulty || 'All Levels'}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-xs font-medium opacity-90 text-slate-700 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-mono">{c.startTime} - {c.endTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{c.trainerId?.nameEn || c.trainer?.nameEn || (isAr ? 'كوتش معتمد' : 'Head Coach')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{c.room || 'Studio A'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-black/5">
                  <div className="flex justify-between text-[11px] font-bold mb-1 text-slate-600">
                    <span>{isAr ? 'المقاعد المحجوزة' : 'Capacity'}</span>
                    <span>{c.enrolledCount || 0} / {c.maxCapacity || c.capacity || 20}</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 rounded-full" 
                      style={{ width: `${Math.min(((c.enrolledCount || 0) / (c.maxCapacity || c.capacity || 20)) * 100, 100)}%` }}
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
        {isDetailModalOpen && selectedClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative"
            >
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                      {selectedClass.classType || selectedClass.type || 'FITNESS'}
                    </span>
                    <h2 className="text-2xl font-black mt-2 mb-0.5">
                      {isAr ? (selectedClass.nameAr || selectedClass.nameEn) : (selectedClass.nameEn || selectedClass.nameAr)}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {selectedClass.trainerId?.nameEn || selectedClass.trainer?.nameEn || 'Head Coach'}
                    </p>
                  </div>
                  <button onClick={() => setIsDetailModalOpen(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{isAr ? 'الوقت' : 'Time'}</div>
                    <div className="font-bold text-slate-800 text-sm font-mono">{selectedClass.startTime} - {selectedClass.endTime}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{isAr ? 'القاعة' : 'Room'}</div>
                    <div className="font-bold text-slate-800 text-sm">{selectedClass.room || 'Studio A'}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase text-slate-400 mb-1">{isAr ? 'الوصف' : 'Description'}</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {isAr ? (selectedClass.descriptionAr || selectedClass.descriptionEn) : (selectedClass.descriptionEn || selectedClass.descriptionAr) || (isAr ? 'حصة تدريبية عالية الكفاءة بإشراف مدربين معتمدين.' : 'High performance training session led by certified fitness coaches.')}
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => { setIsDetailModalOpen(false); setIsBookModalOpen(true); }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                  >
                    {isAr ? 'حجز عضو في الحصة' : 'Book Member'}
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(isAr ? 'هل تريد حذف هذه الحصة؟' : 'Delete this class?')) deleteMutation.mutate(selectedClass._id)
                    }}
                    className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Class Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  {isAr ? 'إضافة حصة جديدة' : 'Add New Class'}
                </h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'اسم الحصة (بالإنجليزية) *' : 'Class Name (En) *'}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Morning HIIT Burn"
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'اسم الحصة (بالعربية)' : 'Class Name (Ar)'}</label>
                    <input
                      type="text"
                      placeholder="مثال: حصة حرق دهون الصباحية"
                      value={formData.nameAr}
                      onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'نوع الحصة' : 'Class Type'}</label>
                    <select
                      value={formData.classType}
                      onChange={(e) => setFormData({ ...formData, classType: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="hiit">HIIT / كارديو مكثف</option>
                      <option value="crossfit">CrossFit / كروس فيت</option>
                      <option value="spinning">Spinning / دراجات</option>
                      <option value="yoga">Yoga / يوغا</option>
                      <option value="pilates">Pilates / بيلاتس</option>
                      <option value="boxing">Boxing / ملاكمة</option>
                      <option value="zumba">Zumba / زومبا</option>
                      <option value="swimming">Swimming / سباحة</option>
                      <option value="body_pump">Body Pump / تقوية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'المدرب المسؤول' : 'Trainer / Coach'}</label>
                    <select
                      value={formData.trainerId}
                      onChange={(e) => setFormData({ ...formData, trainerId: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">{isAr ? 'اختر المدرب' : 'Select Trainer'}</option>
                      {trainers.map(t => (
                        <option key={t._id} value={t._id}>
                          {isAr ? (t.nameAr || t.nameEn) : (t.nameEn || t.nameAr)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'اليوم' : 'Day of Week'}</label>
                    <select
                      value={formData.dayOfWeek}
                      onChange={(e) => setFormData({ ...formData, dayOfWeek: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {days.map((d, idx) => (
                        <option key={d} value={idx}>{isAr ? daysAr[idx] : d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'وقت البدء' : 'Start Time'}</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'وقت الانتهاء' : 'End Time'}</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'السعة القصوى' : 'Max Capacity'}</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxCapacity}
                      onChange={(e) => setFormData({ ...formData, maxCapacity: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'القاعة / الاستوديو' : 'Room / Studio'}</label>
                    <input
                      type="text"
                      placeholder="Studio A"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'المستوى' : 'Difficulty'}</label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all_levels">All Levels / جميع المستويات</option>
                      <option value="beginner">Beginner / مبتدئ</option>
                      <option value="intermediate">Intermediate / متوسط</option>
                      <option value="advanced">Advanced / متقدم</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={createClassMutation.isLoading}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    {createClassMutation.isLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الحصة' : 'Save Class')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Book Member Submodal */}
      <AnimatePresence>
        {isBookModalOpen && selectedClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-800">
                  {isAr ? 'تسجيل عضو في الحصة' : 'Book Member into Class'}
                </h3>
                <button onClick={() => setIsBookModalOpen(false)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <div className="bg-indigo-50 p-3 rounded-2xl mb-4 border border-indigo-100 text-xs text-indigo-900">
                <span className="font-bold">{isAr ? (selectedClass.nameAr || selectedClass.nameEn) : selectedClass.nameEn}</span>
                <span className="block mt-0.5 text-indigo-600 font-mono">{selectedClass.startTime} - {selectedClass.endTime} • {selectedClass.room || 'Studio A'}</span>
              </div>

              <form onSubmit={handleBookSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isAr ? 'اختر العضو *' : 'Select Member *'}</label>
                  <select
                    required
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{isAr ? '-- حدد العضو --' : '-- Select Member --'}</option>
                    {members.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.memberNumber} - {isAr ? (m.nameAr || m.nameEn || m.firstName) : (m.nameEn || m.nameAr || m.firstName)} ({m.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsBookModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={bookMutation.isLoading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    {bookMutation.isLoading ? (isAr ? 'جاري الحجز...' : 'Booking...') : (isAr ? 'تأكيد الحجز' : 'Confirm Booking')}
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
