import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Dumbbell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar,
  Sparkles,
  QrCode,
  Flame,
  UserPlus,
  Layers,
  ChevronRight,
  RefreshCw,
  CreditCard,
  ShieldAlert,
  Award,
  Zap,
  Lock
} from 'lucide-react';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { formatCurrency } from '../../lib/currency';

export default function GymDashboard() {
  const navigate = useNavigate();
  const { language } = useSelector((state) => state.ui);
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['gym-dashboard-stats'],
    queryFn: () => api.get('/gym/dashboard').then((res) => res.data),
    refetchInterval: 15000, // Live poll every 15s for live floor occupancy
  });

  const stats = data?.stats || {};
  const todayClasses = data?.todayClasses || [];
  const recentCheckIns = data?.recentCheckIns || [];

  const tenantCurrency = tenant?.currency || (isAr ? 'SAR' : 'SAR');
  const revenueTotal = stats.revenueByCurrency?.[tenantCurrency] || Object.values(stats.revenueByCurrency || {})[0] || 0;

  return (
    <div className="space-y-7 pb-16 animate-fade-in">
      {/* ── TOP HERO HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-sky-500/10 dark:from-dark-800 dark:via-dark-850 dark:to-dark-800 p-6 sm:p-7 rounded-3xl border border-emerald-500/20 dark:border-dark-700 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-50 dark:ring-dark-700">
            <Dumbbell className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'إدارة الصالة الرياضية والنادي' : 'Gym & Fitness Management'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{isAr ? 'مباشر' : 'Live Platform'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              {isAr
                ? 'متابعة مباشرة للإشغال، الاشتراكات، الحضور عبر البوابات الذكية، الحصص الجماعية، وقياسات InBody'
                : 'Real-time floor occupancy, member subscriptions, turnstile check-in kiosk, group classes, and InBody fitness analytics'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-dark-700 dark:bg-dark-800 dark:text-slate-300 shadow-xs transition-all"
            title={isAr ? 'تحديث البيانات' : 'Refresh data'}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <Link
            to="/app/dashboard/gym/kiosk"
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 transform active:scale-95"
          >
            <QrCode className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>{isAr ? 'كشك تسجيل الدخول (Kiosk)' : 'Launch Check-In Kiosk'}</span>
          </Link>

          <Link
            to="/app/dashboard/gym/members"
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2 transform active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAr ? 'تسجيل عضو جديد' : 'New Member'}</span>
          </Link>
        </div>
      </div>

      {/* ── LIVE FLOOR OCCUPANCY & METRICS BANNER ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Live Occupancy Gauge Card */}
        <div className="card p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{isAr ? 'الإشغال الحالي بالصالة' : 'Live Floor Occupancy'}</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
              {isAr ? 'آخر ساعتين' : 'Active Now'}
            </span>
          </div>

          <div className="my-4 flex items-baseline gap-2">
            <p className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
              {stats.liveOccupancy || 0}
            </p>
            <span className="text-xs font-semibold text-slate-400">
              {isAr ? 'عضو يتدرب الآن' : 'members training'}
            </span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{isAr ? 'سعة الصالة' : 'Floor Capacity'}</span>
              <span className="font-bold text-white">
                {Math.min(100, Math.round(((stats.liveOccupancy || 0) / 100) * 100))}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, ((stats.liveOccupancy || 0) / 100) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Members Card */}
        <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isAr ? 'الأعضاء النشطين' : 'Active Members'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {stats.activeMembers || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>{isAr ? `إجمالي المسجلين: ${stats.totalMembers || 0}` : `Total registered: ${stats.totalMembers || 0}`}</span>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-dark-700 flex items-center justify-between text-xs font-bold text-emerald-600">
            <span>{isAr ? `+${stats.newMembersThisMonth || 0} هذا الشهر` : `+${stats.newMembersThisMonth || 0} this month`}</span>
            <Link to="/app/dashboard/gym/members" className="hover:underline flex items-center gap-0.5">
              <span>{isAr ? 'عرض' : 'View'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Expiring Soon Card */}
        <div className="card p-5 rounded-3xl bg-gradient-to-br from-amber-50/70 to-white dark:from-dark-800 dark:to-dark-800 border border-amber-200/70 dark:border-amber-900/30 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {isAr ? 'تنتهي خلال 7 أيام' : 'Expiring Soon (7d)'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {stats.expiringSoon || 0}
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-1">
              {isAr ? 'جاهزة للتجديد والتذكير' : 'Needs renewal follow-up'}
            </p>
          </div>
          <div className="pt-2 border-t border-amber-200/60 dark:border-dark-700 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
            <span>{isAr ? `${stats.expiredSubscriptions || 0} منتهية` : `${stats.expiredSubscriptions || 0} expired`}</span>
            <Link to="/app/dashboard/gym/members?status=expired" className="hover:underline flex items-center gap-0.5">
              <span>{isAr ? 'متابعة' : 'Renew'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Check-ins Today Card */}
        <div className="card p-5 rounded-3xl bg-gradient-to-br from-sky-50/70 to-white dark:from-dark-800 dark:to-dark-800 border border-sky-200/70 dark:border-sky-900/30 shadow-sm relative overflow-hidden group hover:border-sky-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              {isAr ? 'حضور اليوم' : 'Today Check-ins'}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {stats.todayCheckIns || 0}
            </p>
            <p className="text-[11px] text-sky-700/80 dark:text-sky-400/80 mt-1">
              {isAr ? 'دخول ناجح عبر البوابات' : 'Successful turnstile scans'}
            </p>
          </div>
          <div className="pt-2 border-t border-sky-200/60 dark:border-dark-700 flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-400">
            <span>{isAr ? 'السجل الكامل' : 'Attendance Log'}</span>
            <Link to="/app/dashboard/gym/kiosk" className="hover:underline flex items-center gap-0.5">
              <span>{isAr ? 'فتح الكشك' : 'Open Kiosk'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── QUICK MODULE NAVIGATION GRID ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          to="/app/dashboard/gym/members"
          className="p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? 'سجل الأعضاء' : 'Members'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'البطاقات والبيانات' : 'Profiles & Passes'}</p>
        </Link>

        <Link
          to="/app/dashboard/gym/kiosk"
          className="p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-900 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <QrCode className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? 'كشك الدخول' : 'Access Kiosk'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'مسح QR الذكي' : 'Live Scanner'}</p>
        </Link>

        <Link
          to="/app/dashboard/gym/plans"
          className="p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? 'خطط الاشتراكات' : 'Plans & Pricing'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'الباقات والتجميد' : 'Tiers & Passes'}</p>
        </Link>

        <Link
          to="/app/dashboard/gym/classes"
          className="p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? 'الحصص الجماعية' : 'Class Timetable'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'كروس فيت ويوجا' : 'CrossFit, HIIT, Yoga'}</p>
        </Link>

        <Link
          to="/app/dashboard/gym/assessments"
          className="p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Flame className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? 'قياسات InBody' : 'InBody & Fitness'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'الوزن والدهون والعضل' : 'Body Composition'}</p>
        </Link>

        <Link
          to="/app/dashboard/gym/lockers"
          className="p-4 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200/70 dark:border-dark-700 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{isAr ? 'إدارة الخزائن' : 'Lockers Matrix'}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'تأجير ومفاتيح' : 'Rentals & Keys'}</p>
        </Link>
      </div>

      {/* ── TODAY'S CLASSES & LIVE RECENT CHECK-INS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Classes */}
        <div className="card p-6 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'حصص وتمارين اليوم' : "Today's Scheduled Classes"}
              </h3>
            </div>
            <Link to="/app/dashboard/gym/classes" className="text-xs font-bold text-emerald-600 hover:underline">
              {isAr ? 'عرض الجدول الكامل' : 'Full Timetable'}
            </Link>
          </div>

          {todayClasses.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">{isAr ? 'لا توجد حصص مجدولة لهذا اليوم' : 'No classes scheduled for today'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((cls) => {
                const bookedCount = cls.attendees?.length || 0;
                const capacityPct = Math.min(100, Math.round((bookedCount / (cls.capacity || 20)) * 100));

                return (
                  <div
                    key={cls._id}
                    className="p-3.5 rounded-2xl border border-slate-100 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-700/30 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-white shadow-sm" style={{ backgroundColor: cls.color || '#10B981' }}>
                        <span className="text-[11px] leading-none">{cls.startTime}</span>
                        <span className="text-[9px] opacity-80 mt-0.5">{cls.durationMinutes}m</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {isAr ? cls.titleAr || cls.titleEn : cls.titleEn}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {cls.instructorName} • {cls.room}
                        </p>
                      </div>
                    </div>

                    <div className="text-end">
                      <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                        {bookedCount} / {cls.capacity}
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-dark-600 mt-1">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${capacityPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Recent Check-Ins */}
        <div className="card p-6 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'آخر عمليات تسجيل الدخول' : 'Live Check-In Stream'}
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {isAr ? 'تحديث لحظي' : 'Real-time'}
            </span>
          </div>

          {recentCheckIns.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <QrCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">{isAr ? 'لا توجد حركات حضور مسجلة حتى الآن' : 'No check-ins logged yet today'}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentCheckIns.map((log) => {
                const member = log.memberId || {};
                const name = isAr ? member.nameAr || member.nameEn || 'عضو' : member.nameEn || member.nameAr || 'Member';
                const timeStr = new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isGranted = log.accessStatus === 'granted';

                return (
                  <div
                    key={log._id}
                    className="p-3 rounded-2xl border border-slate-100 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-700/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-dark-600 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{member.memberNumber || member.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-400">{timeStr}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isGranted ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                        {isGranted ? (isAr ? 'دخول مصرح' : 'Granted') : (isAr ? 'مرفوض' : 'Denied')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
