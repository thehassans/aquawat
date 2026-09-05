import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import CustomerInvoicesPanel from './CustomerInvoicesPanel'

/**
 * Customers → Invoices only (sales). Purchase bills live under Vendors → Bills.
 * Legacy ?tab=purchase redirects to /accounting/bills.
 */
export default function AccountingInvoicesHub() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const legacyPurchase = useMemo(() => {
    const raw = String(searchParams.get('tab') || searchParams.get('flow') || '').toLowerCase()
    return ['purchase', 'purchases', 'vendor', 'bills', 'ap'].includes(raw)
  }, [searchParams])

  useEffect(() => {
    if (!legacyPurchase) return
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    next.delete('flow')
    const q = next.toString()
    navigate(`/app/dashboard/accounting/bills${q ? `?${q}` : ''}`, { replace: true })
  }, [legacyPurchase, navigate, searchParams])

  if (legacyPurchase) {
    return <Navigate to="/app/dashboard/accounting/bills" replace />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'العملاء / الفواتير' : 'Customers / Invoices'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'فواتير العملاء' : 'Customer invoices'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'فواتير المبيعات الصادرة للعملاء'
              : 'Sales invoices issued to customers'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/app/dashboard/accounting/invoices/new/sell')}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'فاتورة مبيعات' : 'New sales invoice'}
        </button>
      </div>

      <CustomerInvoicesPanel language={language} embedded />
    </div>
  )
}
