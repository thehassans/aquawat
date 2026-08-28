import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/api'
import { listShellClass, salesTableClass, salesTdClass, salesThClass, salesTrClass } from '../salesUi'

export default function PaymentTransactionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-payment-transactions'],
    queryFn: async () => (await api.get('/sales/payment-transactions')).data,
  })
  const items = data?.items || []

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment Transactions</h2>
      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>External ID</th>
              <th className={salesThClass}>Amount</th>
              <th className={salesThClass}>Status</th>
              <th className={salesThClass}>Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className={salesTdClass}>Loading…</td></tr>
            ) : items.map((row) => (
              <tr key={row._id} className={salesTrClass}>
                <td className={salesTdClass}>{row.externalId || '—'}</td>
                <td className={salesTdClass}>{row.amount} {row.currency}</td>
                <td className={salesTdClass}>{row.status}</td>
                <td className={salesTdClass}>{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
