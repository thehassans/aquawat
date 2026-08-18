import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Plus,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Calendar,
  Phone,
  MessageCircle,
  Sparkles,
  Dumbbell,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

const WORKOUT_FOCUSES = [
  { id: 'full_body', en: 'Full Body Circuit', ar: 'تمارين شاملة للجسم' },
  { id: 'chest_triceps', en: 'Chest & Triceps Push', ar: 'صدر وترايسبس (دفع)' },
  { id: 'back_biceps', en: 'Back & Biceps Pull', ar: 'ظهر وبايسبس (سحب)' },
  { id: 'legs_glutes', en: 'Legs & Glutes Power', ar: 'أرجل ومؤخرة' },
  { id: 'shoulders_abs', en: 'Shoulders & Core', ar: 'أكتاف وعضلات البطن' },
  { id: 'hiit_cardio', en: 'HIIT & Conditioning', ar: 'كارديو وتحمل عالي الشدة' },
  { id: 'strength_powerlifting', en: 'Heavy Strength / Power', ar: 'قوة بدنية وأوزان ثقيلة' },
  { id: 'rehab_mobility', en: 'Mobility & Rehab', ar: 'إطالات ومرونة وتأهيل' },
];

export default function GymPTSessions() {
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    memberId: '',
    trainerName: '',
    sessionDate: new Date().toISOString().split('T')[0],
    sessionTime: '17:00',
    durationMinutes: 60,
    workoutFocus: 'full_body',
    trainerCommission: 50,
    trainerNotes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['gym-pt-sessions', statusFilter],
    queryFn: () =>
      api.get('/gym/pt-sessions', {
        params: { status: statusFilter === 'all' ? undefined : statusFilter },
      }).then((res) => res.data),
  });

  const { data: membersData } = useQuery({
    queryKey: ['gym-members-all'],
    queryFn: () => api.get('/gym/members?limit=100').then((res) => res.data),
  });

  const sessions = data?.sessions || [];
  const members = membersData?.members || [];

  const createSessionMutation = useMutation({
    mutationFn: (payload) => api.post('/gym/pt-sessions', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم حجز جلسة التدريب بنجاح' : 'PT Session scheduled');
      queryClient.invalidateQueries({ queryKey: ['gym-pt-sessions'] });
      setShowAddModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to schedule session');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/gym/pt-sessions/${id}`, { status }),
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث حالة الجلسة' : 'Session status updated');
      queryClient.invalidateQueries({ queryKey: ['gym-pt-sessions'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update session');
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => api.delete(`/gym/pt-sessions/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الجلسة' : 'Session deleted');
      queryClient.invalidateQueries({ queryKey: ['gym-pt-sessions'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete session');
    },
  });

  const sendWhatsAppReminder = (session) => {
    const member = session.memberId || {};
    if (!member.phone) {
      toast.error(isAr ? 'لا يوجد رقم جوال مسجل' : 'No phone number for member');
      return;
    }
    const cleanPhone = member.phone.replace(/[^0-9]/g, '');
    const dateStr = new Date(session.sessionDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
    const msg = isAr
      ? `مرحباً ${member.nameAr || member.nameEn}، نذكرك بموعد جلسة التدريب الشخصي (PT) الخاصة بك يوم ${dateStr} الساعة ${session.sessionTime} مع المدرب ${session.trainerName}. نراك قريباً في ${tenant?.name || 'النادي'}! 🏋️‍♂️`
      : `Hello ${member.nameEn}, reminder for your upcoming 1-on-1 Personal Training (PT) session on ${dateStr} at ${session.sessionTime} with Coach ${session.trainerName}. See you at ${tenant?.name || 'the gym'}! 🏋️‍♂️`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'جلسات التدريب الشخصي (PT)' : '1-on-1 Personal Training (PT)'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'إدارة جلسات التدريب الفردي، رصيد الحصص، المدربين وعمولات الحصص'
                  : 'Manage private training schedule, trainer commissions, session bank, and workout focus'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'حجز جلسة تدريب' : 'Schedule PT Session'}</span>
        </button>
      </div>

      {/* ── STATUS TABS ─────────────────────────────────────────────────────────── */}
      <div className="card p-3 rounded-2xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'all', en: 'All Sessions', ar: 'جميع الجلسات' },
          { id: 'scheduled', en: 'Scheduled', ar: 'مجدولة' },
          { id: 'completed', en: 'Completed', ar: 'مكتملة' },
          { id: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
          { id: 'no_show', en: 'No-Show', ar: 'لم يحضر' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-700'
            }`}
          >
            {isAr ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* ── SESSIONS LIST ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-2" />
            <p className="text-xs">{isAr ? 'جاري تحميل الجلسات...' : 'Loading PT sessions...'}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="col-span-full py-20 text-center card p-8 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700">
            <Award className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'لا توجد جلسات تدريب مسجلة' : 'No PT Sessions Found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isAr ? 'احجز أول جلسة تدريب شخصي لأحد الأعضاء مع المدرب.' : 'Schedule the first 1-on-1 private training session.'}
            </p>
          </div>
        ) : (
          sessions.map((sess) => {
            const member = sess.memberId || {};
            const isDone = sess.status === 'completed';

            return (
              <div
                key={sess._id}
                className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold text-base shadow-xs">
                      <Dumbbell className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {member.nameEn || 'Member'}
                      </h3>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                        {isAr ? 'المدرب:' : 'Coach:'} {sess.trainerName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteSessionMutation.mutate(sess._id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Timing & Target Focus */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-700/40 border border-slate-100 dark:border-dark-600/50 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(sess.sessionDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{sess.sessionTime} ({sess.durationMinutes}m)</span>
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-dark-600 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{isAr ? 'التركيز:' : 'Focus:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                      {sess.workoutFocus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Actions & WhatsApp Reminder */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => sendWhatsAppReminder(sess)}
                    className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
                    title={isAr ? 'إرسال تذكير عبر الواتساب' : 'Send WhatsApp Reminder'}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تذكير واتساب' : 'WhatsApp'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {sess.status === 'scheduled' ? (
                      <button
                        type="button"
                        onClick={() => updateStatusMutation.mutate({ id: sess._id, status: 'completed' })}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إتمام الجلسة' : 'Done'}</span>
                      </button>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-300 uppercase">
                        {sess.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── ADD PT SESSION MODAL ─────────────────────────────────────────────────── */}
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
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'حجز جلسة تدريب شخصي (PT)' : 'Schedule 1-on-1 PT Session'}
                  </h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createSessionMutation.mutate(formData);
                }}
                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                <div>
                  <label className="label">{isAr ? 'اختر العضو *' : 'Select Member *'}</label>
                  <select
                    required
                    value={formData.memberId}
                    onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                    className="select mt-1"
                  >
                    <option value="">{isAr ? '-- اختر العضو --' : '-- Select Member --'}</option>
                    {members.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.nameEn} ({m.memberNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">{isAr ? 'اسم المدرب الشخصي *' : 'Coach / Trainer Name *'}</label>
                  <input
                    type="text"
                    required
                    value={formData.trainerName}
                    onChange={(e) => setFormData({ ...formData, trainerName: e.target.value })}
                    placeholder="e.g. Coach David"
                    className="input mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'تاريخ الجلسة' : 'Session Date'}</label>
                    <input
                      type="date"
                      required
                      value={formData.sessionDate}
                      onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'وقت البدء' : 'Session Time'}</label>
                    <input
                      type="time"
                      required
                      value={formData.sessionTime}
                      onChange={(e) => setFormData({ ...formData, sessionTime: e.target.value })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">{isAr ? 'التركيز التدريبي' : 'Workout Target Focus'}</label>
                  <select
                    value={formData.workoutFocus}
                    onChange={(e) => setFormData({ ...formData, workoutFocus: e.target.value })}
                    className="select mt-1"
                  >
                    {WORKOUT_FOCUSES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {isAr ? f.ar : f.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">{isAr ? 'ملاحظات المدرب' : 'Trainer Notes'}</label>
                  <input
                    type="text"
                    value={formData.trainerNotes}
                    onChange={(e) => setFormData({ ...formData, trainerNotes: e.target.value })}
                    placeholder="e.g. Focus on squat form and depth"
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
                    disabled={createSessionMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                  >
                    {createSessionMutation.isPending ? 'Scheduling...' : isAr ? 'تأكيد الحجز' : 'Schedule Session'}
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
