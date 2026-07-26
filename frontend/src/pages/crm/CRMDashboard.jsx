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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('CRM', 'إدارة العملاء')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('Manage leads, deals, and customer relationships', 'إدارة العملاء المحتملين والصفقات وعلاقات العملاء')}</p>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map((k, i) => { const Icon = k.icon; return (
            <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-dark-700">
              <div className={`w-8 h-8 rounded-lg ${k.color} flex items-center justify-center mb-2`}><Icon className="w-4 h-4 text-white" /></div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{k.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{k.value}</p>
            </motion.div>
          )})}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <CRMDealsTab preview />
            <CRMActivitiesTab preview />
          </div>
          
          <div className="space-y-4">
            <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-dark-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('Sales Funnel', 'قمع المبيعات')}</h3>
              <div className="h-64 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
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
                      <LabelList position="right" fill="#6b7280" stroke="none" dataKey="name" />
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
