import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/api'
import { listShellClass, salesTableClass, salesTdClass, salesThClass, salesTrClass } from '../salesUi'

export default function SalespeopleReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-report-salespeople'],
    queryFn: async () => (await api.get('/sales/reporting/salespeople')).data,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Salespeople performance vs targets</h2>
      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>Salesperson</th>
              <th className={salesThClass}>Revenue</th>
              <th className={salesThClass}>Invoices</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className={salesTdClass}>Loading…</td></tr>
            ) : (data?.performance || []).map((row) => (
              <tr key={row.salespersonId} className={salesTrClass}>
                <td className={salesTdClass}>{row.salespersonId}</td>
                <td className={salesTdClass}>{Number(row.revenue || 0).toFixed(2)}</td>
                <td className={salesTdClass}>{row.invoiceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={listShellClass}>
        <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Team targets</h3>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>Team</th>
              <th className={salesThClass}>Monthly target</th>
              <th className={salesThClass}>Quarterly target</th>
            </tr>
          </thead>
          <tbody>
            {(data?.teams || []).map((t) => (
              <tr key={t._id} className={salesTrClass}>
                <td className={salesTdClass}>{t.name}</td>
                <td className={salesTdClass}>{t.monthlyTarget}</td>
                <td className={salesTdClass}>{t.quarterlyTarget}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
