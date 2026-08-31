import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Eye } from 'lucide-react'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ExportMenu from '../../../components/ui/ExportMenu'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import { documentStatusLabel } from '../../../lib/accountingDocumentStatus'
import {
  docLinkClass,
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  filterControlClass,
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

export default function VendorRefundsPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-refunds', search, statusFilter],
    queryFn: () => api.get('/invoices', {
      params: {
        limit: 100,
        flow: 'purchase',
        invoiceType: '381',
        search: search || undefined,
        status: statusFilter || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.invoices || []

  const exportColumns = useMemo(() => ([
    { key: 'invoiceNumber', header: isAr ? 'الرقم' : 'Number' },
    { key: 'vendor', header: isAr ? 'المورد' : 'Vendor', accessor: (row) => trimName(row.seller) },
    {
      key: 'issueDate',
      header: isAr ? 'التاريخ' : 'Date',
      accessor: (row) => (row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : ''),
    },
    {
      key: 'reversedBill',
      header: isAr ? 'الفاتورة الأصلية' : 'Reversed bill',
      accessor: (row) => {
        const original = row.originalInvoiceId
        if (!original) return ''
        if (typeof original === 'object') return original.invoiceNumber || original._id || ''
        return String(original)
      },
    },
    { key: 'taxExclusive', header: isAr ? 'بدون ضريبة' : 'Tax excl.', accessor: (row) => Math.abs(Number(row.totalExcludingVat || 0)) },
    { key: 'grandTotal', header: isAr ? 'الإجمالي' : 'Total', accessor: (row) => Math.abs(Number(row.grandTotal || 0)) },
    { key: 'status', header: isAr ? 'الحالة' : 'Status', accessor: (row) => documentStatusLabel(row.status, language) },
  ]), [isAr, language])

  const reversedBillLabel = (row) => {
    const original = row.originalInvoiceId
    if (!original) return null
    if (typeof original === 'object') {
      return {
        id: original._id,
        label: original.invoiceNumber || String(original._id || '').slice(-8),
      }
    }
    return { id: original, label: String(original).slice(-8) }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {isAr ? 'الموردون' : 'Vendors'}
        </p>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isAr ? 'مرتجعات الموردين' : 'Vendor refunds'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isAr
            ? 'ملاحظات دائن الموردين لخفض الذمم الدائنة المفتوحة.'
            : 'Supplier credit notes that reverse or reduce open AP.'}
        </p>
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث…' : 'Search…'}
            className={`${fieldControlClass} !py-2 ps-10`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterControlClass}>
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
          <option value="issued">{isAr ? 'مرحّلة' : 'Posted'}</option>
          <option value="cancelled">{isAr ? 'ملغاة' : 'Cancelled'}</option>
        </select>
        <ExportMenu
          columns={exportColumns}
          filename="vendor-refunds"
          getRows={() => Promise.resolve(rows)}
          label={isAr ? 'تصدير' : 'Export'}
        />
      </div>

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا توجد مرتجعات' : 'No vendor refunds yet'}</p>}
            renderCard={(row) => {
              const reversed = reversedBillLabel(row)
              return (
                <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                  <Link to={`/app/dashboard/accounting/invoices/${row._id}`} className={`${docLinkClass} text-base`}>
                    {row.invoiceNumber}
                  </Link>
                  <p className="text-sm text-slate-500">{trimName(row.seller)}</p>
                  {reversed ? (
                    <Link to={`/app/dashboard/accounting/invoices/${reversed.id}`} className={`${docLinkClass} text-xs`}>
                      {isAr ? 'عكس:' : 'Reversed:'} {reversed.label}
                    </Link>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <Money value={Math.abs(Number(row.grandTotal || 0))} />
                    <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                  </div>
                </div>
              )
            }}
          >
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={salesThClass}>{isAr ? 'الرقم' : 'Number'}</th>
                  <th className={salesThClass}>{isAr ? 'المورد' : 'Vendor'}</th>
                  <th className={salesThClass}>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className={salesThClass}>{isAr ? 'الفاتورة الأصلية' : 'Reversed bill'}</th>
                  <th className={`${salesThClass} text-end`}>{isAr ? 'بدون ضريبة' : 'Tax excl.'}</th>
                  <th className={`${salesThClass} text-end`}>{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                  <th className={salesThClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const reversed = reversedBillLabel(row)
                  return (
                    <tr
                      key={row._id}
                      className={`${salesTrClass} cursor-pointer`}
                      onClick={() => navigate(`/app/dashboard/accounting/invoices/${row._id}`)}
                    >
                      <td className={salesTdClass}>
                        <Link
                          to={`/app/dashboard/accounting/invoices/${row._id}`}
                          className={docLinkClass}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className={salesTdClass}>{trimName(row.seller)}</td>
                      <td className={salesTdClass}>
                        {row.issueDate ? new Date(row.issueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB') : '—'}
                      </td>
                      <td className={salesTdClass}>
                        {reversed ? (
                          <Link
                            to={`/app/dashboard/accounting/invoices/${reversed.id}`}
                            className={docLinkClass}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {reversed.label}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className={`${salesTdClass} text-end tabular-nums`}>
                        <Money value={Math.abs(Number(row.totalExcludingVat || 0))} />
                      </td>
                      <td className={`${salesTdClass} text-end tabular-nums`}>
                        <Money value={Math.abs(Number(row.grandTotal || 0))} />
                      </td>
                      <td className={salesTdClass}>
                        <span className={softChipClass}>{documentStatusLabel(row.status, language)}</span>
                      </td>
                      <td className={salesTdClass}>
                        <div className={rowActionsWrapClass}>
                          <Link
                            to={`/app/dashboard/accounting/invoices/${row._id}`}
                            className={rowActionBtnClass}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ResponsiveDataList>
        )}
      </div>
    </div>
  )
}
