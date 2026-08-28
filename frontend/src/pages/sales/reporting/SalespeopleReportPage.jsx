import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/api'
import { fieldControlClass, fieldLabelClass, listShellClass, salesTableClass, salesTdClass, salesThClass, salesTrClass } from '../salesUi'

const PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: '365d', label: 'Last 365 days' },
]

export default function SalespeopleReportPage() {
  const [preset, setPreset] = useState('365d')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-report-salespeople', preset],
    queryFn: async () => (await api.get('/sales/reporting/salespeople', { params: { preset } })).data,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Salespeople performance</h2>
          <p className="text-xs text-slate-500">
            {isLoading ? 'Loading…' : `${data?.invoiceCount ?? 0} sales invoices · attributed via SO salesperson or invoice creator`}
          </p>
        </div>
        <div>
          <label className={fieldLabelClass}>Period</label>
          <select className={fieldControlClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>Salesperson</th>
              <th className={`${salesThClass} text-end`}>Revenue</th>
              <th className={`${salesThClass} text-end`}>Untaxed</th>
              <th className={`${salesThClass} text-end`}>Paid</th>
              <th className={`${salesThClass} text-end`}>Invoices</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className={salesTdClass}>Loading…</td></tr>
            ) : !(data?.performance || []).length ? (
              <tr><td colSpan={5} className={salesTdClass}>No sales invoices in this range</td></tr>
            ) : (data?.performance || []).map((row) => (
              <tr key={row.salespersonId} className={salesTrClass}>
                <td className={salesTdClass}>{row.name || row.salespersonId}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(row.revenue || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(row.untaxed || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(row.paid || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{row.invoiceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.teams || []).length > 0 ? (
        <div className={listShellClass}>
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Team targets</h3>
          <table className={salesTableClass}>
            <thead>
              <tr>
                <th className={salesThClass}>Team</th>
                <th className={`${salesThClass} text-end`}>Monthly target</th>
                <th className={`${salesThClass} text-end`}>Quarterly target</th>
              </tr>
            </thead>
            <tbody>
              {(data?.teams || []).map((t) => (
                <tr key={t._id} className={salesTrClass}>
                  <td className={salesTdClass}>{t.name}</td>
                  <td className={`${salesTdClass} text-end tabular-nums`}>{t.monthlyTarget ?? '—'}</td>
                  <td className={`${salesTdClass} text-end tabular-nums`}>{t.quarterlyTarget ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
