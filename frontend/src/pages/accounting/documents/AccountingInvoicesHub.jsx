import { useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import CustomerInvoicesPanel from './CustomerInvoicesPanel'
import VendorBillsPanel from './VendorBillsPanel'

/**
 * Unified Accounting → Invoices hub: Sales (AR) + Purchase (AP) with shared create CTAs.
 */
export default function AccountingInvoicesHub() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = useMemo(() => {
    const raw = String(searchParams.get('tab') || searchParams.get('flow') || 'sales').toLowerCase()
    if (raw === 'purchase' || raw === 'purchases' || raw === 'vendor' || raw === 'bills' || raw === 'ap') {
      return 'purchase'
    }
    return 'sales'
  }, [searchParams])

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'purchase') {
      params.set('tab', 'purchase')
    } else {
      params.delete('tab')
      params.delete('flow')
    }
    setSearchParams(params, { replace: true })
  }

  const segmentWrap =
    'inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-50/80 p-0.5 dark:border-white/10 dark:bg-dark-900/50'
  const segmentBtn = (active) =>
    `rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
      active
        ? 'bg-white text-slate-900 shadow-sm dark:bg-dark-700 dark:text-white'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
    }`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'المحاسبة' : 'Accounting'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isAr ? 'الفواتير' : 'Invoices'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'فواتير المبيعات للعملاء وفواتير الشراء للموردين في مكان واحد'
              : 'Customer sales invoices and vendor purchase bills in one place'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={segmentWrap} role="tablist" aria-label={isAr ? 'نوع الفاتورة' : 'Invoice type'}>
            <button type="button" role="tab" aria-selected={tab === 'sales'} className={segmentBtn(tab === 'sales')} onClick={() => setTab('sales')}>
              {isAr ? 'مبيعات' : 'Sales'}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'purchase'} className={segmentBtn(tab === 'purchase')} onClick={() => setTab('purchase')}>
              {isAr ? 'مشتريات' : 'Purchase'}
            </button>
          </div>
          {tab === 'purchase' ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/app/dashboard/accounting/invoices/new/purchase')}
            >
              <Plus className="h-4 w-4" />
              {isAr ? 'فاتورة شراء' : 'New purchase invoice'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/app/dashboard/accounting/invoices/new/sell')}
            >
              <Plus className="h-4 w-4" />
              {isAr ? 'فاتورة مبيعات' : 'New sales invoice'}
            </button>
          )}
        </div>
      </div>

      {tab === 'purchase' ? (
        <VendorBillsPanel language={language} embedded />
      ) : (
        <CustomerInvoicesPanel language={language} embedded />
      )}
    </div>
  )
}
