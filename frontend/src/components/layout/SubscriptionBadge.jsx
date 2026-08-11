import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, CalendarDays, Zap, TrendingUp, Clock, ChevronDown, AlertTriangle, XCircle, Sparkles, CreditCard, ArrowRight } from 'lucide-react';

export default function SubscriptionBadge({ tenant, language }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!tenant || !tenant.subscription) return null;

  const { plan, startDate, endDate, status } = tenant.subscription;
  // If trial is inactive and expired, we still show the badge so user can see expired status and renew
  if (plan === 'trial' && status !== 'active' && !endDate) return null;

  const isAr = language === 'ar';
  const isDemoPending = tenant?.isDemo === true && tenant?.demoUpgraded !== true;
  const isTrialPlan = plan === 'trial' || isDemoPending;

  const getPlanConfig = () => {
    switch (plan) {
      case 'starter':
        return {
          name: isAr ? 'الباقة الأساسية' : 'Starter Plan',
          shortName: isAr ? 'الأساسية' : 'Starter',
          gradient: 'from-blue-600 via-indigo-600 to-blue-700',
          badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
          border: 'border-blue-200/80 dark:border-blue-800/50',
          textColor: 'text-blue-700 dark:text-blue-300',
          tagColor: 'text-blue-600 dark:text-blue-400',
          icon: Zap,
        };
      case 'professional':
        return {
          name: isAr ? 'الباقة الاحترافية' : 'Professional Plan',
          shortName: isAr ? 'الاحترافية' : 'Professional',
          gradient: 'from-violet-600 via-purple-600 to-fuchsia-700',
          badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
          border: 'border-purple-200/80 dark:border-purple-800/50',
          textColor: 'text-purple-700 dark:text-purple-300',
          tagColor: 'text-purple-600 dark:text-purple-400',
          icon: TrendingUp,
        };
      case 'enterprise':
        return {
          name: isAr ? 'باقة الشركات' : 'Enterprise Plan',
          shortName: isAr ? 'الشركات' : 'Enterprise',
          gradient: 'from-amber-500 via-orange-600 to-rose-600',
          badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
          border: 'border-amber-200/80 dark:border-amber-700/50',
          textColor: 'text-amber-700 dark:text-amber-300',
          tagColor: 'text-amber-600 dark:text-amber-400',
          icon: Crown,
        };
      case 'trial':
      default:
        return {
          name: isAr ? 'الباقة التجريبية' : 'Trial Plan',
          shortName: isAr ? 'تجريبية' : 'Trial',
          gradient: 'from-amber-500 via-amber-600 to-orange-600',
          badgeBg: 'bg-amber-50/80 dark:bg-amber-950/30',
          border: 'border-amber-300/70 dark:border-amber-700/40',
          textColor: 'text-amber-800 dark:text-amber-200',
          tagColor: 'text-amber-600 dark:text-amber-400',
          icon: Crown,
        };
    }
  };

  const cfg = getPlanConfig();
  const PlanIcon = cfg.icon;

  const calculateDaysLeft = () => {
    if (!endDate) return null;
    const diffTime = new Date(endDate) - new Date();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysLeft();
  const isExpired = daysLeft === 0 || status === 'expired';
  const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 7;
  const canPayOrSubscribe = isTrialPlan || isExpired || isExpiringSoon || isDemoPending;

  const goToCheckout = () => {
    setOpen(false);
    navigate('/demo-checkout');
  };

  const ctaLabel = () => {
    if (isExpired) return isAr ? 'تجديد الاشتراك' : 'Renew & Pay';
    if (isTrialPlan || isDemoPending) return isAr ? 'اشترك وادفع' : 'Subscribe & Pay';
    if (isExpiringSoon) return isAr ? 'ترقية / تجديد' : 'Upgrade / Renew';
    return isAr ? 'تغيير الباقة' : 'Change Plan';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const totalDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)))
    : 30;

  const progressPct = daysLeft !== null
    ? Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)))
    : 100;

  return (
    <div className="relative hidden md:block">
      {/* Trigger Button - Ultra Professional & Compact */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          relative flex items-center gap-2.5 rounded-2xl px-3 py-1.5
          bg-white dark:bg-dark-800
          border ${isExpired ? 'border-red-300 dark:border-red-800/60 shadow-red-500/5' : cfg.border}
          shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500
          transition-all duration-200 ease-out focus:outline-none ring-0 group
        `}
      >
        {/* Crown / Icon Disc */}
        <span className={`
          flex items-center justify-center w-7 h-7 rounded-xl
          bg-gradient-to-br ${isExpired ? 'from-red-500 to-rose-600' : cfg.gradient}
          text-white shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform
        `}>
          <PlanIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>

        {/* Info Text */}
        <div className="flex flex-col items-start leading-tight text-start min-w-[70px]">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {isAr ? 'الباقة الحالية' : 'CURRENT PLAN'}
          </span>
          <span className="text-xs font-black text-gray-900 dark:text-white">
            {cfg.shortName}
          </span>
          {isExpired ? (
            <span className="text-[9px] font-bold text-red-500 flex items-center gap-0.5 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {isAr ? 'منتهي' : 'Expired'}
            </span>
          ) : isExpiringSoon ? (
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {daysLeft}d left
            </span>
          ) : endDate ? (
            <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-0.5 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDate(endDate)}
            </span>
          ) : null}
        </div>

        {/* Arrow */}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180 text-amber-500' : 'group-hover:text-gray-600'}`} />
      </button>

      {/* Popover Dropdown Card - 100% Solid Opacity to Prevent Overlap Bleed */}
      {open && (
        <>
          {/* Transparent Overlay backdrop to dismiss */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-full mt-2 end-0 z-50 w-80">
            {/* SOLID BACKGROUND CONTAINER */}
            <div className="rounded-3xl shadow-2xl bg-white dark:bg-dark-800 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden border border-gray-100 dark:border-dark-700">

              {/* Premium Gradient Header Header Banner */}
              <div className={`p-5 text-white bg-gradient-to-br ${isExpired ? 'from-gray-900 via-slate-900 to-rose-950' : 'from-slate-900 via-gray-900 to-slate-900'} relative overflow-hidden`}>
                {/* Background Ambient Glows */}
                <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-40 ${isExpired ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full blur-2xl opacity-20 bg-indigo-500" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${isExpired ? 'from-red-500 to-rose-600' : cfg.gradient} flex items-center justify-center shadow-lg shadow-black/20 ring-2 ring-white/20`}>
                      <PlanIcon className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-400/90 uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {isAr ? 'تفاصيل الاشتراك' : 'YOUR SUBSCRIPTION'}
                      </p>
                      <h3 className="text-lg font-black text-white leading-tight mt-0.5">{cfg.name}</h3>
                    </div>
                  </div>
                </div>

                {/* Status Indicator Bar */}
                <div className="relative mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`
                      inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold
                      ${isExpired ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
                      {isExpired ? (isAr ? 'منتهي' : 'Expired') : (isAr ? 'نشط' : 'Active')}
                    </span>
                  </div>

                  {daysLeft !== null && !isExpired && (
                    <span className="text-xs font-bold text-amber-300">
                      {isAr ? `${daysLeft} يوم متبقي` : `${daysLeft} days left`}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body - 100% Solid BG */}
              <div className="p-5 space-y-4 bg-white dark:bg-dark-800">

                {/* Subscription Life Bar */}
                {daysLeft !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-500 dark:text-gray-400">
                        {isAr ? 'صلاحية الباقة' : 'Subscription Life'}
                      </span>
                      <span className={`font-black ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {progressPct}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden p-0.5 border border-gray-100 dark:border-dark-600">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isExpired ? 'bg-gradient-to-r from-red-500 to-rose-600' : isExpiringSoon ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Start / End Dates */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-dark-700/60 border border-gray-100 dark:border-dark-700">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-dark-600 flex items-center justify-center text-gray-400 dark:text-gray-300 shadow-sm">
                        <CalendarDays className="w-4 h-4 text-indigo-500" />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {isAr ? 'تاريخ البدء' : 'Start Date'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {formatDate(startDate)}
                    </span>
                  </div>

                  {endDate && (
                    <div className={`flex items-center justify-between p-3 rounded-2xl border ${
                      isExpired
                        ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/30'
                        : isExpiringSoon
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/30'
                        : 'bg-gray-50 dark:bg-dark-700/60 border-gray-100 dark:border-dark-700'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                          isExpired
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-500'
                            : isExpiringSoon
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
                            : 'bg-white dark:bg-dark-600 text-gray-400'
                        }`}>
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className={`text-xs font-semibold ${
                          isExpired ? 'text-red-700 dark:text-red-300' : isExpiringSoon ? 'text-amber-800 dark:text-amber-300' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {isAr ? 'تاريخ الانتهاء' : 'Ends on'}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${
                        isExpired ? 'text-red-600 dark:text-red-400' : isExpiringSoon ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {formatDate(endDate)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expiry Message */}
                {isExpired && (
                  <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 flex items-start gap-2.5">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-red-700 dark:text-red-300 leading-tight">
                        {isAr ? 'انتهت فترة الاشتراك الخاصة بك' : 'Your subscription has expired'}
                      </p>
                      <p className="text-[11px] text-red-600/90 dark:text-red-400 leading-relaxed">
                        {isAr ? 'اشترك الآن لاستعادة الوصول الكامل لجميع الميزات.' : 'Subscribe now to restore full access to all features.'}
                      </p>
                    </div>
                  </div>
                )}

                {isExpiringSoon && !isExpired && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-tight">
                        {isAr ? 'يقترب انتهاء الاشتراك' : 'Subscription expiring soon'}
                      </p>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400 leading-relaxed">
                        {isAr ? `متبقي ${daysLeft} أيام على الانتهاء.` : `Only ${daysLeft} days remaining on your plan.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Pay / Subscribe CTA */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={goToCheckout}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 ${
                      isExpired
                        ? 'bg-gradient-to-r from-red-600 to-rose-600'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    {ctaLabel()}
                    <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                  </button>
                  {!canPayOrSubscribe && (
                    <p className="text-[10px] text-center text-gray-400">
                      {isAr ? 'يمكنك ترقية أو تغيير باقتك في أي وقت' : 'You can upgrade or change your plan anytime'}
                    </p>
                  )}
                  {(isTrialPlan || isDemoPending) && (
                    <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">
                      {isAr ? 'اختر الباقة وادفع بأمان عبر بوابة الدفع' : 'Pick a plan and pay securely via checkout'}
                    </p>
                  )}
                </div>

              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
