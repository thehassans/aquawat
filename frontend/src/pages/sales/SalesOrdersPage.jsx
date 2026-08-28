import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import api from '../../lib/api'
import {
  listShellClass,
  pageSubtitleClass,
  pageTitleClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  docLinkClass,
  emptyStateClass,
} from './salesUi'

export default function SalesOrdersPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const { data: res } = await api.get('/purchase-orders', { params: { flow: 'sell', limit: 100 } })
      return res.purchaseOrders || res.items || res || []
    },
  })

  const rows = Array.isArray(data) ? data : []

  return (
    <div className="space-y-4">
      <div>
        <h1 className={pageTitleClass}>{isAr ? 'أوامر البيع' : 'Sales Orders'}</h1>
        <p className={pageSubtitleClass}>
          {isAr ? 'طلبات البيع المؤكدة والتسليم والفوترة' : 'Confirmed sell orders, delivery, and invoicing'}
        </p>
      </div>
      <div className={listShellClass}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
              <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
              <th className={salesThClass}>{isAr ? 'الإجمالي' : 'Total'}</th>
              <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className={salesTdClass}>…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className={`${salesTdClass} ${emptyStateClass}`}>{isAr ? 'لا توجد أوامر بيع' : 'No sales orders yet'}</td></tr>
            ) : rows.map((row) => (
              <tr key={row._id} className={salesTrClass}>
                <td className={salesTdClass}>
                  <Link to={`/app/dashboard/sales/orders/${row._id}`} className={docLinkClass}>
                    {row.poNumber || row._id}
                  </Link>
                </td>
                <td className={salesTdClass}>{row.status}</td>
                <td className={salesTdClass}>{Number(row.grandTotal || 0).toFixed(2)} {row.currency || 'SAR'}</td>
                <td className={salesTdClass}>{row.orderDate ? new Date(row.orderDate).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
