import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Plus,
  Activity,
  TrendingDown,
  TrendingUp,
  Calendar,
  CheckCircle2,
  X,
  User,
  Scale,
  Award,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

export default function GymAssessments() {
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    memberId: '',
    weightKg: 78.5,
    heightCm: 175,
    bodyFatPercentage: 19.2,
    skeletalMuscleMassKg: 35.8,
    bmi: 25.6,
    bmrKcal: 1780,
    visceralFatLevel: 5,
    bodyWaterPercentage: 58.4,
    chestCm: 102,
    waistCm: 84,
    armsCm: 37,
    thighsCm: 56,
    notes: '',
  });

  const { data: membersData } = useQuery({
    queryKey: ['gym-members-all'],
    queryFn: () => api.get('/gym/members?limit=100').then((res) => res.data),
  });

  const members = membersData?.members || [];

  // Set default member if not selected
  const activeMemberId = selectedMemberId || (members[0]?._id || '');

  const { data: measurementsData, isLoading } = useQuery({
    queryKey: ['gym-measurements', activeMemberId],
    queryFn: () => api.get(`/gym/members/${activeMemberId}/measurements`).then((res) => res.data),
    enabled: Boolean(activeMemberId),
  });

  const measurements = measurementsData?.measurements || [];
  const latest = measurements[0];
  const previous = measurements[1];

  const createMeasurementMutation = useMutation({
    mutationFn: (payload) => api.post('/gym/measurements', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تسجيل الفحص والقياسات بنجاح' : 'Measurement recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-measurements'] });
      setShowAddModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to record measurement');
    },
  });

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'القياسات البدنية وفحص InBody' : 'InBody & Fitness Assessments'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'متابعة الكتلة العضلية، نسبة الدهون، مؤشر كتلة الجسم، ومحيط العضلات'
                  : 'Track body fat %, skeletal muscle mass, BMI, BMR, and body composition changes'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormData((prev) => ({ ...prev, memberId: activeMemberId }));
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'تسجيل قياس جديد' : 'New InBody Test'}</span>
        </button>
      </div>

      {/* ── MEMBER SELECTOR BAR ─────────────────────────────────────────────────── */}
      <div className="card p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            {isAr ? 'اختر العضو لعرض الفحوصات:' : 'Selected Member:'}
          </span>
        </div>

        <select
          value={activeMemberId}
          onChange={(e) => setSelectedMemberId(e.target.value)}
          className="select max-w-sm w-full text-xs font-bold"
        >
          {members.map((m) => (
            <option key={m._id} value={m._id}>
              {m.nameEn} ({m.memberNumber})
            </option>
          ))}
        </select>
      </div>

      {/* ── COMPARISON KPI METRICS CARDS ─────────────────────────────────────────── */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Weight */}
          <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isAr ? 'الوزن الكلي' : 'Total Weight'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                {latest.weightKg}
              </span>
              <span className="text-xs font-bold text-slate-500">kg</span>
            </div>
            {previous && (
              <p className={`text-[11px] font-bold mt-2 flex items-center gap-1 ${latest.weightKg <= previous.weightKg ? 'text-emerald-600' : 'text-rose-600'}`}>
                {latest.weightKg <= previous.weightKg ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>{(latest.weightKg - previous.weightKg).toFixed(1)} kg {isAr ? 'مقارنة بالسابق' : 'vs last'}</span>
              </p>
            )}
          </div>

          {/* Body Fat % */}
          <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isAr ? 'نسبة الدهون' : 'Body Fat %'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
                {latest.bodyFatPercentage || '—'}%
              </span>
            </div>
            {previous?.bodyFatPercentage && (
              <p className={`text-[11px] font-bold mt-2 flex items-center gap-1 ${latest.bodyFatPercentage <= previous.bodyFatPercentage ? 'text-emerald-600' : 'text-rose-600'}`}>
                {latest.bodyFatPercentage <= previous.bodyFatPercentage ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>{(latest.bodyFatPercentage - previous.bodyFatPercentage).toFixed(1)}% {isAr ? 'تغير' : 'change'}</span>
              </p>
            )}
          </div>

          {/* Muscle Mass */}
          <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isAr ? 'الكتلة العضلية' : 'Skeletal Muscle'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {latest.skeletalMuscleMassKg || '—'}
              </span>
              <span className="text-xs font-bold text-slate-500">kg</span>
            </div>
            {previous?.skeletalMuscleMassKg && (
              <p className="text-[11px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{(latest.skeletalMuscleMassKg - previous.skeletalMuscleMassKg).toFixed(1)} kg {isAr ? 'زيادة عضلية' : 'gained'}</span>
              </p>
            )}
          </div>

          {/* BMI / Water */}
          <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {isAr ? 'مؤشر الكتلة BMI والسعرات BMR' : 'BMI & Metabolic Rate'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {latest.bmi || '—'}
              </span>
              <span className="text-xs text-slate-500 font-mono">({latest.bmrKcal || 0} kcal)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {isAr ? `سوائل الجسم: ${latest.bodyWaterPercentage || 0}%` : `Body Water: ${latest.bodyWaterPercentage || 0}%`}
            </p>
          </div>
        </div>
      )}

      {/* ── MEASUREMENTS HISTORY TABLE ───────────────────────────────────────────── */}
      <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {isAr ? 'سجل الفحوصات والقياسات التاريخية' : 'Historical Assessments Log'}
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-dark-700">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 dark:bg-dark-900 text-slate-500 uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الوزن (kg)' : 'Weight'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الدهون %' : 'Fat %'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'العضلات (kg)' : 'Muscle'}</th>
                <th className="px-4 py-3 text-center">BMI</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الصدر / الخصر / الذراع' : 'Circumference (cm)'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-dark-700 font-mono">
              {measurements.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 font-sans">
                    {isAr ? 'لا توجد قياسات مسجلة لهذا العضو حتى الآن' : 'No measurements logged yet for this member'}
                  </td>
                </tr>
              ) : (
                measurements.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-700/30">
                    <td className="px-4 py-3 font-semibold font-sans text-slate-900 dark:text-white">
                      {new Date(m.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{m.weightKg}</td>
                    <td className="px-4 py-3 text-center text-rose-600 font-bold">{m.bodyFatPercentage || '—'}%</td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-bold">{m.skeletalMuscleMassKg || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">{m.bmi || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {m.chestCm || '—'} / {m.waistCm || '—'} / {m.armsCm || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD ASSESSMENT MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-lg overflow-hidden my-8"
            >
              <div className="p-5 border-b border-slate-100 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Flame className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'تسجيل فحص InBody جديد' : 'New InBody Assessment'}
                  </h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMeasurementMutation.mutate(formData);
                }}
                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                <div>
                  <label className="label">{isAr ? 'اختر العضو *' : 'Member *'}</label>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div>
                    <label className="label">{isAr ? 'الوزن (kg) *' : 'Weight (kg) *'}</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formData.weightKg}
                      onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'الطول (cm) *' : 'Height (cm) *'}</label>
                    <input
                      type="number"
                      required
                      value={formData.heightCm}
                      onChange={(e) => setFormData({ ...formData, heightCm: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'نسبة الدهون %' : 'Body Fat %'}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.bodyFatPercentage}
                      onChange={(e) => setFormData({ ...formData, bodyFatPercentage: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'كتلة العضل (kg)' : 'Muscle (kg)'}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.skeletalMuscleMassKg}
                      onChange={(e) => setFormData({ ...formData, skeletalMuscleMassKg: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div>
                    <label className="label">{isAr ? 'الصدر (cm)' : 'Chest (cm)'}</label>
                    <input
                      type="number"
                      value={formData.chestCm}
                      onChange={(e) => setFormData({ ...formData, chestCm: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'الخصر (cm)' : 'Waist (cm)'}</label>
                    <input
                      type="number"
                      value={formData.waistCm}
                      onChange={(e) => setFormData({ ...formData, waistCm: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'الذراع (cm)' : 'Arms (cm)'}</label>
                    <input
                      type="number"
                      value={formData.armsCm}
                      onChange={(e) => setFormData({ ...formData, armsCm: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'الفخذ (cm)' : 'Thighs (cm)'}</label>
                    <input
                      type="number"
                      value={formData.thighsCm}
                      onChange={(e) => setFormData({ ...formData, thighsCm: Number(e.target.value) })}
                      className="input mt-1"
                    />
                  </div>
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
                    disabled={createMeasurementMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
                  >
                    {createMeasurementMutation.isPending ? 'Saving...' : isAr ? 'حفظ الفحص' : 'Save Assessment'}
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
