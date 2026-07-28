import React from 'react';
import { Crown, CalendarDays } from 'lucide-react';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export default function SubscriptionBadge({ tenant, language }) {
  if (!tenant || !tenant.subscription) return null;

  const { plan, startDate, endDate, status } = tenant.subscription;
  
  // Only show badge if they are on a paid plan or trial
  if (plan === 'trial' && status !== 'active') return null;

  const getPlanName = () => {
    switch (plan) {
      case 'starter': return language === 'ar' ? 'الأساسية' : 'Starter';
      case 'professional': return language === 'ar' ? 'الاحترافية' : 'Professional';
      case 'enterprise': return language === 'ar' ? 'الشركات' : 'Enterprise';
      case 'trial': return language === 'ar' ? 'تجريبية' : 'Trial';
      default: return plan;
    }
  };

  const calculateDaysLeft = () => {
    if (!endDate) return null;
    const diffTime = new Date(endDate) - new Date();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysLeft();
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

  return (
    <Popover className="relative hidden md:block">
      <Popover.Button className="relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 px-3 py-1.5 border border-amber-200/50 dark:border-amber-700/30 shadow-sm transition hover:shadow focus:outline-none ring-0">
        <Crown className="w-4 h-4 text-amber-500" />
        <div className="flex flex-col items-start leading-none">
          <span className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider">
            {language === 'ar' ? 'الباقة الحالية' : 'Current Plan'}
          </span>
          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
            {getPlanName()}
          </span>
        </div>
      </Popover.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel className="absolute top-full mt-2 w-64 end-0 z-50">
          <div className="rounded-2xl shadow-xl bg-white dark:bg-dark-800 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-amber-100" />
                <h3 className="font-bold text-lg">{getPlanName()}</h3>
              </div>
              <p className="text-amber-100 text-xs">
                {language === 'ar' ? 'تفاصيل الاشتراك' : 'Subscription Details'}
              </p>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-dark-700 flex items-center justify-center text-gray-500">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(startDate)}</p>
                </div>
              </div>

              {endDate && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-dark-700 flex items-center justify-center text-gray-500">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</p>
                    <p className={`text-sm font-medium ${isExpiringSoon ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                      {formatDate(endDate)}
                    </p>
                  </div>
                </div>
              )}

              {daysLeft !== null && (
                <div className="pt-3 border-t border-gray-100 dark:border-dark-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {language === 'ar' ? 'الأيام المتبقية' : 'Days Remaining'}
                    </span>
                    <span className={`text-xs font-bold ${isExpiringSoon ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {daysLeft}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isExpiringSoon ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.max(5, Math.min(100, (daysLeft / 365) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
