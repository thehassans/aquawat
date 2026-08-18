import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Users, CalendarDays, Dumbbell, Award, CreditCard, Activity } from 'lucide-react';
import api from '../../lib/api';

export default function GymAnalytics() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar';
  const currency = tenant?.settings?.currency || 'SAR';

  const [dateRange, setDateRange] = useState('month');

  // Mock Queries
  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ['gym', 'analytics', dateRange],
    queryFn: async () => {
      // Mock data
      return {
        revenue: 45200,
        revenueGrowth: 12.5,
        newMembers: 142,
        newMembersGrowth: 8.2,
        totalCheckins: 3850,
        retentionRate: 85,
        planBreakdown: [
          { name: '1 Month', value: 15000, color: '#3b82f6' },
          { name: '3 Months', value: 20000, color: '#8b5cf6' },
          { name: '6 Months', value: 6000, color: '#10b981' },
          { name: '1 Year', value: 4200, color: '#f59e0b' }
        ],
        popularClasses: [
          { name: 'HIIT Extreme', bookings: 245, fillRate: 92 },
          { name: 'Yoga Flow', bookings: 198, fillRate: 85 },
          { name: 'Spinning', bookings: 164, fillRate: 78 }
        ],
        topTrainers: [
          { name: 'Mike Johnson', sessions: 85, revenue: 8500 },
          { name: 'Sarah Smith', sessions: 64, revenue: 6400 },
          { name: 'Alex Rodriguez', sessions: 42, revenue: 4200 }
        ]
      };
    }
  });

  const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM
  const DAYS = isAr ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Generate random heatmap data for demonstration
  const heatmapData = useMemo(() => {
    const data = {};
    DAYS.forEach(day => {
      data[day] = {};
      HOURS.forEach(hour => {
        // Higher probability of high values in evenings (17-20)
        let base = (hour >= 17 && hour <= 20) ? 60 : 10;
        data[day][hour] = Math.floor(Math.random() * 40) + base;
      });
    });
    return data;
  }, [DAYS, HOURS]);

  const getHeatmapColor = (value) => {
    if (value < 20) return 'bg-emerald-50';
    if (value < 40) return 'bg-emerald-200';
    if (value < 60) return 'bg-emerald-400';
    if (value < 80) return 'bg-emerald-600';
    return 'bg-emerald-800';
  };

  const formatCurrency = (val) => new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', { style: 'currency', currency }).format(val || 0);

  const StatCard = ({ title, value, icon, trend, prefix = '' }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600">{icon}</div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-md ${trend >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <h3 className="text-3xl font-bold text-slate-800 mb-1">{prefix}{value}</h3>
        <p className="text-sm font-medium text-slate-500">{title}</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isAr ? 'rtl' : 'ltr'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
            {isAr ? 'التحليلات والتقارير' : 'Analytics & Reports'}
          </h1>
          <p className="text-slate-500 mt-1">{isAr ? 'نظرة عامة على أداء النادي' : 'Overview of club performance'}</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 bg-white shadow-sm font-medium"
        >
          <option value="week">{isAr ? 'هذا الأسبوع' : 'This Week'}</option>
          <option value="month">{isAr ? 'هذا الشهر' : 'This Month'}</option>
          <option value="year">{isAr ? 'هذا العام' : 'This Year'}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className="h-32 bg-slate-200 rounded-2xl"></div><div className="h-32 bg-slate-200 rounded-2xl"></div><div className="h-32 bg-slate-200 rounded-2xl"></div><div className="h-32 bg-slate-200 rounded-2xl"></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="h-80 bg-slate-200 rounded-2xl"></div><div className="h-80 bg-slate-200 rounded-2xl"></div></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={isAr ? 'إجمالي الإيرادات' : 'Total Revenue'} value={stats.revenue?.toLocaleString()} prefix={currency + ' '} icon={<CreditCard className="w-5 h-5" />} trend={stats.revenueGrowth} />
            <StatCard title={isAr ? 'أعضاء جدد' : 'New Members'} value={stats.newMembers} icon={<Users className="w-5 h-5" />} trend={stats.newMembersGrowth} />
            <StatCard title={isAr ? 'تسجيلات الدخول' : 'Total Check-ins'} value={stats.totalCheckins?.toLocaleString()} icon={<Activity className="w-5 h-5" />} />
            <StatCard title={isAr ? 'معدل الاحتفاظ' : 'Retention Rate'} value={`${stats.retentionRate}%`} icon={<TrendingUp className="w-5 h-5" />} trend={2.1} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg text-slate-800 mb-6">{isAr ? 'توزيع الإيرادات حسب الباقة' : 'Revenue by Plan Type'}</h3>
              <div className="space-y-4">
                {stats.planBreakdown?.map((plan, i) => {
                  const pct = (plan.value / stats.revenue) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-medium text-slate-700">{plan.name}</span>
                        <span className="font-bold text-slate-800">{formatCurrency(plan.value)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} className="h-2 rounded-full" style={{ backgroundColor: plan.color }}></motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Classes */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg text-slate-800 mb-6">{isAr ? 'الكلاسات الأكثر شعبية' : 'Most Popular Classes'}</h3>
              <div className="space-y-4">
                {stats.popularClasses?.map((cls, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">{i+1}</div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{cls.name}</p>
                        <p className="text-xs text-slate-500">{cls.bookings} {isAr ? 'حجز' : 'bookings'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg">{cls.fillRate}% {isAr ? 'إشغال' : 'Fill Rate'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Heatmap */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 overflow-x-auto">
              <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-slate-400" />
                {isAr ? 'أوقات الذروة للحضور' : 'Attendance Peak Hours'}
              </h3>
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[auto_repeat(16,1fr)] gap-1 mb-2">
                  <div className="w-12"></div>
                  {HOURS.map(h => <div key={h} className="text-center text-[10px] text-slate-400 font-medium">{h}:00</div>)}
                </div>
                {DAYS.map(day => (
                  <div key={day} className="grid grid-cols-[auto_repeat(16,1fr)] gap-1 mb-1 items-center">
                    <div className="w-12 text-xs font-medium text-slate-600">{day}</div>
                    {HOURS.map(hour => {
                      const val = heatmapData[day][hour];
                      return (
                        <div key={`${day}-${hour}`} title={`${val} check-ins`} className={`aspect-square rounded ${getLockerStyleForHeatmap(val)} hover:opacity-80 transition-opacity cursor-pointer`} />
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500">
                  <span>{isAr ? 'أقل' : 'Less'}</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-50"></div>
                    <div className="w-3 h-3 rounded bg-emerald-200"></div>
                    <div className="w-3 h-3 rounded bg-emerald-400"></div>
                    <div className="w-3 h-3 rounded bg-emerald-600"></div>
                    <div className="w-3 h-3 rounded bg-emerald-800"></div>
                  </div>
                  <span>{isAr ? 'أكثر' : 'More'}</span>
                </div>
              </div>
            </div>

            {/* Top Trainers */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                {isAr ? 'أفضل المدربين' : 'Top Trainers'}
              </h3>
              <div className="space-y-4">
                {stats.topTrainers?.map((trainer, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">
                      #{i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{trainer.name}</p>
                      <p className="text-xs text-slate-500">{trainer.sessions} {isAr ? 'جلسة مكتملة' : 'sessions'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(trainer.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getLockerStyleForHeatmap(val) {
  if (val < 20) return 'bg-emerald-50';
  if (val < 40) return 'bg-emerald-200';
  if (val < 60) return 'bg-emerald-400';
  if (val < 80) return 'bg-emerald-600';
  return 'bg-emerald-800';
}
