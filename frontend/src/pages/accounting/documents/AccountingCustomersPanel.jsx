import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ShieldCheck, AlertTriangle, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import api from '../../../lib/api'
import Money from '../../../components/ui/Money'
import ResponsiveDataList from '../../../components/ui/ResponsiveDataList'
import EmptyState from '../../../components/ui/EmptyState'
import { useAccountingQuery } from '../../../hooks/useAccountingQuery'
import AccountingQueryState from '../AccountingQueryState'
import {
  emptyStateClass,
  fieldControlClass,
  filterBarClass,
  listShellClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  softChipClass,
} from '../../sales/salesUi'

/**
 * Accounting customer directory — live AR from shared balances, filters, pagination.
 */
export default function AccountingCustomersPanel({ language = 'en' }) {
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('name')
  const [order, setOrder] = useState('asc')
  const [hasOpenBalance, setHasOpenBalance] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [isActive, setIsActive] = useState('all')
  const [city, setCity] = useState('')

  const { data, isLoading, isError, error, refetch } = useAccountingQuery({
    queryKey: ['accounting-customers-directory', search, page, sort, order, hasOpenBalance, overdueOnly, isActive, city],
    queryFn: () => api.get('/accounting/customers', {
      params: {
        search: search.trim() || undefined,
        page,
        limit: 50,
        sort,
        order,
        hasOpenBalance: hasOpenBalance || undefined,
        overdueOnly: overdueOnly || undefined,
        isActive,
        city: city.trim() || undefined,
      },
    }).then((r) => r.data),
  })

  const rows = data?.customers || []
  const pagination = data?.pagination || { page: 1, pages: 0, total: 0 }
  const totals = data?.totals || {}

  const toggleSort = (key) => {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setOrder(key === 'name' || key === 'nameEn' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const sortMark = (key) => (sort === key ? (order === 'asc' ? ' ↑' : ' ↓') : '')

  const cities = useMemo(() => {
    const set = new Set(rows.map((r) => r.city).filter(Boolean))
    return [...set].sort()
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/app/dashboard/customers/new?returnTo=/app/dashboard/accounting/customers')}
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'عميل جديد' : 'New customer'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [isAr ? 'العملاء' : 'Customers', totals.customerCount ?? pagination.total],
          [isAr ? 'ذمم مدينة' : 'Receivables', totals.receivablesSum, true],
          [isAr ? 'متأخر' : 'Overdue', totals.overdueSum, true],
          [isAr ? 'برصيد مفتوح' : 'With balance', totals.withOpenBalance],
        ].map(([label, value, money]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-dark-600 dark:bg-dark-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {money ? <Money value={value} /> : (value ?? '—')}
            </p>
          </div>
        ))}
      </div>

      <div className={`${filterBarClass} flex-wrap`}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={isAr ? 'بحث بالاسم / الضريبة / الهاتف…' : 'Search name / VAT / phone…'}
            className={`${fieldControlClass} ps-10`}
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={hasOpenBalance} onChange={(e) => { setHasOpenBalance(e.target.checked); setPage(1) }} />
          {isAr ? 'رصيد مفتوح' : 'Open balance'}
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1) }} />
          {isAr ? 'متأخر فقط' : 'Overdue only'}
        </label>
        <select
          value={isActive}
          onChange={(e) => { setIsActive(e.target.value); setPage(1) }}
          className={fieldControlClass}
        >
          <option value="all">{isAr ? 'الكل' : 'All statuses'}</option>
          <option value="true">{isAr ? 'نشط' : 'Active'}</option>
          <option value="false">{isAr ? 'غير نشط' : 'Inactive'}</option>
        </select>
        <input
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(1) }}
          list="acct-customer-cities"
          placeholder={isAr ? 'المدينة' : 'City'}
          className={`${fieldControlClass} max-w-[140px]`}
        />
        <datalist id="acct-customer-cities">
          {cities.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <AccountingQueryState
        language={language}
        isLoading={isLoading && !data}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeletonRows={6}
      >
        <div className={listShellClass}>
          <ResponsiveDataList
            items={rows}
            empty={(
              <EmptyState
                icon={Users}
                language={language}
                title="No customers found"
                titleAr="لا يوجد عملاء"
                description="Add a customer to track receivables, payment terms, and VAT identity."
                descriptionAr="أضف عميلاً لتتبع الذمم وشروط الدفع والرقم الضريبي."
                action={() => navigate('/app/dashboard/customers/new')}
                actionLabel="New customer"
                actionLabelAr="عميل جديد"
              />
            )}
            renderCard={(row) => (
              <Link
                key={row._id}
                to={`/app/dashboard/customers/${row._id}`}
                className="block space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-dark-800"
              >
                <p className="font-semibold text-emerald-700">{isAr ? (row.nameAr || row.nameEn) : (row.nameEn || row.name)}</p>
                {row.nameAr && !isAr ? <p className="text-xs text-slate-400">{row.nameAr}</p> : null}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={softChipClass}><Money value={row.outstanding} /></span>
                  {row.vatNumber ? (
                    <span className={`${softChipClass} !text-emerald-700`}>
                      <ShieldCheck className="h-3 w-3" /> {row.vatNumber}
                    </span>
                  ) : null}
                  {row.overdue > 0.01 ? (
                    <span className={`${softChipClass} !border-rose-200 !text-rose-700`}>
                      <AlertTriangle className="h-3 w-3" /> <Money value={row.overdue} />
                    </span>
                  ) : null}
                </div>
              </Link>
            )}
          >
            <div className="overflow-x-auto">
              <table className={`${salesTableClass} min-w-[1100px]`}>
                <thead>
                  <tr>
                    <th className={salesThClass}>
                      <button type="button" onClick={() => toggleSort('nameEn')}>{isAr ? 'العميل' : 'Customer'}{sortMark('nameEn')}</button>
                    </th>
                    <th className={salesThClass}>{isAr ? 'الرقم الضريبي' : 'VAT No'}</th>
                    <th className={salesThClass}>{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th className={salesThClass}>
                      <button type="button" onClick={() => toggleSort('outstanding')}>{isAr ? 'الذمم' : 'Receivables'}{sortMark('outstanding')}</button>
                    </th>
                    <th className={salesThClass}>
                      <button type="button" onClick={() => toggleSort('overdue')}>{isAr ? 'متأخر' : 'Overdue'}{sortMark('overdue')}</button>
                    </th>
                    <th className={salesThClass}>{isAr ? 'حد الائتمان' : 'Credit limit'}</th>
                    <th className={salesThClass}>{isAr ? 'الشروط' : 'Terms'}</th>
                    <th className={salesThClass}>{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const overLimit = row.creditLimit > 0 && row.outstanding > row.creditLimit
                    return (
                      <tr key={row._id} className={salesTrClass}>
                        <td className={salesTdClass}>
                          <Link
                            to={`/app/dashboard/customers/${row._id}`}
                            className="font-semibold text-emerald-700 hover:underline"
                          >
                            {row.nameEn || row.name || '—'}
                          </Link>
                          {row.nameAr ? <p className="text-xs text-slate-400">{row.nameAr}</p> : null}
                        </td>
                        <td className={salesTdClass}>
                          {row.vatNumber ? (
                            <span className={`inline-flex items-center gap-1 text-xs ${row.zatcaStatus === 'verified' ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {row.zatcaStatus === 'verified' ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {row.vatNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400">{isAr ? 'غير موثّق' : 'Unverified'}</span>
                          )}
                        </td>
                        <td className={salesTdClass}>{row.phone || '—'}</td>
                        <td className={salesTdClass}><Money value={row.outstanding} /></td>
                        <td className={salesTdClass}>
                          {row.overdue > 0.01 ? (
                            <span className="font-semibold text-rose-600"><Money value={row.overdue} /></span>
                          ) : (
                            <Money value={0} />
                          )}
                        </td>
                        <td className={salesTdClass}>
                          {row.creditLimit > 0 ? <Money value={row.creditLimit} /> : '—'}
                          {overLimit ? (
                            <span className="ms-1 text-[10px] font-semibold text-rose-600">
                              {isAr ? 'تجاوز' : 'Over'}
                            </span>
                          ) : null}
                        </td>
                        <td className={salesTdClass}>
                          {isAr ? (row.paymentTermsLabelAr || row.paymentTerms) : (row.paymentTermsLabel || row.paymentTerms || '—')}
                        </td>
                        <td className={salesTdClass}>
                          <span className={softChipClass}>
                            {row.isActive === false ? (isAr ? 'غير نشط' : 'Inactive') : (isAr ? 'نشط' : 'Active')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>

          {pagination.pages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm dark:border-white/10">
              <p className="text-slate-500">
                {isAr
                  ? `${pagination.total} عميل · صفحة ${pagination.page} من ${pagination.pages}`
                  : `${pagination.total} customers · page ${pagination.page} of ${pagination.pages}`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </AccountingQueryState>
    </div>
  )
}
