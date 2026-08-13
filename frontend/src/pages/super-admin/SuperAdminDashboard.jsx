import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Users, FileText, TrendingUp, ArrowUpRight, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

const COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444']

export default function SuperAdminDashboard() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-dashboard'],
    queryFn: () => api.get('/super-admin/dashboard').then(res => res.data)
  })

  const stats = [
    { label: language === 'ar' ? 'إجمالي المستأجرين' : 'Total Tenants', value: data?.totalTenants || 0, icon: Building2, color: 'from-primary-500 to-primary-600' },
    { label: language === 'ar' ? 'الاشتراكات النشطة' : 'Active Subscriptions', value: data?.activeSubscriptions || 0, icon: TrendingUp, color: 'from-emerald-500 to-emerald-600' },
    { label: language === 'ar' ? 'إجمالي المستخدمين' : 'Total Users', value: data?.totalUsers || 0, icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: language === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices', value: data?.invoiceStats?.count || 0, icon: FileText, color: 'from-violet-500 to-violet-600' },
  ]

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'لوحة المشرف العام' : 'Super Admin Dashboard'}</h1>
          <p className="text-gray-500 mt-1">{language === 'ar' ? 'نظرة عامة على النظام' : 'System overview'}</p>
        </div>
        <Link to="/super-admin/tenants/new" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'إضافة مستأجر' : 'Add Tenant'}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value.toLocaleString()}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-6">
          <h3 className="text-lg font-semibold mb-6">{language === 'ar' ? 'توزيع الاشتراكات' : 'Subscription Distribution'}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.subscriptionStats || []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="_id">
                  {(data?.subscriptionStats || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data?.subscriptionStats?.map((item, i) => (
              <div key={item._id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{item._id}: {item.count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Tenants */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-2 card">
          <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'أحدث المستأجرين' : 'Recent Tenants'}</h3>
            <Link to="/super-admin/tenants" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              {language === 'ar' ? 'عرض الكل' : 'View All'} <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {data?.recentTenants?.map((tenant) => (
              <Link key={tenant._id} to={`/super-admin/tenants/${tenant._id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                    {tenant.name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                    <p className="text-sm text-gray-500">{tenant.business?.legalNameEn}</p>
                  </div>
                </div>
                <div className="text-end">
                  <span className={`badge ${tenant.subscription?.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {tenant.subscription?.plan}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{new Date(tenant.createdAt).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Revenue cards — SaaS MRR is subscription.price, not tenant invoice GMV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'إيراد الاشتراكات (MRR)' : 'SaaS subscription MRR'}</h3>
            <span className="text-2xl font-bold text-emerald-600">
              <Money
                value={(data?.monthlyRevenue || []).reduce((sum, row) => sum + Number(row.total || 0), 0)}
                minimumFractionDigits={0}
                maximumFractionDigits={0}
              />
            </span>
          </div>
          <p className="text-sm text-gray-500">{language === 'ar' ? 'من خطط المستأجرين النشطة فقط' : 'From active tenant subscription prices only'}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{language === 'ar' ? 'إجمالي فواتير المستأجرين (GMV)' : 'Tenant invoice GMV'}</h3>
            <span className="text-2xl font-bold text-primary-600"><Money value={data?.invoiceStats?.total} minimumFractionDigits={0} maximumFractionDigits={0} /></span>
          </div>
          <p className="text-sm text-gray-500">{language === 'ar' ? 'ليس إيراد منصة — فواتير عملاء المستأجرين' : 'Not platform revenue — tenant customer invoices'}</p>
        </motion.div>
      </div>
    </div>
  )
}
