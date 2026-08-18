import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Sparkles,
  Flame,
  Award,
  Clock,
  Shield,
  Layers,
  Pause,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

export default function GymPlans() {
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    description: '',
    durationDays: 30,
    durationMonths: 1,
    price: 350,
    currency: tenant?.currency || 'SAR',
    accessType: 'all_day',
    allowedFreezeDays: 7,
    includedPtSessions: 0,
    includedClasses: -1,
    includedLocker: false,
    isPopular: false,
    features: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['gym-plans'],
    queryFn: () => api.get('/gym/plans').then((res) => res.data),
  });

  const plans = data?.plans || [];

  const createPlanMutation = useMutation({
    mutationFn: (payload) => {
      const featuresArray = typeof payload.features === 'string'
        ? payload.features.split('\n').filter(Boolean)
        : payload.features;
      return api.post('/gym/plans', { ...payload, features: featuresArray });
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء الخطة بنجاح' : 'Plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-plans'] });
      setShowAddModal(false);
      setFormData({
        nameEn: '',
        nameAr: '',
        description: '',
        durationDays: 30,
        durationMonths: 1,
        price: 350,
        currency: tenant?.currency || 'SAR',
        accessType: 'all_day',
        allowedFreezeDays: 7,
        includedPtSessions: 0,
        includedClasses: -1,
        includedLocker: false,
        isPopular: false,
        features: '',
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create plan');
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id) => api.delete(`/gym/plans/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف الخطة' : 'Plan deleted');
      queryClient.invalidateQueries({ queryKey: ['gym-plans'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete plan');
    },
  });

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'خطط وباقات الاشتراكات' : 'Membership Plans & Pricing'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'باقات العضوية، أوقات الوصول، رصيد أيام التجميد، وجلسات التدريب الشخصي'
                  : 'Define membership tiers, access hours, freeze allowances, and PT inclusions'}
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
          <span>{isAr ? 'إنشاء باقة جديدة' : 'Create New Plan'}</span>
        </button>
      </div>

      {/* ── PLANS GRID ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-2" />
            <p className="text-xs">{isAr ? 'جاري تحميل الباقات...' : 'Loading plans...'}</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="col-span-full py-20 text-center card p-8 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700">
            <CreditCard className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'لا توجد خطط اشتراك مضافة' : 'No Plans Created Yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isAr ? 'أنشئ أول باقة عضوية (مثال: اشتراك شهري، سنوي، VIP) للبدء.' : 'Create your first membership plan (e.g. Monthly, Annual, VIP) to get started.'}
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
            >
              {isAr ? 'إنشاء أول باقة' : 'Create First Plan'}
            </button>
          </div>
        ) : (
          plans.map((plan) => {
            const isPop = plan.isPopular;
            return (
              <div
                key={plan._id}
                className={`card p-6 rounded-3xl bg-white dark:bg-dark-800 border transition-all relative flex flex-col justify-between ${
                  isPop
                    ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                    : 'border-slate-100 dark:border-dark-700 shadow-sm hover:border-slate-300'
                }`}
              >
                {isPop && (
                  <span className="absolute -top-3 start-6 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>{isAr ? 'الأكثر طلباً' : 'Most Popular'}</span>
                  </span>
                )}

                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {isAr ? plan.nameAr || plan.nameEn : plan.nameEn}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">{plan.planCode}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => deletePlanMutation.mutate(plan._id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title={isAr ? 'حذف الباقة' : 'Delete plan'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Price Banner */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-700/40 border border-slate-100 dark:border-dark-600/50 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{plan.currency}</span>
                    <span className="text-[11px] text-slate-400 ms-auto font-medium">
                      / {plan.durationDays} {isAr ? 'يوم' : 'days'}
                    </span>
                  </div>

                  {/* Feature Pills */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{isAr ? 'أوقات الدخول:' : 'Access:'} <strong className="text-slate-900 dark:text-white">{plan.accessType}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Pause className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>{isAr ? 'رصيد التجميد:' : 'Freeze Allowance:'} <strong className="text-slate-900 dark:text-white">{plan.allowedFreezeDays} {isAr ? 'أيام' : 'days'}</strong></span>
                    </div>

                    {plan.includedPtSessions > 0 && (
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>{isAr ? 'جلسات تدريب شخصي PT:' : 'PT Sessions:'} <strong className="text-slate-900 dark:text-white">{plan.includedPtSessions}</strong></span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{isAr ? 'الحصص الجماعية:' : 'Classes:'} <strong className="text-slate-900 dark:text-white">{plan.includedClasses === -1 ? (isAr ? 'غير محدودة' : 'Unlimited') : plan.includedClasses}</strong></span>
                    </div>
                  </div>

                  {/* Bullet points */}
                  {plan.features?.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-dark-700 space-y-1.5">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── ADD PLAN MODAL ───────────────────────────────────────────────────────── */}
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
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'إنشاء باقة اشتراك جديدة' : 'Create New Membership Plan'}
                  </h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createPlanMutation.mutate(formData);
                }}
                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'اسم الباقة بالإنجليزية *' : 'Plan Name (English) *'}</label>
                    <input
                      type="text"
                      required
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                      placeholder="e.g. 1-Month Gold Membership"
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'اسم الباقة بالعربية' : 'Plan Name (Arabic / Local)'}</label>
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                      placeholder="مثال: باقة الشهر الذهبي"
                      className="input mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">{isAr ? 'السعر *' : 'Price *'}</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'العملة' : 'Currency'}</label>
                    <input
                      type="text"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="input mt-1 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'المدة بالأيام *' : 'Duration (Days) *'}</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">{isAr ? 'أيام التجميد المسموحة' : 'Allowed Freeze Days'}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.allowedFreezeDays}
                      onChange={(e) => setFormData({ ...formData, allowedFreezeDays: Number(e.target.value) })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'جلسات تدريب شخصي PT' : 'Included PT Sessions'}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.includedPtSessions}
                      onChange={(e) => setFormData({ ...formData, includedPtSessions: Number(e.target.value) })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'نوع الدخول' : 'Access Type'}</label>
                    <select
                      value={formData.accessType}
                      onChange={(e) => setFormData({ ...formData, accessType: e.target.value })}
                      className="select mt-1"
                    >
                      <option value="all_day">{isAr ? 'طوال اليوم (All Day)' : 'All Day Access'}</option>
                      <option value="morning_offpeak">{isAr ? 'صباحي خارج الذروة' : 'Morning Off-Peak'}</option>
                      <option value="ladies_only">{isAr ? 'سيدات فقط' : 'Ladies Only'}</option>
                      <option value="vip_all_access">{isAr ? 'VIP شامل' : 'VIP All Access'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">{isAr ? 'الميزات الإضافية (كل ميزة في سطر)' : 'Features List (One per line)'}</label>
                  <textarea
                    rows={3}
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    placeholder="Free InBody analysis&#10;Sauna & Jacuzzi access&#10;Towel service"
                    className="input mt-1 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPopular"
                    checked={formData.isPopular}
                    onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isPopular" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isAr ? 'تمييز كباقة الأكثر طلباً (Badge)' : 'Highlight as Most Popular tier'}
                  </label>
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
                    disabled={createPlanMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                  >
                    {createPlanMutation.isPending ? 'Saving...' : isAr ? 'حفظ الخطة' : 'Save Plan'}
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
