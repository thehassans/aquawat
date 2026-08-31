import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ShieldCheck, AlertTriangle } from 'lucide-react'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import { contactToCustomer, fetchContactsList } from '../../../lib/contactMappers'
import {
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  filterControlClass,
  listShellClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  softChipClass,
} from '../../sales/salesUi'

/**
 * Accounting-scoped customer directory (is_customer partners) with live AR metrics.
 */
export default function AccountingCustomersPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-customers-directory', search],
    queryFn: async () => {
      const { contacts } = await fetchContactsList(api, {
        types: 'customer',
        page: 1,
        limit: 100,
        isActive: 'all',
        search: search.trim() || undefined,
      })
      return contacts.filter((c) => c.entityType === 'customer').map(contactToCustomer)
    },
  })

  const { data: arSummary } = useQuery({
    queryKey: ['accounting-customer-summary-live'],
    queryFn: () => api.get('/accounting/reports/customer-summary').then((r) => r.data).catch(() => ({ rows: [] })),
  })

  const balanceById = useMemo(() => {
    const map = new Map()
    for (const row of arSummary?.rows || []) {
      if (row.partnerId || row.customerId) {
        map.set(String(row.partnerId || row.customerId), Number(row.outstanding || row.balance || 0))
      }
    }
    return map
  }, [arSummary])

  const rows = data || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {isAr ? 'العملاء' : 'Customers'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isAr ? 'دليل العملاء' : 'Customer directory'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr ? 'شركاء العملاء مع أرصدة الذمم المدينة وحد الائتمان' : 'Customer partners with receivables, credit limit, and ZATCA status'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/app/dashboard/customers/new')}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'عميل جديد' : 'New customer'}
        </button>
      </div>

      <div className={filterBarClass}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم / الضريبة…' : 'Search name / VAT…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
      </div>

      <div className={listShellClass}>
        {isLoading ? (
          <p className={emptyStateClass}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : (
          <ResponsiveDataList
            items={rows}
            empty={<p className={emptyStateClass}>{isAr ? 'لا يوجد عملاء' : 'No customers yet'}</p>}
            renderCard={(row) => {
              const owed = balanceById.get(String(row._id)) || Number(row.outstandingBalance || 0)
              const limit = Number(row.creditLimit || 0)
              const over = limit > 0 && owed > limit
              return (
                <div key={row._id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800">
                  <Link to={`/app/dashboard/customers/${row._id}`} className="text-base font-semibold text-emerald-700">
                    {row.name || row.nameEn || '—'}
                  </Link>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={softChipClass}><Money value={owed} /></span>
                    {row.vatNumber ? (
                      <span className={`${softChipClass} !text-emerald-700`}>
                        <ShieldCheck className="h-3 w-3" /> VAT
                      </span>
                    ) : null}
                    {over ? (
                      <span className={`${softChipClass} !border-rose-200 !text-rose-700`}>
                        <AlertTriangle className="h-3 w-3" /> {isAr ? 'تجاوز الحد' : 'Over limit'}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            }}
          >
            <table className={salesTableClass}>
              <thead>
                <tr>
                  <th className={salesThClass}>{isAr ? 'العميل' : 'Customer'}</th>
                  <th className={salesThClass}>{isAr ? 'الذمم المدينة' : 'Receivables'}</th>
                  <th className={salesThClass}>{isAr ? 'حد الائتمان' : 'Credit limit'}</th>
                  <th className={salesThClass}>{isAr ? 'شروط الدفع' : 'Payment terms'}</th>
                  <th className={salesThClass}>{isAr ? 'حالة زاتكا' : 'ZATCA'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const owed = balanceById.get(String(row._id)) || Number(row.outstandingBalance || 0)
                  const limit = Number(row.creditLimit || 0)
                  const over = limit > 0 && owed > limit
                  return (
                    <tr key={row._id} className={salesTrClass}>
                      <td className={salesTdClass}>
                        <Link to={`/app/dashboard/customers/${row._id}`} className="font-semibold text-emerald-700 hover:underline">
                          {row.name || row.nameEn || '—'}
                        </Link>
                        {row.nameAr && row.nameAr !== row.name ? (
                          <p className="text-xs text-slate-400">{row.nameAr}</p>
                        ) : null}
                      </td>
                      <td className={salesTdClass}><Money value={owed} /></td>
                      <td className={salesTdClass}>
                        {limit > 0 ? <Money value={limit} /> : '—'}
                        {over ? (
                          <span className="ms-2 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                            <AlertTriangle className="h-3 w-3" />
                            {isAr ? 'تجاوز' : 'Exceeded'}
                          </span>
                        ) : null}
                      </td>
                      <td className={salesTdClass}>{row.paymentTerms || row.defaultPaymentTerms || '—'}</td>
                      <td className={salesTdClass}>
                        {row.vatNumber ? (
                          <span className={`${softChipClass} !text-emerald-700`}>
                            <ShieldCheck className="h-3 w-3" />
                            {row.vatNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">{isAr ? 'غير موثّق' : 'Unverified'}</span>
                        )}
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
