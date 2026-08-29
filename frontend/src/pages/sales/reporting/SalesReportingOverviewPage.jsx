import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../../../lib/api'
import { fieldControlClass, fieldLabelClass, sectionCardClass } from '../salesUi'
import { SALES_REPORT_SECTIONS } from '../salesConfig.menu'

export default function SalesReportingOverviewPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [preset, setPreset] = useState('30d')

  const { data: charts, isLoading } = useQuery({
    queryKey: ['sales-reporting-charts', preset],
    queryFn: async () => (await api.get('/sales/reporting/charts', { params: { preset } })).data,
  })

  const revenueSeries = useMemo(() => charts?.revenueByDay || [], [charts])
  const byTeam = useMemo(() => charts?.byTeam || [], [charts])
  const topProducts = useMemo(() => charts?.topProducts || [], [charts])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isAr ? 'نظرة عامة على التقارير' : 'Reporting overview'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAr ? 'إيرادات ومؤشرات بصرية لأداء المبيعات' : 'Visual revenue and sales performance'}
          </p>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'الفترة' : 'Period'}</label>
          <select className={fieldControlClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="mtd">Month to date</option>
            <option value="ytd">Year to date</option>
            <option value="365d">Last 365 days</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : null}

      <div className={`${sectionCardClass} !p-4`}>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {isAr ? 'الإيراد اليومي' : 'Daily revenue'}
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${sectionCardClass} !p-4`}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'حسب الفريق' : 'By team'}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeam}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#334155" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={`${sectionCardClass} !p-4`}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'أفضل المنتجات' : 'Top products'}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#64748b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SALES_REPORT_SECTIONS.filter((s) => s.id !== 'overview').map((s) => (
          <Link
            key={s.id}
            to={s.href}
            className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
          >
            {isAr ? s.labelAr : s.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
