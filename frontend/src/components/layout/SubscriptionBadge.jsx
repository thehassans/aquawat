import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import {
  formatPlanLimit,
  formatSubscriptionDate,
  getPlanDisplayName,
  getPlanLimits,
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

  const planName = getPlanDisplayName(plan, language);
  const shortName = getPlanShortName(plan, language);
  const limits = getPlanLimits(tenant);

  const goToCheckout = () => {
    setOpen(false);
    navigate('/demo-checkout');
  };

  const statusLabel = () => {
    if (isTrialEnded) return isAr ? 'انتهت التجربة' : 'Trial Ended';
    if (isExpired) return isAr ? 'منتهي' : 'Expired';
    if (isExpiringSoon) return isAr ? 'ينتهي قريباً' : 'Ending soon';
    return isAr ? 'نشط' : 'Active';
  };

  const ctaLabel = () => {
    if (isTrialEnded) return isAr ? 'اشترك الآن' : 'Subscribe';
    if (isTrialPlan || isDemoPending) return isAr ? 'اشترك' : 'Subscribe';
    return isAr ? 'تجديد الباقة' : 'Renew Plan';
  };

  const formatDate = (dateString) => formatSubscriptionDate(dateString, language);

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`
          group flex items-center gap-2.5 rounded-full border bg-white/90 px-3 py-1.5
          backdrop-blur-sm transition-colors duration-200
          dark:bg-dark-800/90
          focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400/40
          ${isExpired
            ? 'border-rose-300/70 dark:border-rose-800/50'
            : 'border-slate-200/90 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'}
        `}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isExpired ? 'bg-rose-500' : isExpiringSoon ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
        <span className="flex flex-col items-start leading-none text-start">
          <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {isAr ? 'الباقة' : 'Plan'}
          </span>
          <span className="mt-0.5 text-[12px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {shortName}
          </span>
        </span>
        <ChevronDown
          className={`ms-0.5 h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-full z-50 mt-2.5 end-0 w-[320px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.35)]                           dark:border-white/[0.08] dark:bg-[#0c111a] dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.65)]">
              <div className="px-5 pt-5 pb-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {isAr ? 'اشتراكك' : 'Your subscription'}
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
                    {planName}
                  </h3>
                  <span
                    className={`shrink-0 text-[11px] font-medium tracking-wide ${
                      isExpired
                        ? 'text-rose-600 dark:text-rose-400'
                        : isExpiringSoon
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {statusLabel()}
                  </span>
                </div>

                {isExpired && (
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {isTrialEnded
                      ? (isAr
                        ? 'انتهت التجربة. النظام مفتوح — اختر باقة للمتابعة.'
                        : 'Trial ended. Workspace stays open — choose a plan to continue.')
                        : (isAr
                        ? 'انتهى الاشتراك. جدّد عبر واتساب للمتابعة.'
                        : 'Subscription ended. Renew via WhatsApp to continue.')}
                  </p>
                )}
              </div>

              <div className="mx-5 border-t border-slate-100 dark:border-white/[0.08]" />

              <div className="space-y-3 px-5 py-4">
                <div className="flex items-center justify-between gap-4 text-[12px]">
                  <span className="text-slate-400 dark:text-slate-500">
                    {isAr ? 'تاريخ البدء' : 'Start date'}
                  </span>
                  <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                    {formatDate(startDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-[12px]">
                  <span className="text-slate-400 dark:text-slate-500">
                    {isAr ? 'تاريخ الانتهاء' : 'End date'}
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      isExpired
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {formatDate(endDate)}
                  </span>
                </div>

                {!isExpired && daysLeft !== null && (
                  <div className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="text-slate-400 dark:text-slate-500">
                      {isAr ? 'المتبقي' : 'Remaining'}
                    </span>
                    <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                      {isAr ? `${daysLeft} يوم` : `${daysLeft} days`}
                    </span>
                  </div>
                )}
              </div>

              <div className="mx-5 border-t border-slate-100 dark:border-white/[0.08]" />

              <div className="space-y-3 px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {isAr ? 'حدود الباقة' : 'Plan limits'}
                </p>
                {[
                  { label: isAr ? 'حد الفواتير' : 'Invoice limit', value: formatPlanLimit(limits.invoices, language) },
                  { label: isAr ? 'حد المستخدمين' : 'User limit', value: formatPlanLimit(limits.users, language) },
                  { label: isAr ? 'حد عروض الأسعار' : 'Quotation limit', value: formatPlanLimit(limits.quotations, language) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 text-[12px]">
                    <span className="text-slate-400 dark:text-slate-500">{row.label}</span>
                    <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="px-5 pb-5 pt-1">
                <button
                  type="button"
                  onClick={goToCheckout}
                  className={`
                    group/cta flex w-full items-center justify-between rounded-xl px-4 py-2.5
                    text-[13px] font-medium tracking-tight transition-colors
                    ${isExpired
                      ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                      : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'}
                  `}
                >
                  <span>{ctaLabel()}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                </button>
                <p className="mt-2.5 text-center text-[10px] tracking-wide text-slate-400 dark:text-slate-500">
                  {isTrialPlan || isDemoPending
                    ? (isAr ? 'اشترك لتفعيل النسخة الكاملة' : 'Subscribe to unlock the full version')
                    : (isAr ? 'التجديد يمدد مدة اشتراكك الحالي' : 'Renewal extends your current subscription')}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
