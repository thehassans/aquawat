import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Truck } from 'lucide-react'
import api from '../../lib/api'
import { ghostActionClass } from '../../pages/sales/salesUi'

/** Smart buttons: Delivery / Invoice counts linking from a sell order */
export default function SalesOrderSmartButtons({ purchaseOrderId, language = 'en' }) {
  const isAr = language === 'ar'
  const { data } = useQuery({
    queryKey: ['sales-smart-buttons', purchaseOrderId],
    queryFn: async () => (await api.get(`/sales/orders/${purchaseOrderId}/smart-buttons`)).data,
    enabled: Boolean(purchaseOrderId),
  })

  if (!purchaseOrderId || !data) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link to={data.deliveryHref} className={ghostActionClass}>
        <Truck className="h-3.5 w-3.5" />
        {isAr ? `${data.deliveries} تسليم` : `${data.deliveries} Delivery`}
      </Link>
      <Link to={data.invoiceHref} className={ghostActionClass}>
        <FileText className="h-3.5 w-3.5" />
        {isAr ? `${data.invoices} فاتورة` : `${data.invoices} Invoice`}
      </Link>
    </div>
  )
}
