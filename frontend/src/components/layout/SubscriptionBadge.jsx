import React, { useState } from 'react';
import { Crown, CalendarDays, Zap, TrendingUp, Clock, ChevronDown } from 'lucide-react';

export default function SubscriptionBadge({ tenant, language }) {
  const [open, setOpen] = useState(false);
  if (!tenant || !tenant.subscription) return null;

  const { plan, startDate, endDate, status } = tenant.subscription;
  if (plan === 'trial' && status !== 'active') return null;

  const isAr = language === 'ar';

  const getPlanConfig = () => {
    switch (plan) {
      case 'starter':
        return {
          name: isAr ? 'الأساسية' : 'Starter',
          gradient: 'from-blue-500 via-blue-600 to-indigo-600',
          glow: 'shadow-blue-500/30',
          badgeGrad: 'from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/20 dark:via-indigo-900/15 dark:to-blue-900/20',
          border: 'border-blue-200/60 dark:border-blue-700/40',
          textColor: 'text-blue-700 dark:text-blue-300',
          subColor: 'text-blue-500/70 dark:text-blue-400/60',
          icon: Zap,
          shimmer: 'from-blue-400/0 via-blue-200/30 to-blue-400/0',
        };
      case 'professional':
        return {
          name: isAr ? 'الاحترافية' : 'Professional',
          gradient: 'from-violet-500 via-purple-500 to-fuchsia-600',
          glow: 'shadow-purple-500/30',
          badgeGrad: 'from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-900/20 dark:via-purple-900/15 dark:to-fuchsia-900/20',
          border: 'border-violet-200/60 dark:border-violet-700/40',
          textColor: 'text-violet-700 dark:text-violet-300',
          subColor: 'text-violet-500/70 dark:text-violet-400/60',
          icon: TrendingUp,
          shimmer: 'from-violet-400/0 via-violet-200/30 to-violet-400/0',
        };
      case 'enterprise':
        return {
          name: isAr ? 'الشركات' : 'Enterprise',
          gradient: 'from-amber-400 via-orange-500 to-rose-500',
          glow: 'shadow-amber-500/30',
          badgeGrad: 'from-amber-50 via-orange-50 to-rose-50 dark:from-amber-900/20 dark:via-orange-900/15 dark:to-rose-900/20',
          border: 'border-amber-200/60 dark:border-amber-700/40',
          textColor: 'text-amber-700 dark:text-amber-300',
          subColor: 'text-amber-500/70 dark:text-amber-400/60',
          icon: Crown,
          shimmer: 'from-amber-400/0 via-amber-200/30 to-amber-400/0',
        };
      case 'trial':
      default:
        return {
          name: isAr ? 'تجريبية' : 'Trial',
          gradient: 'from-slate-400 via-gray-500 to-slate-600',
          glow: 'shadow-slate-400/30',
          badgeGrad: 'from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/20 dark:via-gray-900/15 dark:to-slate-900/20',
          border: 'border-slate-200/60 dark:border-slate-700/40',
          textColor: 'text-slate-700 dark:text-slate-300',
          subColor: 'text-slate-500/70 dark:text-slate-400/60',
          icon: Crown,
          shimmer: 'from-slate-400/0 via-slate-200/30 to-slate-400/0',
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
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;
  const isExpired = daysLeft === 0;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    : 365;

  const progressPct = daysLeft !== null
    ? Math.max(3, Math.min(100, (daysLeft / totalDays) * 100))
    : 50;

  const progressColor = isExpired
    ? 'bg-red-500'
    : isExpiringSoon
    ? 'bg-orange-400'
    : 'bg-emerald-400';

  return (
    <div className="relative hidden md:block">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          relative flex items-center gap-2.5 rounded-2xl px-3.5 py-2
          bg-gradient-to-br ${cfg.badgeGrad}
          border ${cfg.border}
          shadow-lg ${cfg.glow}
          hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]
          transition-all duration-200 ease-out
          focus:outline-none overflow-hidden
          group
        `}
        style={{ minWidth: 148 }}
      >
        {/* Animated shimmer sweep */}
        <span
          className={`
            pointer-events-none absolute inset-0 
            bg-gradient-to-r ${cfg.shimmer}
            translate-x-[-100%] group-hover:translate-x-[100%]
            transition-transform duration-700 ease-in-out
          `}
        />

        {/* Colored icon disc */}
        <span className={`
          relative flex items-center justify-center 
          w-7 h-7 rounded-xl 
          bg-gradient-to-br ${cfg.gradient}
          shadow-md flex-shrink-0
        `}>
          <PlanIcon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </span>

        {/* Text */}
        <div className="flex flex-col items-start leading-none flex-1 min-w-0">
          <span className={`text-[9px] font-semibold uppercase tracking-widest ${cfg.subColor}`}>
            {isAr ? 'الباقة الحالية' : 'Current Plan'}
          </span>
          <span className={`text-sm font-bold mt-0.5 ${cfg.textColor}`}>
            {cfg.name}
          </span>
          {endDate && (
            <span className={`text-[9px] mt-0.5 flex items-center gap-0.5 ${cfg.subColor}`}>
              <Clock className="w-2.5 h-2.5" />
              {isExpiringSoon && !isExpired
                ? (isAr ? `${daysLeft} أيام متبقية` : `${daysLeft}d left`)
                : isExpired
                ? (isAr ? 'منتهي' : 'Expired')
                : formatDate(endDate)}
            </span>
          )}
        </div>

        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.subColor} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-full mt-2.5 end-0 z-50 w-72">
            {/* Glass card */}
            <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/90 dark:bg-dark-800/90 backdrop-blur-xl">

              {/* Header gradient */}
              <div className={`bg-gradient-to-br ${cfg.gradient} p-5 text-white relative overflow-hidden`}>
                {/* decorative blobs */}
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 blur-lg" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-black/10 blur-lg" />

                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-inner">
                    <PlanIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-widest">
                      {isAr ? 'الاشتراك الحالي' : 'Your Subscription'}
                    </p>
                    <h3 className="text-xl font-bold text-white leading-tight">{cfg.name}</h3>
                  </div>
                </div>

                {/* Status pill */}
                <div className="relative mt-4 flex items-center gap-2">
                  <span className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                    ${isExpired ? 'bg-red-500/30 text-red-100' : 'bg-white/20 text-white'}
                  `}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-300' : 'bg-emerald-300 animate-pulse'}`} />
                    {isExpired ? (isAr ? 'منتهي' : 'Expired') : (isAr ? 'نشط' : 'Active')}
                  </span>
                  {daysLeft !== null && !isExpired && (
                    <span className="text-white/70 text-xs">
                      {isAr ? `${daysLeft} يوم متبقي` : `${daysLeft} days remaining`}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">

                {/* Progress bar */}
                {daysLeft !== null && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        {isAr ? 'صلاحية الاشتراك' : 'Subscription Life'}
                      </span>
                      <span className={`text-[11px] font-bold ${isExpiringSoon ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {progressPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Date rows */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-dark-700">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isAr ? 'تاريخ البدء' : 'Start Date'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {formatDate(startDate)}
                    </span>
                  </div>

                  {endDate && (
                    <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-dark-700'}`}>
                      <div className="flex items-center gap-2">
                        <Clock className={`w-3.5 h-3.5 ${isExpiringSoon ? 'text-orange-400' : 'text-gray-400'}`} />
                        <span className={`text-xs ${isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isAr ? 'تاريخ الانتهاء' : 'Ends on'}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'}`}>
                        {formatDate(endDate)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expiry warning */}
                {isExpiringSoon && !isExpired && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200/60 dark:border-orange-700/30">
                    <span className="text-orange-500 text-sm leading-none mt-0.5">⚠</span>
                    <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
                      {isAr
                        ? `ينتهي اشتراكك خلال ${daysLeft} أيام. يرجى التجديد لتجنب انقطاع الخدمة.`
                        : `Your plan expires in ${daysLeft} days. Renew to avoid interruption.`}
                    </p>
                  </div>
                )}

                {isExpired && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/30">
                    <span className="text-red-500 text-sm leading-none mt-0.5">✕</span>
                    <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                      {isAr ? 'انتهى اشتراكك. تواصل مع الدعم لتجديده.' : 'Your plan has expired. Contact support to renew.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
