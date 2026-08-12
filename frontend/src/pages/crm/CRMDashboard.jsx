import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import api from '../../lib/api'
import CRMDealsTab from './CRMDealsTab'
import CRMActivitiesTab from './CRMActivitiesTab'
import CRMSubnav from './CRMSubnav'
import { crmShell, crmInkBtn, crmLabel, DEAL_STAGES, formatMoney } from './crmUi'

export default function CRMDashboard() {
  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const t = (en, ar) => (language === 'ar' ? ar : en)
  const currency = tenant?.settings?.currency || 'SAR'

  const { data: stats } = useQuery({
    queryKey: ['crm-stats'],
    queryFn: async () => (await api.get('/crm/stats')).data,
  })

  const pipelineByStage = useMemo(() => {
    const map = Object.fromEntries((stats?.pipeline || []).map((p) => [p._id, p]))
    return DEAL_STAGES.filter((s) => s.id !== 'closed_lost').map((stage) => {
      const row = map[stage.id] || { count: 0, value: 0 }
      return { ...stage, count: row.count || 0, value: row.value || 0 }
    })
  }, [stats])

  const maxFunnel = Math.max(1, ...pipelineByStage.map((s) => s.count), stats?.leadTotal || 0)
  const wonCount = pipelineByStage.find((s) => s.id === 'closed_won')?.count || 0
  const openValue = (stats?.dealValue || 0) - (stats?.wonValue || 0)

  const kpis = [
    { label: t('Leads', 'العملاء'), value: stats?.leadTotal ?? 0 },
    { label: t('Deals', 'الصفقات'), value: stats?.dealTotal ?? 0 },
    { label: t('Open pipeline', 'المسار المفتوح'), value: formatMoney(Math.max(0, openValue), currency) },
    { label: t('Won', 'الفوز'), value: formatMoney(stats?.wonValue ?? 0, currency), accent: true },
    { label: t('Follow-ups', 'متابعات'), value: stats?.followUpCount ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <CRMSubnav />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={crmLabel}>{t('Relationships', 'العلاقات')}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[28px]">
            {t('CRM', 'إدارة العملاء')}
          </h1>
          <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t('Pipeline, follow-ups, and conversion in one workspace', 'المسار والمتابعات والتحويل في مساحة واحدة')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/dashboard/crm/leads" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            {t('Leads', 'العملاء المحتملون')}
            <ArrowRight className={`h-3.5 w-3.5 ${language === 'ar' ? 'rotate-180' : ''}`} />
          </Link>
          <Link to="/app/dashboard/crm/deals" className={crmInkBtn}>
            {t('Open pipeline', 'فتح المسار')}
            <ArrowRight className={`h-3.5 w-3.5 opacity-70 ${language === 'ar' ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </div>

      <div className={crmShell}>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-5 dark:bg-white/[0.08]">
          {kpis.map((item) => (
            <div key={item.label} className="bg-white px-4 py-4 sm:px-5 sm:py-5 dark:bg-[#0c111a]">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p
                className={`mt-2 text-[20px] font-semibold tabular-nums tracking-tight ${
                  item.accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <CRMDealsTab preview />
        </div>

        <div className={`${crmShell} p-5 xl:col-span-4`}>
          <p className={crmLabel}>{t('Conversion', 'التحويل')}</p>
          <h3 className="mt-1.5 text-[15px] font-medium text-slate-900 dark:text-white">
            {t('Sales funnel', 'قمع المبيعات')}
          </h3>
          <div className="mt-5 space-y-4">
            {[
              { id: 'leads', label: t('Leads', 'عملاء محتملون'), count: stats?.leadTotal || 0 },
              ...pipelineByStage.map((s) => ({
                id: s.id,
                label: t(s.label, s.ar),
                count: s.count,
              })),
            ].map((row) => (
              <div key={row.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-slate-500 dark:text-slate-400">{row.label}</span>
                  <span className="text-[12px] font-medium tabular-nums text-slate-800 dark:text-slate-200">
                    {row.count}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${row.id === 'closed_won' ? 'bg-emerald-500' : 'bg-slate-900 dark:bg-white'}`}
                    style={{ width: `${Math.max(4, Math.round((row.count / maxFunnel) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-slate-400">
            {t('Won deals', 'صفقات فائزة')}: <span className="tabular-nums text-slate-600 dark:text-slate-300">{wonCount}</span>
          </p>
        </div>
      </div>

      <CRMActivitiesTab preview />
    </div>
  )
}
