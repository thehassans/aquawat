import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Users, CreditCard, ScanLine, Activity, Banknote, AlertTriangle, Plus, QrCode, ShoppingBag, CheckCircle, XCircle, Clock, User } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { enUS, ar } from 'date-fns/locale'

export default function GymDashboard() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar'
  const currency = tenant?.settings?.currency || 'SAR'
  const navigate = useNavigate()
  
  const today = format(new Date(), 'EEEE').toLowerCase()

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['gym-dashboard-stats'],
    queryFn: () => api.get('/api/gym/dashboard/stats').then(res => res.data.data)
  })

  const { data: recentCheckIns, isLoading: isLoadingCheckIns } = useQuery({
    queryKey: ['gym-recent-checkins'],
    queryFn: () => api.get('/api/gym/attendance?limit=10&sort=-checkInTime').then(res => res.data.data)
  })

  const { data: todayClasses, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['gym-today-classes', today],
    queryFn: () => api.get(`/api/gym/classes?dayOfWeek=${today}`).then(res => res.data.data)
  })

  const stats = statsData || { totalMembers: 0, activeSubscriptions: 0, todayCheckins: 0, liveOccupancy: 0, monthlyRevenue: 0, expiringThisWeek: 0 }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: currency
    }).format(amount || 0)
  }

  const kpis = [
    { titleEn: 'Total Members', titleAr: 'إجمالي الأعضاء', value: stats.totalMembers, icon: Users, color: 'from-slate-500 to-slate-700' },
    { titleEn: 'Active Subs', titleAr: 'الاشتراكات النشطة', value: stats.activeSubscriptions, icon: CreditCard, color: 'from-blue-500 to-blue-700' },
    { titleEn: "Today's Check-ins", titleAr: 'تسجيلات اليوم', value: stats.todayCheckins, icon: ScanLine, color: 'from-emerald-500 to-emerald-700' },
    { titleEn: 'Live Occupancy', titleAr: 'الإشغال الحالي', value: stats.liveOccupancy, icon: Activity, color: 'from-amber-500 to-amber-700', pulse: true },
    { titleEn: 'Monthly Revenue', titleAr: 'الإيرادات الشهرية', value: formatMoney(stats.monthlyRevenue), icon: Banknote, color: 'from-violet-500 to-violet-700' },
    { titleEn: 'Expiring This Week', titleAr: 'تنتهي هذا الأسبوع', value: stats.expiringThisWeek, icon: AlertTriangle, color: 'from-rose-500 to-rose-700' },
  ]

  return (
    <div className={`min-h-screen bg-slate-50/50 p-4 md:p-8 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-white to-slate-50 rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            {isAr ? 'لوحة تحكم النادي' : 'Gym Dashboard'}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </h1>
          <p className="text-slate-500 mt-2">
            {isAr ? 'مرحباً بعودتك! إليك نظرة عامة على نشاط النادي اليوم.' : 'Welcome back! Here is your gym overview for today.'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 text-right bg-white p-3 rounded-xl shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">{isAr ? 'تاريخ اليوم' : 'Current Date'}</p>
          <p className="font-semibold text-slate-800">{format(new Date(), 'EEEE, MMM d, yyyy', { locale: isAr ? ar : enUS })}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-8">
        <Link to="/app/dashboard/gym/members/new" className="flex-1 min-w-[200px] bg-white hover:bg-slate-50 text-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-3 justify-center group">
          <div className="bg-blue-100 text-blue-600 p-2 rounded-lg group-hover:scale-110 transition-transform"><Plus size={20} /></div>
          <span className="font-medium">{isAr ? 'عضو جديد' : 'New Member'}</span>
        </Link>
        <Link to="/app/dashboard/gym/checkin" className="flex-1 min-w-[200px] bg-white hover:bg-slate-50 text-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-3 justify-center group">
          <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg group-hover:scale-110 transition-transform"><QrCode size={20} /></div>
          <span className="font-medium">{isAr ? 'كشك تسجيل الدخول' : 'Check-In Kiosk'}</span>
        </Link>
        <Link to="/app/dashboard/gym/subscriptions" className="flex-1 min-w-[200px] bg-white hover:bg-slate-50 text-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-3 justify-center group">
          <div className="bg-violet-100 text-violet-600 p-2 rounded-lg group-hover:scale-110 transition-transform"><ShoppingBag size={20} /></div>
          <span className="font-medium">{isAr ? 'الاشتراكات والباقات' : 'Subscriptions & Plans'}</span>
        </Link>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {kpis.map((kpi, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={idx} 
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${kpi.color} opacity-5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110`}></div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">{isAr ? kpi.titleAr : kpi.titleEn}</p>
                <h3 className="text-3xl font-bold text-slate-800">
                  {isLoadingStats ? <div className="h-8 w-16 bg-slate-200 rounded animate-pulse"></div> : kpi.value}
                </h3>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${kpi.color} text-white shadow-lg`}>
                <kpi.icon size={24} className={kpi.pulse ? 'animate-pulse' : ''} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Check-ins */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ScanLine className="text-emerald-500" size={20} />
              {isAr ? 'أحدث التسجيلات' : 'Recent Check-ins'}
            </h3>
            <Link to="/app/dashboard/gym/checkin" className="text-blue-600 text-sm font-medium hover:underline">
              {isAr ? 'فتح الكشك' : 'Open Kiosk'}
            </Link>
          </div>
          <div className="p-0">
            {isLoadingCheckIns ? (
              <div className="p-6 flex justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : recentCheckIns?.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentCheckIns.map(checkin => (
                  <div key={checkin._id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
                        {checkin.member?.photoUrl ? <img src={checkin.member.photoUrl} alt="member" className="w-full h-full object-cover" /> : <User size={20} />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{isAr ? checkin.member?.nameAr || checkin.member?.nameEn : checkin.member?.nameEn || checkin.member?.nameAr}</p>
                        <p className="text-xs text-slate-500">{checkin.member?.memberNumber}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {checkin.accessGranted ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                          <CheckCircle size={14} /> {isAr ? 'تم الدخول' : 'Granted'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                          <XCircle size={14} /> {isAr ? 'مرفوض' : 'Denied'}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={12} /> {formatDistanceToNow(new Date(checkin.checkInTime), { addSuffix: true, locale: isAr ? ar : enUS })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                {isAr ? 'لا توجد تسجيلات حديثة' : 'No recent check-ins found'}
              </div>
            )}
          </div>
        </div>

        {/* Today's Classes */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-amber-500" size={20} />
              {isAr ? 'حصص اليوم' : "Today's Classes"}
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {isLoadingClasses ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : todayClasses?.length > 0 ? (
              todayClasses.map(cls => {
                const fillPercent = (cls.enrolledCount / cls.capacity) * 100
                return (
                  <div key={cls._id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-slate-800">{isAr ? cls.nameAr || cls.nameEn : cls.nameEn || cls.nameAr}</h4>
                        <p className="text-xs text-slate-500">{cls.startTime} - {cls.endTime} • {cls.trainer?.name}</p>
                      </div>
                      <span className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm text-slate-700 border border-slate-200">
                        {cls.enrolledCount}/{cls.capacity}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                      <div className={`h-1.5 rounded-full ${fillPercent >= 100 ? 'bg-rose-500' : fillPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(fillPercent, 100)}%` }}></div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <Clock size={32} className="text-slate-300" />
                <p>{isAr ? 'لا توجد حصص متبقية اليوم' : 'No classes scheduled for today'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
