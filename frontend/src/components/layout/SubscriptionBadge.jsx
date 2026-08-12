import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, CalendarDays, Zap, TrendingUp, ChevronDown, AlertTriangle, XCircle, Sparkles, CreditCard, ArrowRight } from 'lucide-react';
import {
  formatSubscriptionDate,
  getPlanDisplayName,
  getPlanShortName,
  getSubscriptionState,
} from '../../lib/subscriptionState';

export default function SubscriptionBadge({ tenant, language }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!tenant || !tenant.subscription) return null;

  const state = getSubscriptionState(tenant);
  const { plan, startDate, endDate, status } = {
    plan: state.plan,
    startDate: state.startDate,
    endDate: state.endDate,
    status: state.status,
  };

  if (plan === 'trial' && status !== 'active' && !endDate && !state.isExpired) return null;

  const isAr = language === 'ar';
  const isDemoPending = state.isDemoPending;
  const isTrialPlan = state.isTrialPlan;
  const isExpired = state.isExpired;
  const isTrialEnded = state.isTrialEnded;
  const isExpiringSoon = state.isExpiringSoon;
  const daysLeft = state.daysLeft;

  const getPlanConfig = () => {
    switch (plan) {
      case 'starter':
        return {
          name: getPlanDisplayName(plan, language),
          shortName: getPlanShortName(plan, language),
          gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
          triggerBorder: 'border-emerald-200/90 dark:border-emerald-800/50',
          icon: Zap,
        };
      case 'professional':
        return {
          name: getPlanDisplayName(plan, language),
          shortName: getPlanShortName(plan, language),
          gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
          triggerBorder: 'border-violet-200/90 dark:border-violet-800/50',
          icon: TrendingUp,
        };
      case 'enterprise':
        return {
          name: getPlanDisplayName(plan, language),
          shortName: getPlanShortName(plan, language),
          gradient: 'from-amber-400 via-orange-500 to-rose-500',
          triggerBorder: 'border-amber-300/90 dark:border-amber-700/50',
          icon: Crown,
        };
      case 'trial':
      default:
        return {
          name: getPlanDisplayName(plan, language),
          shortName: getPlanShortName(plan, language),
          gradient: 'from-amber-500 via-orange-500 to-orange-600',
          triggerBorder: 'border-amber-300/80 dark:border-amber-700/40',
          icon: Crown,
        };
    }
  };

  const cfg = getPlanConfig();
  const PlanIcon = cfg.icon;

  const goToCheckout = () => {
    setOpen(false);
    navigate('/demo-checkout');
  };

  const statusLabel = () => {
    if (isTrialEnded) return isAr ? 'انتهت التجربة' : 'Trial Ended';
    if (isExpired) return isAr ? 'منتهي' : 'Expired';
    return isAr ? 'نشط' : 'Active';
  };

  const ctaLabel = () => {
    if (isTrialEnded) return isAr ? 'اشترك الآن' : 'Subscribe Now';
    if (isExpired) return isAr ? 'تجديد الاشتراك' : 'Renew & Pay';
    if (isTrialPlan || isDemoPending) return isAr ? 'اشترك وادفع' : 'Subscribe & Pay';
    if (isExpiringSoon) return isAr ? 'ترقية / تجديد' : 'Upgrade / Renew';
    return isAr ? 'تغيير الباقة' : 'Change Plan';
  };

  const formatDate = (dateString) => formatSubscriptionDate(dateString, language);

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          group relative flex items-center gap-2.5 rounded-full px-2.5 py-1.5
          bg-white/95 dark:bg-dark-800/95 backdrop-blur-sm
          border ${isExpired ? 'border-red-300 dark:border-red-800/60' : cfg.triggerBorder}
          shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)]
          hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.45)]
          transition-all duration-200 ease-out focus:outline-none
        `}
      >
        <span className={`
          flex h-8 w-8 items-center justify-center rounded-full
          bg-gradient-to-br ${isExpired ? 'from-red-500 to-rose-600' : cfg.gradient}
          text-white shadow-md ring-2 ring-white/40 dark:ring-white/10
          group-hover:scale-[1.04] transition-transform
        `}>
          <PlanIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
        </span>

        <div className="flex min-w-[88px] flex-col items-start leading-tight text-start">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            {isAr ? 'الباقة الحالية' : 'CURRENT PLAN'}
          </span>
          <span className="text-[13px] font-black tracking-tight text-slate-900 dark:text-white">
            {cfg.shortName}
          </span>
          {isExpired && (
            <span className="mt-0.5 text-[9px] font-bold text-red-500">
              {statusLabel()}
            </span>
          )}
        </div>

        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-amber-500' : 'group-hover:text-slate-600'}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-full end-0 z-50 mt-3 w-[22rem]">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white shadow-[0_32px_64px_-24px_rgba(15,23,42,0.55)] ring-1 ring-black/5 dark:bg-dark-800 dark:ring-white/10">
              {/* Premium header */}
              <div className={`relative overflow-hidden px-5 pb-5 pt-5 text-white ${
                isExpired
                  ? 'bg-gradient-to-br from-[#0b0f1a] via-[#1a0b12] to-[#3f0d1c]'
                  : 'bg-gradient-to-br from-[#0b1220] via-[#101826] to-[#0f1f1a]'
              }`}>
                <div className={`pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full blur-3xl opacity-50 ${isExpired ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '18px 18px',
                  }}
                />

                <div className="relative flex items-center gap-3.5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ring-2 ring-white/20 ${
                    isExpired ? 'from-red-500 to-rose-600' : cfg.gradient
                  }`}>
                    <PlanIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/95">
                      <Sparkles className="h-3 w-3" />
                      {isAr ? 'اشتراكك' : 'YOUR SUBSCRIPTION'}
                    </p>
                    <h3 className="mt-1 truncate text-[1.35rem] font-black leading-none tracking-tight text-white">
                      {cfg.name}
                    </h3>
                  </div>
                </div>

                <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                    isExpired
                      ? 'bg-red-500/15 text-red-200 border-red-400/30'
                      : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isExpired ? 'bg-red-300' : 'bg-emerald-300 animate-pulse'}`} />
                    {statusLabel()}
                  </span>
                  {!isExpired && daysLeft !== null && (
                    <span className="text-[11px] font-semibold text-white/55">
                      {isAr ? `${daysLeft} يوم متبقي` : `${daysLeft} days left`}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="space-y-3 bg-white p-5 dark:bg-dark-800">
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 dark:border-dark-600 dark:bg-dark-700/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-dark-600">
                      <CalendarDays className="h-4 w-4 text-violet-500" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {isAr ? 'تاريخ البدء' : 'Start Date'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {formatDate(startDate)}
                  </span>
                </div>

                {isExpired && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 dark:border-red-800/40 dark:bg-red-950/30">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-bold text-red-700 dark:text-red-300">
                        {isTrialEnded
                          ? (isAr ? 'انتهت فترة التجربة' : 'Trial Ended')
                          : (isAr ? 'انتهى الاشتراك' : 'Subscription expired')}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-red-600/90 dark:text-red-400">
                        {isAr
                          ? 'النظام مفتوح — اختر باقة للمتابعة.'
                          : 'Workspace stays open — choose a plan to continue.'}
                      </p>
                    </div>
                  </div>
                )}

                {isExpiringSoon && !isExpired && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-800/40 dark:bg-amber-950/30">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {isAr ? `متبقي ${daysLeft} أيام على الانتهاء.` : `Only ${daysLeft} days remaining.`}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={goToCheckout}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-95 ${
                    isExpired
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/25'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/25'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  {ctaLabel()}
                  <ArrowRight className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
                </button>

                <p className="text-center text-[10px] text-slate-400">
                  {isAr ? 'يمكنك ترقية أو تغيير باقتك في أي وقت' : 'You can upgrade or change your plan anytime'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
