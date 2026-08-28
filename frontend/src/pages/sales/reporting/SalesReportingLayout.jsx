import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../../lib/api'
import {
  salesTabClass,
  pageSubtitleClass,
  pageTitleClass,
  sectionEyebrowClass,
  sectionCardClass,
  fieldControlClass,
  fieldLabelClass,
} from '../salesUi'
import { SALES_REPORT_SECTIONS } from '../salesConfig.menu'

export default function SalesReportingLayout() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const location = useLocation()
  const [preset, setPreset] = useState('365d')

  const { data: summary } = useQuery({
    queryKey: ['sales-reporting-summary', preset],
    queryFn: async () => (await api.get('/sales/reporting/summary', { params: { preset } })).data,
  })

  const kpis = [
    { labelEn: 'Invoices', labelAr: 'فواتير', value: summary?.invoiceCount ?? '—' },
    { labelEn: 'Revenue', labelAr: 'الإيراد', value: summary?.revenue != null ? Number(summary.revenue).toFixed(2) : '—' },
    { labelEn: 'Untaxed', labelAr: 'بدون ضريبة', value: summary?.untaxed != null ? Number(summary.untaxed).toFixed(2) : '—' },
    { labelEn: 'Paid', labelAr: 'محصّل', value: summary?.paid != null ? Number(summary.paid).toFixed(2) : '—' },
    { labelEn: 'Outstanding', labelAr: 'مستحق', value: summary?.outstanding != null ? Number(summary.outstanding).toFixed(2) : '—' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={sectionEyebrowClass}>{isAr ? 'مبيعات' : 'Sales'}</p>
          <h1 className={pageTitleClass}>{isAr ? 'تقارير المبيعات' : 'Sales Reporting'}</h1>
          <p className={pageSubtitleClass}>
            {isAr
              ? 'كل فواتير البيع (B2B و B2C) ضمن الفترة المحددة'
              : 'All sell invoices (B2B & B2C) for the selected period'}
          </p>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'فترة الملخص' : 'Summary period'}</label>
          <select className={fieldControlClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="mtd">Month to date</option>
            <option value="ytd">Year to date</option>
            <option value="365d">Last 365 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.labelEn} className={`${sectionCardClass} !p-3`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {isAr ? k.labelAr : k.labelEn}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {(summary?.byTransactionType || []).length > 0 ? (
        <p className="text-xs text-slate-500">
          {(summary.byTransactionType || []).map((t) => `${t.type}: ${t.invoiceCount} · ${Number(t.revenue || 0).toFixed(2)}`).join('  ·  ')}
        </p>
      ) : null}

      <div className="overflow-x-auto border-b border-slate-200/90 dark:border-dark-600">
        <nav className="flex min-w-max items-center gap-1">
          {SALES_REPORT_SECTIONS.map((item) => {
            const active = location.pathname.startsWith(item.href)
            return (
              <NavLink key={item.id} to={item.href} className={() => salesTabClass(active)}>
                {isAr ? item.labelAr : item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
