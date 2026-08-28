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

export default function ProductsReportPage() {
  const [preset, setPreset] = useState('365d')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-report-products', preset],
    queryFn: async () => (await api.get('/sales/reporting/products', { params: { preset } })).data,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Product velocity</h2>
          <p className="text-xs text-slate-500">
            {isLoading ? 'Loading…' : `${data?.invoiceCount ?? 0} sales invoices · qty & revenue from invoice lines`}
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
              <th className={salesThClass}>Product</th>
              <th className={salesThClass}>SKU</th>
              <th className={`${salesThClass} text-end`}>Qty sold</th>
              <th className={`${salesThClass} text-end`}>Untaxed</th>
              <th className={`${salesThClass} text-end`}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className={salesTdClass}>Loading…</td></tr>
            ) : !(data?.velocity || []).length ? (
              <tr><td colSpan={5} className={salesTdClass}>No product lines on sales invoices in this range</td></tr>
            ) : (data?.velocity || []).map((row, i) => (
              <tr key={row.productId || i} className={salesTrClass}>
                <td className={salesTdClass}>{row.name}</td>
                <td className={salesTdClass}>{row.sku || '—'}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{row.qty}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(row.untaxed || 0).toFixed(2)}</td>
                <td className={`${salesTdClass} text-end tabular-nums`}>{Number(row.revenue || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
