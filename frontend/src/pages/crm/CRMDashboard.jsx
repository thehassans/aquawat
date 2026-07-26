import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, BarChart3, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import CRMDealsTab from './CRMDealsTab'
import CRMActivitiesTab from './CRMActivitiesTab'

export default function CRMDashboard() {
  const { language } = useSelector((state) => state.ui)
  const t = (en, ar) => language === 'ar' ? ar : en

  const { data: stats } = useQuery({ queryKey: ['crm-stats'], queryFn: async () => (await api.get('/crm/stats')).data })

  const kpis = [
    { label: t('Total Leads', 'إجمالي العملاء'), value: stats?.leadTotal ?? 0, icon: Users, color: 'bg-blue-500' },
    { label: t('Total Deals', 'إجمالي الصفقات'), value: stats?.dealTotal ?? 0, icon: BarChart3, color: 'bg-indigo-500' },
    { label: t('Pipeline', 'القيمة'), value: `${(stats?.dealValue ?? 0).toLocaleString()} SAR`, icon: DollarSign, color: 'bg-emerald-500' },
    { label: t('Won', 'الفوز'), value: `${(stats?.wonValue ?? 0).toLocaleString()} SAR`, icon: TrendingUp, color: 'bg-teal-500' },
    { label: t('Follow-ups', 'متابعات'), value: stats?.followUpCount ?? 0, icon: AlertCircle, color: 'bg-amber-500' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">{t('CRM', 'إدارة العملاء')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('Manage leads, deals, and customer relationships', 'إدارة العملاء المحتملين والصفقات وعلاقات العملاء')}</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map((k, i) => { const Icon = k.icon; return (
            <motion.div key={k.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 100 }} className="relative overflow-hidden bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-white/40 dark:border-dark-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className={`w-10 h-10 rounded-xl ${k.color} flex items-center justify-center mb-3 shadow-inner`}>
                <Icon className="w-5 h-5 text-white drop-shadow-md" />
              </div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{k.label}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">{k.value}</p>
            </motion.div>
          )})}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <CRMDealsTab preview />
            <CRMActivitiesTab preview />
          </div>
          
          <div className="space-y-4 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 rounded-3xl blur-3xl -z-10" />
            <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/40 dark:border-dark-700/50">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                {t('Sales Funnel', 'قمع المبيعات')}
              </h3>
              <div className="h-72 w-full text-sm font-medium">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Funnel
                      dataKey="value"
                      data={[
                        { name: t('Leads', 'عملاء محتملون'), value: stats?.leadTotal || 1, fill: '#3b82f6' },
                        { name: t('Prospecting', 'استكشاف'), value: Math.round((stats?.dealTotal || 0) * 0.8) || 1, fill: '#6366f1' },
                        { name: t('Proposal', 'عروض'), value: Math.round((stats?.dealTotal || 0) * 0.5) || 1, fill: '#0ea5e9' },
                        { name: t('Won', 'تم الفوز'), value: stats?.wonCount || 0, fill: '#10b981' }
                      ]}
                      isAnimationActive={true}
                    >
                      <LabelList position="right" fill="#6b7280" stroke="none" dataKey="name" className="font-semibold" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
