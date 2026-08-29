import { Navigate, useLocation } from 'react-router-dom'

/** Legacy hub removed — preserve query string and land on sales invoice composer. */
export default function InvoiceCreate() {
  const location = useLocation()
  return <Navigate to={`/app/dashboard/accounting/invoices/new/sell${location.search}`} replace />
}
