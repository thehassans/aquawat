import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowRight, FileText, ShoppingCart } from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import {
  docLinkClass,
  emptyStateClass,
  kpiCardClass,
  listShellClass,
  pageSubtitleClass,
  pageTitleClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
  softChipClass,
} from './salesUi'

function Kpi({ label, value, empty }) {
  return (
    <div className={`${kpiCardClass} !p-3.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${empty ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
        {empty ? '—' : value}
      </p>
    </div>
  )
}

function RecentSection({ title, href, viewAllLabel, loading, emptyLabel, columns, rows }) {
  return (
    <div className={`${sectionCardClass} !p-0 overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3 dark:border-dark-600">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        <Link to={href} className={docLinkClass}>
          {viewAllLabel} <ArrowRight className="ms-1 inline h-3.5 w-3.5" />
        </Link>
      </div>
      <div className={`${listShellClass} !rounded-none !border-0 !shadow-none`}>
        <table className={salesTableClass}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className={salesThClass}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className={salesTdClass}>…</td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={columns.length} className={`${salesTdClass} ${emptyStateClass}`}>{emptyLabel}</td></tr>
            ) : rows}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SalesHomePage() {
  const { language } = useSelector((s) => s.ui)
  const { tenant } = useSelector((s) => s.auth)
  const isAr = language === 'ar'
  const hideQuotations = getTenantBusinessTypes(tenant).includes('bakala')
  const currency = tenant?.settings?.currency || 'SAR'

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['sales-home-orders'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders', { params: { flow: 'sell', limit: 8 } })
      return data.purchaseOrders || data.items || data || []
    },
  })

  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: ['sales-home-quotations'],
    queryFn: async () => {
      const { data } = await api.get('/quotations', { params: { limit: 8, page: 1 } })
      return data.quotations || data.items || data || []
    },
    enabled: !hideQuotations,
  })

  const orderList = Array.isArray(orders) ? orders : []
  const quoteList = Array.isArray(quotations) ? quotations : []
  const openQuotes = quoteList.filter((q) => !['cancelled', 'rejected', 'converted', 'expired'].includes(q.status)).length
  const orderTotal = orderList.reduce((s, row) => s + Number(row.grandTotal ?? row.total ?? 0), 0)
  const draftOrders = orderList.filter((o) => String(o.status || '').toLowerCase() === 'draft').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className={pageTitleClass}>{isAr ? 'نظرة عامة على المبيعات' : 'Sales overview'}</h1>
        <p className={pageSubtitleClass}>
          {isAr ? 'الطلبات وعروض الأسعار في مكان واحد' : 'Orders and quotations in one place'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={isAr ? 'طلبات' : 'Orders'} value={orderList.length} empty={!orderList.length} />
        <Kpi label={isAr ? 'مسودات الطلبات' : 'Draft orders'} value={draftOrders} empty={!draftOrders} />
        {!hideQuotations ? (
          <Kpi label={isAr ? 'عروض مفتوحة' : 'Open quotes'} value={openQuotes} empty={!openQuotes} />
        ) : (
          <Kpi label={isAr ? 'مؤكدة' : 'Confirmed'} value={orderList.filter((o) => ['approved', 'delivered', 'partially_delivered'].includes(o.status)).length} empty={!orderList.length} />
        )}
        <Kpi
          label={isAr ? 'قيمة الطلبات' : 'Orders value'}
          value={`${Number(orderTotal || 0).toFixed(2)} ${currency}`}
          empty={!orderTotal}
        />
      </div>

      <div className={`grid gap-4 ${hideQuotations ? '' : 'xl:grid-cols-2'}`}>
        <RecentSection
          title={isAr ? 'أحدث الطلبات' : 'Recent orders'}
          href="/app/dashboard/sales/orders"
          viewAllLabel={isAr ? 'الكل' : 'View all'}
          loading={ordersLoading}
          emptyLabel={isAr ? 'لا توجد طلبات' : 'No orders yet'}
          columns={[isAr ? 'الرقم' : 'Number', isAr ? 'العميل' : 'Customer', isAr ? 'الحالة' : 'Status', isAr ? 'الإجمالي' : 'Total']}
          rows={orderList.slice(0, 8).map((row) => (
            <tr key={row._id} className={salesTrClass}>
              <td className={salesTdClass}>
                <Link to={`/app/dashboard/sales/orders/${row._id}`} className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                  <ShoppingCart className="h-3.5 w-3.5 text-slate-400" />
                  {row.poNumber || row.orderNumber || '—'}
                </Link>
              </td>
              <td className={salesTdClass}>{row.customerName || row.customerId?.name || row.customerId?.nameEn || '—'}</td>
              <td className={salesTdClass}><span className={softChipClass}>{row.status || '—'}</span></td>
              <td className={`${salesTdClass} text-end tabular-nums`}><Money value={row.grandTotal ?? row.total} currency={currency} /></td>
            </tr>
          ))}
        />

        {!hideQuotations ? (
          <RecentSection
            title={isAr ? 'أحدث العروض' : 'Recent quotations'}
            href="/app/dashboard/quotations"
            viewAllLabel={isAr ? 'الكل' : 'View all'}
            loading={quotationsLoading}
            emptyLabel={isAr ? 'لا توجد عروض' : 'No quotations yet'}
            columns={[isAr ? 'الرقم' : 'Number', isAr ? 'العميل' : 'Customer', isAr ? 'الحالة' : 'Status', isAr ? 'الإجمالي' : 'Total']}
            rows={quoteList.slice(0, 8).map((row) => (
              <tr key={row._id} className={salesTrClass}>
                <td className={salesTdClass}>
                  <Link to={`/app/dashboard/quotations/${row._id}`} className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    {row.quotationNumber || '—'}
                  </Link>
                </td>
                <td className={salesTdClass}>{row.buyer?.name || row.customerId?.name || '—'}</td>
                <td className={salesTdClass}><span className={softChipClass}>{row.status || '—'}</span></td>
                <td className={`${salesTdClass} text-end tabular-nums`}><Money value={row.grandTotal} currency={currency} /></td>
              </tr>
            ))}
          />
        ) : null}
      </div>
    </div>
  )
}
