import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { listShellClass, salesTableClass, salesTdClass, salesThClass, salesTrClass } from '../sales/salesUi'

const portalApi = axios.create({ baseURL: '/api/portal' })
portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default function PortalDocumentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-documents'],
    queryFn: async () => (await portalApi.get('/documents')).data,
  })

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Please sign in to view your documents.</p>
        <Link to="/portal/login" className="text-teal-700">Go to login</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My documents</h1>
        <Link to="/portal/login" className="text-sm text-slate-500">Sign out</Link>
      </div>

      {['quotations', 'salesOrders', 'invoices'].map((section) => {
        const labels = { quotations: 'Quotations', salesOrders: 'Sales Orders', invoices: 'Invoices' }
        const rows = data?.[section] || []
        return (
          <div key={section}>
            <h2 className="mb-2 text-lg font-semibold">{labels[section]}</h2>
            <div className={listShellClass}>
              <table className={salesTableClass}>
                <thead>
                  <tr>
                    <th className={salesThClass}>Number</th>
                    <th className={salesThClass}>Status</th>
                    <th className={salesThClass}>Total</th>
                    <th className={salesThClass}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={4} className={salesTdClass}>Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={4} className={salesTdClass}>No documents</td></tr>
                  ) : rows.map((row) => (
                    <tr key={row._id} className={salesTrClass}>
                      <td className={salesTdClass}>{row.quotationNumber || row.poNumber || row.invoiceNumber}</td>
                      <td className={salesTdClass}>{row.status}</td>
                      <td className={salesTdClass}>{row.grandTotal} {row.currency || 'SAR'}</td>
                      <td className={salesTdClass}>{new Date(row.createdAt || row.orderDate || row.invoiceDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
