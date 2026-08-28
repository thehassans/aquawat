import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Eye, Plus, Search, ShoppingCart } from 'lucide-react'
import api from '../../lib/api'
import {
  chipFilterClass,
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  ghostActionClass,
  kpiCardClass,
  listShellClass,
  pageTitleClass,
  primaryActionClass,
  rowActionPrimaryClass,
  rowActionsWrapClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  softChipClass,
  soStatusChipClass,
  soStatusLabel,
} from './salesUi'

const STATUS_FILTERS = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'draft', en: 'Draft', ar: 'مسودة' },
  { id: 'sent', en: 'Sent', ar: 'مُرسل' },
  { id: 'approved', en: 'Confirmed', ar: 'مؤكد' },
  { id: 'delivered', en: 'Delivered', ar: 'مُسلَّم' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغى' },
]

function KpiValue({ value, suffix }) {
  const empty = value === 0 || value === '0'
  return (
    <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${empty ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
      {empty ? '—' : value}
      {!empty && suffix ? <span className="ms-1 text-sm font-medium text-slate-400">{suffix}</span> : null}
    </p>
  )
}

export default function SalesOrdersPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const { data: res } = await api.get('/purchase-orders', { params: { flow: 'sell', limit: 200 } })
      return res.purchaseOrders || res.items || res || []
    },
  })

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    const needle = q.trim().toLowerCase()
    return list.filter((row) => {
      if (status === 'approved') {
        const confirmed = ['approved', 'partially_delivered', 'delivered'].includes(row.status) || row.isLocked
        if (!confirmed || row.status === 'cancelled') return false
      } else if (status === 'delivered') {
        if (!['delivered', 'partially_delivered'].includes(row.status)) return false
      } else if (status !== 'all' && row.status !== status) {
        return false
      }
      if (!needle) return true
      const hay = [
        row.poNumber,
        row.customerName,
        row.customerId?.name,
        row.customerId?.nameEn,
        row.status,
        row.incoterm,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [data, q, status])

  const kpis = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    const draft = list.filter((r) => r.status === 'draft').length
    const confirmed = list.filter((r) => ['approved', 'partially_delivered', 'delivered'].includes(r.status) || r.isLocked).length
    const revenue = list
      .filter((r) => r.status !== 'cancelled')
      .reduce((s, r) => s + Number(r.grandTotal || 0), 0)
    return { total: list.length, draft, confirmed, revenue }
  }, [data])

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={pageTitleClass}>{isAr ? 'الطلبات' : 'Orders'}</h1>
        <Link to="/app/dashboard/sales/orders/new" className={primaryActionClass}>
          <Plus className="h-3.5 w-3.5" />
          {isAr ? 'طلب جديد' : 'New order'}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={kpiCardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'الإجمالي' : 'Orders'}</p>
          <KpiValue value={kpis.total} />
        </div>
        <div className={kpiCardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'مسودات' : 'Drafts'}</p>
          <KpiValue value={kpis.draft} />
        </div>
        <div className={kpiCardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'مؤكدة' : 'Confirmed'}</p>
          <KpiValue value={kpis.confirmed} />
        </div>
        <div className={kpiCardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'القيمة' : 'Pipeline'}</p>
          <KpiValue value={kpis.revenue ? Math.round(kpis.revenue) : 0} suffix="SAR" />
        </div>
      </div>

      <div className={filterBarClass}>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${fieldControlClass} ps-10`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isAr ? 'بحث برقم الطلب أو العميل…' : 'Search number or customer…'}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={chipFilterClass(status === f.id)}
              onClick={() => setStatus(f.id)}
            >
              {isAr ? f.ar : f.en}
            </button>
          ))}
        </div>
      </div>

      <div className={`${listShellClass} flex min-h-0 flex-1 flex-col`}>
        <div className="flex-1 overflow-auto">
          <table className={salesTableClass}>
            <thead>
              <tr>
                <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                <th className={salesThClass}>Incoterm</th>
                <th className={`${salesThClass} text-end`}>{isAr ? 'الإجمالي' : 'Total'}</th>
                <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
                <th className={`${salesThClass} w-16`} />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className={salesTdClass}>…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`${salesTdClass} ${emptyStateClass}`}>
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-400 dark:border-white/10 dark:bg-dark-800">
                        <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <p>{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                      <Link to="/app/dashboard/sales/orders/new" className={ghostActionClass}>
                        <Plus className="h-3.5 w-3.5" />
                        {isAr ? 'إنشاء طلب' : 'New order'}
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row._id} className={salesTrClass}>
                  <td className={salesTdClass}>
                    <Link to={`/app/dashboard/sales/orders/${row._id}`} className={docLinkClass}>
                      {row.poNumber || row._id}
                    </Link>
                    {row.isLocked ? <span className={`${softChipClass} ms-2`}>Locked</span> : null}
                  </td>
                  <td className={salesTdClass}>
                    {row.customerId?.nameEn || row.customerId?.name || row.customerName || '—'}
                  </td>
                  <td className={salesTdClass}>
                    <span className={soStatusChipClass(row.status, row.isLocked)}>
                      {soStatusLabel(row.status, row.isLocked, isAr)}
                    </span>
                  </td>
                  <td className={salesTdClass}>{row.incoterm || '—'}</td>
                  <td className={`${salesTdClass} text-end font-semibold tabular-nums`}>
                    {Number(row.grandTotal || 0).toFixed(2)}{' '}
                    <span className="text-xs font-medium text-slate-400">{row.currency || 'SAR'}</span>
                  </td>
                  <td className={salesTdClass}>
                    {row.orderDate ? new Date(row.orderDate).toLocaleDateString() : '—'}
                  </td>
                  <td className={salesTdClass}>
                    <div className={rowActionsWrapClass}>
                      <Link
                        to={`/app/dashboard/sales/orders/${row._id}`}
                        className={rowActionPrimaryClass}
                        title={isAr ? 'عرض' : 'Open'}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
