import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/api'
import { listShellClass, salesTableClass, salesTdClass, salesThClass, salesTrClass } from '../salesUi'

export default function CustomersReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-report-customers'],
    queryFn: async () => (await api.get('/sales/reporting/customers')).data,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Customer LTV & outstanding balances</h2>
      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>Customer</th>
              <th className={salesThClass}>Total invoiced</th>
              <th className={salesThClass}>Total paid</th>
              <th className={salesThClass}>Balance due</th>
              <th className={salesThClass}>Loyalty pts</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className={salesTdClass}>Loading…</td></tr>
            ) : (data?.customers || []).map((c) => (
              <tr key={c._id} className={salesTrClass}>
                <td className={salesTdClass}>{c.name}</td>
                <td className={salesTdClass}>{Number(c.totalInvoiced || 0).toFixed(2)}</td>
                <td className={salesTdClass}>{Number(c.totalPaid || 0).toFixed(2)}</td>
                <td className={salesTdClass}>{Number(c.balanceDue || 0).toFixed(2)}</td>
                <td className={salesTdClass}>{c.loyaltyPoints ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
