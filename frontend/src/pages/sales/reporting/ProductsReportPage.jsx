import { useQuery } from '@tanstack/react-query'
import api from '../../../lib/api'
import { listShellClass, salesTableClass, salesTdClass, salesThClass, salesTrClass } from '../salesUi'

export default function ProductsReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-report-products'],
    queryFn: async () => (await api.get('/sales/reporting/products')).data,
  })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Product velocity & volume</h2>
      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>Product</th>
              <th className={salesThClass}>Qty sold</th>
              <th className={salesThClass}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className={salesTdClass}>Loading…</td></tr>
            ) : (data?.velocity || []).map((row, i) => (
              <tr key={i} className={salesTrClass}>
                <td className={salesTdClass}>{row.name}</td>
                <td className={salesTdClass}>{row.qty}</td>
                <td className={salesTdClass}>{Number(row.revenue || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
