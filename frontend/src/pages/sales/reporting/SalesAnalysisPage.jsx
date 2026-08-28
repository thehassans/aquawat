import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import api from '../../../lib/api'
import { fieldControlClass, fieldLabelClass, ghostActionClass, listShellClass, sectionCardClass } from '../salesUi'

const COLORS = ['#0f172a', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#14b8a6']

const PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: '365d', label: 'Last 365 days' },
]

export default function SalesAnalysisPage() {
  const [preset, setPreset] = useState('365d')
  const [groupBy, setGroupBy] = useState('product')
  const [measure, setMeasure] = useState('totalSales')
  const [chartType, setChartType] = useState('bar')
  const [transactionType, setTransactionType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-analysis', preset, groupBy, measure, transactionType],
    queryFn: async () => (await api.get('/sales/reporting/analysis', {
      params: {
        preset,
        groupBy,
        measure,
        ...(transactionType ? { transactionType } : {}),
      },
    })).data,
  })

  const chartData = useMemo(() => {
    const rows = data?.rows || []
    const map = new Map()
    for (const r of rows) {
      const k = r.key || 'unknown'
      map.set(k, (map.get(k) || 0) + Number(r[measure] || 0))
    }
    return [...map.entries()].map(([name, value]) => ({ name: String(name).slice(0, 28), value })).slice(0, 12)
  }, [data, measure])

  const exportCsv = () => {
    const rows = data?.rows || []
    const header = ['key', 'period', measure]
    const lines = [header.join(','), ...rows.map((r) => [JSON.stringify(r.key), r.period, r[measure]].join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sales-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={fieldLabelClass}>Period</label>
          <select className={fieldControlClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>Type</label>
          <select className={fieldControlClass} value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
            <option value="">All (B2B + B2C)</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>Group by</label>
          <select className={fieldControlClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="product">Product</option>
            <option value="variant">Product variant</option>
            <option value="category">Product category</option>
            <option value="customer">Customer</option>
            <option value="salesperson">Salesperson</option>
            <option value="transactionType">B2B / B2C</option>
            <option value="businessContext">Business context</option>
            <option value="date">Invoice date</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>Measure</label>
          <select className={fieldControlClass} value={measure} onChange={(e) => setMeasure(e.target.value)}>
            <option value="totalSales">Total sales</option>
            <option value="untaxedTotal">Untaxed total</option>
            <option value="margin">Margin</option>
            <option value="qtyInvoiced">Qty invoiced</option>
            <option value="qtyOrdered">Qty ordered</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>Chart</label>
          <select className={fieldControlClass} value={chartType} onChange={(e) => setChartType(e.target.value)}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </div>
        <button type="button" className={ghostActionClass} onClick={exportCsv}>CSV</button>
      </div>

      <p className="text-xs text-slate-500">
        {isLoading ? 'Loading…' : `${data?.invoiceCount ?? 0} sales invoices in range`}
      </p>

      <div className={`${sectionCardClass} h-80`}>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading chart…</p>
        ) : !chartData.length ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">No sales invoice data for this range</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'pie' ? (
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      <div className={listShellClass}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-end">{measure}</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && !(data?.rows || []).length ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No rows</td></tr>
            ) : (data?.rows || []).slice(0, 50).map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-4 py-3">{r.key}</td>
                <td className="px-4 py-3">{r.period}</td>
                <td className="px-4 py-3 text-end tabular-nums">{Number(r[measure] || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
