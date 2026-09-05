import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ArrowLeft } from 'lucide-react'

function backHref(pathname, search = '') {
  if (pathname.includes('/quotations')) return '/app/dashboard/quotations'
  if (pathname.includes('/sales/orders')) return '/app/dashboard/sales/orders'
  if (pathname.includes('/general-voucher')) return '/app/dashboard/accounting/general-voucher'
  if (pathname.includes('/journal-books')) return '/app/dashboard/accounting/journal-books'
  if (pathname.includes('/vendor-refunds')) return '/app/dashboard/accounting/vendor-refunds'
  if (pathname.includes('/bills/new') || pathname.includes('/bills/')) return '/app/dashboard/accounting/bills'
  if (pathname.includes('/purchase')) {
    if (/refund=/.test(search)) return '/app/dashboard/accounting/vendor-refunds'
    return '/app/dashboard/accounting/bills'
  }
  if (pathname.includes('/accounting/invoices')) return '/app/dashboard/accounting/invoices'
  return '/app/dashboard/accounting/invoices'
}

function titleFor(pathname, search, isAr) {
  if (pathname.includes('/sales/orders')) return isAr ? 'أمر بيع جديد' : 'New sales order'
  if (pathname.includes('/quotations')) {
    if (pathname.includes('/edit')) return isAr ? 'تعديل عرض السعر' : 'Edit quotation'
    return isAr ? 'عرض سعر جديد' : 'New quotation'
  }
  if (pathname.includes('/general-voucher')) return isAr ? 'سند قيد عام' : 'General voucher'
  if (pathname.includes('/journal-books')) return isAr ? 'دفتر قيد جديد' : 'New journal book'
  if (pathname.includes('/vendor-refunds')) return isAr ? 'مرتجع مورد' : 'Vendor refund'
  if (pathname.includes('/bills/new') || (pathname.includes('/purchase') && !/refund=/.test(search))) {
    return isAr ? 'فاتورة مورد' : 'Vendor bill'
  }
  if (pathname.includes('/purchase')) return isAr ? 'فاتورة مورد' : 'Vendor bill'
  if (search.includes('proforma=1')) return isAr ? 'فاتورة مبدئية' : 'New proforma'
  if (pathname.includes('/edit')) return isAr ? 'تعديل الفاتورة' : 'Edit invoice'
  return isAr ? 'فاتورة مبيعات جديدة' : 'New sales invoice'
}

/**
 * Minimal create-mode top bar: back + title only (no module icon strip).
 */
export default function SalesComposerChrome({ pathname, search = '' }) {
  const navigate = useNavigate()
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'

  return (
    <div className="relative z-10 border-b border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-900">
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          onClick={() => navigate(backHref(pathname, search))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-200"
          aria-label={isAr ? 'رجوع' : 'Back'}
        >
          <ArrowLeft className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} strokeWidth={1.75} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            {titleFor(pathname, search, isAr)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function isSalesComposerPath(pathname = '') {
  if (/\/accounting\/(invoices\/(new|[^/]+\/edit)|bills\/new|vendor-refunds\/new)/.test(pathname)) return true
  if (/\/invoices\/new(\/|$)/.test(pathname)) return true
  if (/\/invoices\/[^/]+\/edit/.test(pathname)) return true
  if (/\/quotations\/new(\/|$)/.test(pathname)) return true
  if (/\/quotations\/[^/]+\/edit/.test(pathname)) return true
  if (/\/sales\/orders\/new(\/|$)/.test(pathname)) return true
  return false
}
