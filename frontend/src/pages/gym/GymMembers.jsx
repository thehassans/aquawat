import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  QrCode,
  Printer,
  X,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Flame,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  Trash2,
  Eye,
  Shield,
  Clock,
  Sparkles,
  ExternalLink,
  Lock,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

export default function GymMembers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || '';
  const [search, setSearch] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);

  // Add Member Form State
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    phone: '',
    email: '',
    gender: 'male',
    dob: '',
    identityType: 'national_id',
    identityNumber: '',
    medicalConditions: '',
    fitnessGoal: 'general_fitness',
    notes: '',
  });

  // Freeze Form State
  const [freezeDays, setFreezeDays] = useState(7);
  const [freezeReason, setFreezeReason] = useState('');

  // Subscribe Plan State
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');

  // Fetch Members
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gym-members', page, statusFilter, search],
    queryFn: () =>
      api.get('/gym/members', {
        params: {
          page,
          status: statusFilter || undefined,
          search: search || undefined,
          limit: 15,
        },
      }).then((res) => res.data),
  });

  // Fetch Plans for subscription modal
  const { data: plansData } = useQuery({
    queryKey: ['gym-plans'],
    queryFn: () => api.get('/gym/plans').then((res) => res.data),
  });

  const members = data?.members || [];
  const totalMembers = data?.pagination?.total || members.length;
  const totalPages = data?.pagination?.pages || 1;
  const plans = plansData?.plans || [];

  // Create Member Mutation
  const createMemberMutation = useMutation({
    mutationFn: (payload) => api.post('/gym/members', payload),
    onSuccess: (res) => {
      toast.success(isAr ? 'تم تسجيل العضو بنجاح' : 'Member registered successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-members'] });
      queryClient.invalidateQueries({ queryKey: ['gym-dashboard-stats'] });
      setShowAddModal(false);
      setFormData({
        nameEn: '',
        nameAr: '',
        phone: '',
        email: '',
        gender: 'male',
        dob: '',
        identityType: 'national_id',
        identityNumber: '',
        medicalConditions: '',
        fitnessGoal: 'general_fitness',
        notes: '',
      });
      // Open subscription prompt for newly created member
      if (res.data?.member) {
        setSelectedMember(res.data.member);
        setShowSubscribeModal(true);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to register member');
    },
  });

  // Create Subscription Mutation
  const createSubMutation = useMutation({
    mutationFn: (payload) => api.post('/gym/subscriptions', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تفعيل الاشتراك بنجاح' : 'Subscription activated successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-members'] });
      queryClient.invalidateQueries({ queryKey: ['gym-dashboard-stats'] });
      setShowSubscribeModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create subscription');
    },
  });

  // Freeze Subscription Mutation
  const freezeSubMutation = useMutation({
    mutationFn: ({ subId, freezeDays, freezeReason }) =>
      api.post(`/gym/subscriptions/${subId}/freeze`, { freezeDays, freezeReason }),
    onSuccess: () => {
      toast.success(isAr ? 'تم تجميد الاشتراك بنجاح' : 'Subscription frozen');
      queryClient.invalidateQueries({ queryKey: ['gym-members'] });
      setShowFreezeModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to freeze subscription');
    },
  });

  // Unfreeze Subscription Mutation
  const unfreezeSubMutation = useMutation({
    mutationFn: (subId) => api.post(`/gym/subscriptions/${subId}/unfreeze`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إعادة تفعيل الاشتراك' : 'Subscription reactivated');
      queryClient.invalidateQueries({ queryKey: ['gym-members'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to unfreeze subscription');
    },
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'frozen':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
      case 'expired':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getIdentityLabel = (type) => {
    switch (type) {
      case 'iqama':
        return isAr ? 'رقم الإقامة' : 'Iqama ID';
      case 'nid':
        return isAr ? 'الهوية الوطنية (NID)' : 'Bangladesh NID';
      case 'cnic':
        return isAr ? 'بطاقة الهوية (CNIC)' : 'Pakistan CNIC';
      case 'passport':
        return isAr ? 'جواز السفر' : 'Passport';
      default:
        return isAr ? 'الهوية الوطنية' : 'National ID';
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── TOP HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'دليل وسجل الأعضاء' : 'Members Directory'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'إدارة ملفات الأعضاء، بطاقات العضوية الذكية، تفعيل وتجميد وتجديد الاشتراكات'
                  : 'Manage member profiles, digital QR passes, subscription freezes, and renewals'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAr ? 'إضافة عضو جديد' : 'New Member'}</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER TABS ─────────────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، الجوال، رقم العضوية، الهوية...' : 'Search by name, phone, member ID, national ID...'}
              className="input ps-10 pe-4 !py-2 text-xs sm:text-sm font-medium w-full"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.delete('status'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                !statusFilter
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              {isAr ? 'الكل' : 'All'} ({totalMembers})
            </button>

            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'active'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{isAr ? 'نشط' : 'Active'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'frozen'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'frozen'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>{isAr ? 'مجمد / معلق' : 'Frozen'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams((prev) => { prev.set('status', 'expired'); prev.set('page', '1'); return prev; })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'expired'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-dark-700 dark:text-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{isAr ? 'منتهي' : 'Expired'}</span>
            </button>
          </div>
        </div>

        {/* ── MEMBERS TABLE ────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-dark-700">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:border-dark-700 dark:bg-dark-900/60 dark:text-slate-400 font-bold">
              <tr>
                <th className="px-4 py-3.5 text-start">{isAr ? 'العضو ورقم العضوية' : 'Member & ID'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'بيانات الاتصال والهوية' : 'Contact & Identity'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'الاشتراك الحالي' : 'Active Plan'}</th>
                <th className="px-4 py-3.5 text-start">{isAr ? 'صلاحية الاشتراك' : 'Valid Until'}</th>
                <th className="px-4 py-3.5 text-center">{t('status')}</th>
                <th className="px-4 py-3.5 text-end">{t('actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-2" />
                    <p className="text-xs text-slate-400">{isAr ? 'جاري تحميل الأعضاء...' : 'Loading members...'}</p>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <div className="mx-auto max-w-md space-y-4">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 ring-8 ring-emerald-50/50">
                        <Users className="h-8 w-8" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {isAr ? 'لا يوجد أعضاء مسجلين' : 'No Members Registered'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {isAr ? 'ابدأ بتسجيل أول عضو في النادي وتفعيل باقة الاشتراك.' : 'Register your first gym member and assign a membership plan.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                      >
                        {isAr ? 'تسجيل أول عضو' : 'Add First Member'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const name = isAr ? member.nameAr || member.nameEn : member.nameEn || member.nameAr;
                  const sub = member.activeSubscriptionId;
                  const daysRemaining = sub?.endDate ? Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;

                  return (
                    <tr key={member._id} className="hover:bg-slate-50/80 dark:hover:bg-dark-700/30 transition">
                      {/* Name & Member Number */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-dark-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-sm shadow-xs overflow-hidden">
                            {member.photoUrl ? (
                              <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{name}</p>
                            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">{member.memberNumber}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Identity */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{member.phone}</span>
                          </p>
                          {member.identityNumber && (
                            <p className="text-[10px] text-slate-400">
                              {getIdentityLabel(member.identityType)}: <span className="font-mono">{member.identityNumber}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Active Plan */}
                      <td className="px-4 py-3.5">
                        {sub ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {sub.planId?.nameEn || 'Membership'}
                            </span>
                            {sub.remainingPtSessions > 0 && (
                              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                {sub.remainingPtSessions} {isAr ? 'جلسة تدريب شخصي' : 'PT Sessions left'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMember(member);
                              setShowSubscribeModal(true);
                            }}
                            className="text-xs font-bold text-emerald-600 hover:underline"
                          >
                            {isAr ? '+ تفعيل باقة' : '+ Assign Plan'}
                          </button>
                        )}
                      </td>

                      {/* Expiration Countdown */}
                      <td className="px-4 py-3.5">
                        {sub?.endDate ? (
                          <div>
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
                              {new Date(sub.endDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                            </p>
                            <span className={`text-[10px] font-bold ${daysRemaining <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {daysRemaining > 0 ? (isAr ? `متبقي ${daysRemaining} يوم` : `${daysRemaining} days left`) : (isAr ? 'منتهي الصلاحية' : 'Expired')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(member.status)}`}>
                          <span>{member.status === 'active' ? (isAr ? 'نشط' : 'Active') : member.status === 'frozen' ? (isAr ? 'مجمد' : 'Frozen') : (isAr ? 'منتهي' : 'Expired')}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Digital Pass Modal Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMember(member);
                              setShowPassModal(true);
                            }}
                            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-dark-700 dark:bg-dark-800 dark:text-slate-300"
                            title={isAr ? 'بطاقة العضوية الذكية QR' : 'Digital Member Pass'}
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          {/* Freeze / Unfreeze Action */}
                          {sub && sub.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMember(member);
                                setShowFreezeModal(true);
                              }}
                              className="p-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300"
                              title={isAr ? 'تجميد الاشتراك مؤقتاً' : 'Freeze Subscription'}
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {sub && sub.status === 'frozen' && (
                            <button
                              type="button"
                              onClick={() => unfreezeSubMutation.mutate(sub._id)}
                              className="p-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                              title={isAr ? 'إلغاء التجميد وإعادة التفعيل' : 'Unfreeze & Resume'}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Renew / Assign Plan */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMember(member);
                              setShowSubscribeModal(true);
                            }}
                            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold"
                            title={isAr ? 'تجديد / تفعيل باقة' : 'Renew / Assign Plan'}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DIGITAL MEMBERSHIP PASS MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showPassModal && selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-sm overflow-hidden p-6 text-center space-y-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  {tenant?.name || 'Gym Club'}
                </span>
                <button onClick={() => setShowPassModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Digital Pass Card Body */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 text-white shadow-xl space-y-4 text-center relative overflow-hidden">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 p-1 ring-2 ring-emerald-400/50 overflow-hidden">
                  {selectedMember.photoUrl ? (
                    <img src={selectedMember.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-black text-xl text-emerald-400">
                      {selectedMember.nameEn?.charAt(0)}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">{selectedMember.nameEn}</h3>
                  {selectedMember.nameAr && <p className="text-xs text-slate-300 font-medium">{selectedMember.nameAr}</p>}
                  <p className="text-xs font-mono font-bold text-emerald-400 mt-1">{selectedMember.memberNumber}</p>
                </div>

                <div className="bg-white p-3 rounded-2xl inline-block shadow-lg">
                  <QRCodeSVG value={selectedMember.barcode || selectedMember.memberNumber} size={130} />
                </div>

                <div className="text-[11px] text-slate-300 pt-2 border-t border-white/10 flex justify-between">
                  <span>{isAr ? 'حالة العضوية:' : 'Status:'}</span>
                  <span className="font-bold text-emerald-400 uppercase">{selectedMember.status}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAr ? 'طباعة بطاقة العضوية' : 'Print Member Pass'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ADD MEMBER MODAL (Multi-Country Localized) ───────────────────────────── */}
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
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'تسجيل عضو جديد في النادي' : 'Register New Gym Member'}
                  </h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMemberMutation.mutate(formData);
                }}
                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'الاسم بالإنجليزية *' : 'Full Name (English) *'}</label>
                    <input
                      type="text"
                      required
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'الاسم بالعربية' : 'Full Name (Arabic / Local)'}</label>
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                      placeholder="مثال: محمد عبدالله"
                      className="input mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'رقم الجوال *' : 'Phone Number *'}</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="05xxxxxxxx"
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="member@example.com"
                      className="input mt-1"
                    />
                  </div>
                </div>

                {/* Localized Multi-Country Identity Field */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'نوع وثيقة الإثبات / الهوية' : 'Identity Document Type'}</label>
                    <select
                      value={formData.identityType}
                      onChange={(e) => setFormData({ ...formData, identityType: e.target.value })}
                      className="select mt-1"
                    >
                      <option value="national_id">{isAr ? 'الهوية الوطنية (Saudi / National ID)' : 'National ID'}</option>
                      <option value="iqama">{isAr ? 'الإقامة (Saudi Iqama)' : 'Saudi Iqama ID'}</option>
                      <option value="nid">{isAr ? 'الهوية الوطنية البنغلاديشية (BD NID)' : 'Bangladesh NID'}</option>
                      <option value="cnic">{isAr ? 'بطاقة الهوية الباكستانية (PK CNIC)' : 'Pakistan CNIC'}</option>
                      <option value="passport">{isAr ? 'جواز السفر (Passport)' : 'Passport'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{isAr ? 'رقم الهوية / الإقامة / الوثيقة' : 'Identity / Document Number'}</label>
                    <input
                      type="text"
                      value={formData.identityNumber}
                      onChange={(e) => setFormData({ ...formData, identityNumber: e.target.value })}
                      placeholder="ID / Iqama / NID / CNIC number"
                      className="input mt-1 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">{isAr ? 'الجنس' : 'Gender'}</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="select mt-1"
                    >
                      <option value="male">{isAr ? 'ذكر' : 'Male'}</option>
                      <option value="female">{isAr ? 'أنثى' : 'Female'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{isAr ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'الهدف الرياضي' : 'Fitness Goal'}</label>
                    <select
                      value={formData.fitnessGoal}
                      onChange={(e) => setFormData({ ...formData, fitnessGoal: e.target.value })}
                      className="select mt-1"
                    >
                      <option value="general_fitness">{isAr ? 'لياقة عامة' : 'General Fitness'}</option>
                      <option value="muscle_gain">{isAr ? 'بناء عضلات' : 'Muscle Gain'}</option>
                      <option value="weight_loss">{isAr ? 'خسارة وزن' : 'Weight Loss'}</option>
                      <option value="strength">{isAr ? 'زيادة القوة' : 'Strength'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">{isAr ? 'ملاحظات صحية أو طبية (إن وجدت)' : 'Medical Notes / Health Conditions'}</label>
                  <textarea
                    rows={2}
                    value={formData.medicalConditions}
                    onChange={(e) => setFormData({ ...formData, medicalConditions: e.target.value })}
                    placeholder={isAr ? 'أي إصابات سابقة، ضغط، سكري...' : 'Asthma, knee injury, allergies...'}
                    className="input mt-1 resize-none"
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
                    disabled={createMemberMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2"
                  >
                    {createMemberMutation.isPending ? <span className="animate-spin">⏳</span> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{isAr ? 'حفظ وتسجيل العضو' : 'Save & Continue'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ASSIGN / RENEW PLAN MODAL ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSubscribeModal && selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? 'تفعيل اشتراك جديد' : 'Assign Membership Plan'}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedMember.nameEn} ({selectedMember.memberNumber})</p>
                </div>
                <button onClick={() => setShowSubscribeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="label">{isAr ? 'اختر باقة الاشتراك' : 'Select Plan'}</label>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {plans.map((p) => (
                    <div
                      key={p._id}
                      onClick={() => setSelectedPlanId(p._id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition ${
                        selectedPlanId === p._id
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 dark:border-dark-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{p.nameEn}</span>
                        <span className="font-bold font-mono text-emerald-600">{p.price} {p.currency}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.durationDays} days • {p.accessType}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="label">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="select mt-1"
                  >
                    <option value="card">{isAr ? 'بطاقة بنكية / Mada / Card' : 'Credit / Debit Card'}</option>
                    <option value="cash">{isAr ? 'نقداً (Cash)' : 'Cash'}</option>
                    <option value="tabby">Tabby (4 Payments)</option>
                    <option value="tamara">Tamara (Split in 3)</option>
                    <option value="bkash">bKash / Nagad (Bangladesh)</option>
                    <option value="easypaisa">Easypaisa / JazzCash (Pakistan)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowSubscribeModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!selectedPlanId || createSubMutation.isPending}
                  onClick={() =>
                    createSubMutation.mutate({
                      memberId: selectedMember._id,
                      planId: selectedPlanId,
                      paymentMethod,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {createSubMutation.isPending ? 'Processing...' : isAr ? 'تأكيد وتفعيل الاشتراك' : 'Activate Plan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FREEZE MODAL ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFreezeModal && selectedMember && (
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
                    {isAr ? 'تجميد الاشتراك مؤقتاً' : 'Freeze Subscription'}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedMember.nameEn}</p>
                </div>
                <button onClick={() => setShowFreezeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="label">{isAr ? 'عدد أيام التجميد' : 'Freeze Duration (Days)'}</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={freezeDays}
                    onChange={(e) => setFreezeDays(Number(e.target.value))}
                    className="input mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="label">{isAr ? 'سبب التجميد (سفر، إصابة...)' : 'Reason (Travel, medical...)'}</label>
                  <input
                    type="text"
                    value={freezeReason}
                    onChange={(e) => setFreezeReason(e.target.value)}
                    placeholder="e.g. Vacation / Travel"
                    className="input mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowFreezeModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={freezeSubMutation.isPending}
                  onClick={() =>
                    freezeSubMutation.mutate({
                      subId: selectedMember.activeSubscriptionId?._id || selectedMember.activeSubscriptionId,
                      freezeDays,
                      freezeReason,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
                >
                  {freezeSubMutation.isPending ? 'Processing...' : isAr ? 'تجميد الاشتراك' : 'Freeze Plan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
