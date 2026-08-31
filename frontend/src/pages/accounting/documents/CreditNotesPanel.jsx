import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Eye } from 'lucide-react'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import { documentStatusLabel } from '../../../lib/accountingDocumentStatus'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  rowActionBtnClass,
  rowActionsWrapClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  salesTableClass,
  softChipClass,
} from '../../sales/salesUi'

const trimName = (party) => {
  const en = String(party?.name || party?.nameEn || '').trim()
  const ar = String(party?.nameAr || '').trim()
  if (en && ar && en !== ar) return `${en} / ${ar}`
  return en || ar || '—'
}

export default function CreditNotesPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes', search, statusFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        limit: 100,
        flow: 'sell',
        invoiceType: '381',
        search: search || undefined,
        status: statusFilter || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.invoices || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'العملاء' : 'Customers'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isAr ? 'إشعارات الدائن' : 'Credit notes'}
          </h2>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/app/dashboard/accounting/invoices/new/sell')}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'إشعار جديد' : 'New credit note'}
        </button>
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={fieldControlClass}
        >
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="issued">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
      </div>

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد إشعارات دائن' : 'No credit notes yet'}</p>}
            renderCard={(row) => (
              <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={`${docLinkClass} text-base`}>
                  {row.invoiceNumber}
                </Link>
                <p className="text-sm text-slate-500">{trimName(row.buyer)}</p>
                <div className="flex items-center justify-between text-sm">
                  <Money value={Math.abs(Number(row.grandTotal || 0))} />
                  <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                </div>
              </div>
            )}
          >
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={salesThClass}>{isAr ? 'رقم الإشعار' : 'Number'}</th>
                  <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                  <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className={salesThClass}>{isAr ? 'الفاتورة الأصلية' : 'Reversed document'}</th>
                  <th className={salesThClass}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                  <th className={salesThClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className={salesTrClass}>
                    <td className={salesTdClass}>
                      <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={docLinkClass}>
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className={salesTdClass}>{trimName(row.buyer)}</td>
                    <td className={salesTdClass}>
                      {row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                    </td>
                    <td className={salesTdClass}>
                      {row.originalInvoiceId ? (
                        <Link
                          to={`/app/dashboard/accounting/invoices/${row.originalInvoiceId?._id || row.originalInvoiceId}`}
                          className={docLinkClass}
                        >
                          {isAr ? 'عرض الفاتورة' : 'View invoice'}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className={`${salesTdClass} tabular-nums`}>
                      <Money value={Math.abs(Number(row.grandTotal || 0))} />
                    </td>
                    <td className={salesTdClass}>
                      <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                    </td>
                    <td className={salesTdClass}>
                      <div className={rowActionsWrapClass}>
                        <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={rowActionBtnClass}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveDataList>
        )}
      </div>
    </div>
  )
}
