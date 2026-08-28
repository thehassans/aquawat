import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import api from '../../../lib/api'
import { fieldControlClass, fieldLabelClass, ghostActionClass, listShellClass, sectionCardClass } from '../salesUi'

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b']

export default function SalesAnalysisPage() {
  const [preset, setPreset] = useState('365d')
  const [groupBy, setGroupBy] = useState('product')
  const [measure, setMeasure] = useState('untaxedTotal')
  const [chartType, setChartType] = useState('bar')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-analysis', preset, groupBy, measure],
    queryFn: async () => (await api.get('/sales/reporting/analysis', { params: { preset, groupBy, measure } })).data,
  })

  const chartData = useMemo(() => {
    const rows = data?.rows || []
    const map = new Map()
    for (const r of rows) {
      const k = r.key || 'unknown'
      map.set(k, (map.get(k) || 0) + Number(r[measure] || 0))
    }
    return [...map.entries()].map(([name, value]) => ({ name: String(name).slice(0, 24), value })).slice(0, 12)
  }, [data, measure])

  const exportCsv = () => {
    const rows = data?.rows || []
    const header = ['key', 'period', measure]
    const lines = [header.join(','), ...rows.map((r) => [r.key, r.period, r[measure]].join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sales-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={fieldLabelClass}>Period</label>
          <select className={fieldControlClass} value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="365d">Last 365 days</option>
            <option value="ytd">Year to date</option>
            <option value="mtd">Month to date</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>Group by</label>
          <select className={fieldControlClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="product">Product</option>
            <option value="customer">Customer</option>
            <option value="salesperson">Salesperson</option>
            <option value="date">Order date</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>Measure</label>
          <select className={fieldControlClass} value={measure} onChange={(e) => setMeasure(e.target.value)}>
            <option value="untaxedTotal">Untaxed total</option>
            <option value="totalSales">Total sales</option>
            <option value="margin">Margin</option>
            <option value="qtyOrdered">Qty ordered</option>
            <option value="qtyInvoiced">Qty invoiced</option>
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
        <button type="button" className={ghostActionClass} onClick={exportCsv}>Insert in Spreadsheet (CSV)</button>
      </div>

      <div className={`${sectionCardClass} h-80`}>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading chart…</p>
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
                <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#14b8a6" radius={[6, 6, 0, 0]} />
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
              <th className="px-4 py-3">{measure}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).slice(0, 50).map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-4 py-3">{r.key}</td>
                <td className="px-4 py-3">{r.period}</td>
                <td className="px-4 py-3">{Number(r[measure] || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
