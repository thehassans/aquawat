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

export default function CustomersReportPage() {
  const [preset, setPreset] = useState('365d')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-report-customers', preset],
    queryFn: async () => (await api.get('/sales/reporting/customers', { params: { preset } })).data,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Customer sales & balances</h2>
          <p className="text-xs text-slate-500">Period totals from sales invoices · balances from partner ledger</p>
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
              <th className={salesThClass}>Customer</th>
              <th className={`${salesThClass} text-end`}>Invoices</th>
              <th className={`${salesThClass} text-end`}>Total invoiced</th>
              <th className={`${salesThClass} text-end`}>Total paid</th>
              <th className={`${salesThClass} text-end`}>Balance due</th>
              <th className={`${salesThClass} text-end`}>Loyalty</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className={salesTdClass}>Loading…</td></tr>
            ) : !(data?.customers || []).length ? (
              <tr><td colSpan={6} className={salesTdClass}>No customer sales in this range</td></tr>
            ) : (data?.customers || []).map((c) => (
              <tr key={c._id || c.name} className={salesTrClass}>
                <td className={salesTdClass}>{c.name}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{c.invoiceCount ?? 0}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(c.totalInvoiced || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(c.totalPaid || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(c.balanceDue || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{c.loyaltyPoints ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
