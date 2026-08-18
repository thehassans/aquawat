import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Plus,
  Clock,
  Users,
  CheckCircle2,
  X,
  Trash2,
  Sparkles,
  Flame,
  Dumbbell,
  UserCheck,
  Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

const DAYS_OF_WEEK = [
  { id: 0, en: 'Sunday', ar: 'الأحد' },
  { id: 1, en: 'Monday', ar: 'الاثنين' },
  { id: 2, en: 'Tuesday', ar: 'الثلاثاء' },
  { id: 3, en: 'Wednesday', ar: 'الأربعاء' },
  { id: 4, en: 'Thursday', ar: 'الخميس' },
  { id: 5, en: 'Friday', ar: 'الجمعة' },
  { id: 6, en: 'Saturday', ar: 'السبت' },
];

export default function GymClasses() {
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [bookMemberId, setBookMemberId] = useState('');

  // Class Form State
  const [formData, setFormData] = useState({
    titleEn: '',
    titleAr: '',
    category: 'hiit',
    instructorName: '',
    room: 'Main Studio',
    capacity: 20,
    startTime: '18:00',
    endTime: '19:00',
    durationMinutes: 60,
    daysOfWeek: [0, 1, 2, 3, 4],
    color: '#10B981',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['gym-classes'],
    queryFn: () => api.get('/gym/classes').then((res) => res.data),
  });

  const { data: membersData } = useQuery({
    queryKey: ['gym-members-active'],
    queryFn: () => api.get('/gym/members?status=active&limit=100').then((res) => res.data),
  });

  const classes = data?.classes || [];
  const activeMembers = membersData?.members || [];

  const filteredClasses = classes.filter((cls) => {
    const matchesDay = cls.daysOfWeek?.includes(selectedDay);
    const matchesCat = selectedCategory === 'all' || cls.category === selectedCategory;
    return matchesDay && matchesCat;
  });

  const createClassMutation = useMutation({
    mutationFn: (payload) => api.post('/gym/classes', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تمت إضافة الحصة بنجاح' : 'Class added successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-classes'] });
      setShowAddModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to add class');
    },
  });

  const bookMemberMutation = useMutation({
    mutationFn: ({ classId, memberId }) =>
      api.post(`/gym/classes/${classId}/book`, { memberId }),
    onSuccess: () => {
      toast.success(isAr ? 'تم حجز المقعد بنجاح' : 'Class booked successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-classes'] });
      setShowBookModal(false);
      setBookMemberId('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to book class');
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id) => api.delete(`/gym/classes/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الحصة' : 'Class deleted');
      queryClient.invalidateQueries({ queryKey: ['gym-classes'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete class');
    },
  });

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'جدول الحصص والتمارين الجماعية' : 'Group Classes & Timetable'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'إدارة جدول الحصص، سعة المقاعد، المدربين، وحجز المشتركين'
                  : 'Manage studio schedule, trainers, seat capacity, and member bookings'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow-md shadow-amber-600/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'إضافة حصة تدريبية' : 'Add New Class'}</span>
        </button>
      </div>

      {/* ── DAYS OF WEEK SELECTOR TABS ───────────────────────────────────────────── */}
      <div className="card p-3 rounded-2xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none">
        {DAYS_OF_WEEK.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedDay(d.id)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
              selectedDay === d.id
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-700'
            }`}
          >
            {isAr ? d.ar : d.en}
          </button>
        ))}
      </div>

      {/* ── CLASSES GRID ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-2" />
            <p className="text-xs">{isAr ? 'جاري تحميل الحصص...' : 'Loading classes...'}</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="col-span-full py-20 text-center card p-8 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700">
            <Calendar className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'لا توجد حصص مجدولة لهذا اليوم' : 'No Classes Scheduled for This Day'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isAr ? 'أضف حصة جديدة أو اختر يوماً آخر من الأسبوع.' : 'Add a new group class or select another day of the week.'}
            </p>
          </div>
        ) : (
          filteredClasses.map((cls) => {
            const booked = cls.attendees?.length || 0;
            const cap = cls.capacity || 20;
            const pct = Math.min(100, Math.round((booked / cap) * 100));
            const isFull = booked >= cap;

            return (
              <div
                key={cls._id}
                className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white font-mono font-bold shadow-xs"
                      style={{ backgroundColor: cls.color || '#10B981' }}
                    >
                      <span className="text-xs leading-none">{cls.startTime}</span>
                      <span className="text-[9px] opacity-80 mt-0.5">{cls.durationMinutes}m</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {isAr ? cls.titleAr || cls.titleEn : cls.titleEn}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cls.instructorName} • {cls.room}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteClassMutation.mutate(cls._id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Seat Capacity Bar */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-dark-700/40 border border-slate-100 dark:border-dark-600/50">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{isAr ? 'حجز المقاعد:' : 'Seats Booked:'}</span>
                    <span className="font-mono">{booked} / {cap}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-dark-600 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-700">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-300 uppercase font-bold">
                    {cls.category}
                  </span>

                  <button
                    type="button"
                    disabled={isFull}
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowBookModal(true);
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isFull
                        ? 'bg-slate-100 text-slate-400 dark:bg-dark-700 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{isFull ? (isAr ? 'مكتمل' : 'Full') : (isAr ? 'حجز عضو' : 'Book Member')}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── BOOK MEMBER MODAL ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBookModal && selectedClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-sm overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'حجز مقعد في الحصة' : 'Book Member into Class'}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedClass.titleEn} ({selectedClass.startTime})</p>
                </div>
                <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="label">{isAr ? 'اختر العضو المسجل' : 'Select Active Member'}</label>
                <select
                  value={bookMemberId}
                  onChange={(e) => setBookMemberId(e.target.value)}
                  className="select mt-1"
                >
                  <option value="">{isAr ? '-- اختر العضو --' : '-- Select Member --'}</option>
                  {activeMembers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.nameEn} ({m.memberNumber}) - {m.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!bookMemberId || bookMemberMutation.isPending}
                  onClick={() =>
                    bookMemberMutation.mutate({
                      classId: selectedClass._id,
                      memberId: bookMemberId,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {bookMemberMutation.isPending ? 'Booking...' : isAr ? 'تأكيد الحجز' : 'Confirm Booking'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ADD CLASS MODAL ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-md overflow-hidden my-8"
            >
              <div className="p-5 border-b border-slate-100 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'إضافة حصة تدريبية جديدة' : 'Add Group Class'}
                  </h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createClassMutation.mutate(formData);
                }}
                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                <div>
                  <label className="label">{isAr ? 'اسم الحصة (English) *' : 'Class Title (English) *'}</label>
                  <input
                    type="text"
                    required
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    placeholder="e.g. Morning CrossFit WOD"
                    className="input mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'النوع / التصنيف' : 'Category'}</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="select mt-1"
                    >
                      <option value="crossfit">CrossFit</option>
                      <option value="yoga">Yoga</option>
                      <option value="spinning">Spinning / Cycling</option>
                      <option value="boxing">Boxing / Kickboxing</option>
                      <option value="hiit">HIIT</option>
                      <option value="pilates">Pilates</option>
                      <option value="bodypump">BodyPump</option>
                      <option value="zumba">Zumba</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{isAr ? 'اسم المدرب *' : 'Instructor Name *'}</label>
                    <input
                      type="text"
                      required
                      value={formData.instructorName}
                      onChange={(e) => setFormData({ ...formData, instructorName: e.target.value })}
                      placeholder="e.g. Coach Alex"
                      className="input mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'وقت البدء (HH:MM)' : 'Start Time'}</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'سعة المقاعد' : 'Max Capacity'}</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">{isAr ? 'الصالة / القاعة' : 'Studio / Room'}</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="e.g. Studio A, Boxing Arena"
                    className="input mt-1"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createClassMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md"
                  >
                    {createClassMutation.isPending ? 'Saving...' : isAr ? 'حفظ الحصة' : 'Save Class'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
