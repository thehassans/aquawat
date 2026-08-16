import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, FileText, Printer, Search, Users } from 'lucide-react'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'

const shell =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0c111a]'
const ghostBtn =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-white/20'
const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_12px_24px_-16px_rgba(15,118,110,0.85)] transition hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'

function customerLabel(customer, language) {
  if (!customer) return ''
  if (language === 'ar') return customer.nameAr || customer.name || customer.companyName || customer.customerCode || ''
  return customer.name || customer.nameEn || customer.nameAr || customer.companyName || customer.customerCode || ''
}

function rowDescription(row, language) {
  if (row?.type === 'opening') return language === 'ar' ? 'رصيد افتتاحي' : 'Opening balance'
  if (row?.type === 'invoice') return language === 'ar' ? 'فاتورة' : 'Invoice'
  if (row?.type === 'invoice_payment') return language === 'ar' ? `سداد فاتورة (${row.id})` : row.desc
  return row?.desc || '—'
}

function formatDate(value, language) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function CustomerStatement() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const { id: routeCustomerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialCustomer = routeCustomerId || searchParams.get('customerId') || ''
  const [customerId, setCustomerId] = useState(initialCustomer)
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (routeCustomerId) setCustomerId(routeCustomerId)
  }, [routeCustomerId])

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => api.get('/customers', { params: { limit: 500 } }).then((res) => res.data.customers || res.data || []),
  })

  const { data: statementData, isLoading } = useQuery({
    queryKey: ['customer-statement', customerId, startDate, endDate],
    queryFn: () => api.get('/reports/customer-statement', { params: { customerId, startDate, endDate } }).then((res) => res.data),
    enabled: Boolean(customerId),
  })

  const selectedCustomer = useMemo(
    () => customers.find((row) => String(row._id) === String(customerId)),
    [customers, customerId]
  )

  const rows = useMemo(() => {
    const statement = Array.isArray(statementData?.statement) ? statementData.statement : []
    const query = search.trim().toLowerCase()
    if (!query) return statement
    return statement.filter((row) => {
      const haystack = `${row.id || ''} ${row.desc || ''} ${row.type || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [statementData, search])

  const printStatement = () => window.print()

  const exportCsv = () => {
    if (!rows.length && statementData?.openingBalance == null) return
    const header = language === 'ar'
      ? ['التاريخ', 'المرجع', 'البيان', 'مدين', 'دائن', 'الرصيد']
      : ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']
    const lines = [header.join(',')]
    rows.forEach((row) => {
      lines.push([
        formatDate(row.date, 'en'),
        JSON.stringify(row.id || ''),
        JSON.stringify(row.desc || ''),
        Number(row.debit || 0),
        Number(row.credit || 0),
        Number(row.balance || 0),
      ].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customer-statement-${customerId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectCustomer = (value) => {
    setCustomerId(value)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('customerId', value)
    else next.delete('customerId')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-6 pb-16" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            {language === 'ar' ? 'العملاء' : 'Customers'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[28px]">
            {language === 'ar' ? 'كشف حساب العميل' : 'Customer statement'}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'الرصيد الافتتاحي والفواتير والمدفوعات والرصيد الجاري'
              : 'Opening balance, invoices, payments, and running balance'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={printStatement} disabled={!statementData} className={ghostBtn}>
            <Printer className="h-4 w-4 opacity-70" />
            {language === 'ar' ? 'طباعة' : 'Print'}
          </button>
          <button type="button" onClick={exportCsv} disabled={!statementData} className={primaryBtn}>
            <Download className="h-4 w-4 opacity-80" />
            {language === 'ar' ? 'تصدير' : 'Export'}
          </button>
        </div>
      </div>

      <div className={`${shell} p-5 sm:p-6 print:hidden`}>
        <div className="mb-5 border-b border-slate-100 pb-4 dark:border-white/[0.08]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {language === 'ar' ? 'التصفية' : 'Filters'}
          </p>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {language === 'ar' ? 'اختر العميل والفترة' : 'Choose a customer and date range'}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">{language === 'ar' ? 'العميل' : 'Customer'}</label>
            <select value={customerId} onChange={(e) => selectCustomer(e.target.value)} className="select">
              <option value="">{language === 'ar' ? 'اختر العميل' : 'Select customer'}</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customerLabel(customer, language)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'من تاريخ' : 'Start date'}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'إلى تاريخ' : 'End date'}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
          </div>
        </div>
      </div>

      {!customerId ? (
        <div className={`${shell} px-6 py-16 text-center`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-white/5">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-[16px] font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'اختر عميلاً لعرض الكشف' : 'Select a customer to view the statement'}
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            {language === 'ar'
              ? 'سيظهر الرصيد الافتتاحي وحركة الفواتير والمدفوعات هنا'
              : 'Opening balance, invoices, and payments will appear here'}
          </p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={shell}>
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                {language === 'ar' ? 'كشف الفترة' : 'Period statement'}
              </p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-slate-950 dark:text-white">
                {customerLabel(selectedCustomer, language) || t('customer')}
              </h2>
              <p className="mt-1 text-[13px] text-slate-500">
                {startDate} — {endDate}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {language === 'ar' ? 'افتتاحي' : 'Opening'}
                </p>
                <p className="mt-1 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">
                  <Money value={statementData?.openingBalance || 0} />
                </p>
              </div>
              <div className="rounded-xl bg-teal-50 px-4 py-3 dark:bg-teal-500/10">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-teal-700/70 dark:text-teal-300/80">
                  {language === 'ar' ? 'الرصيد' : 'Balance'}
                </p>
                <p className="mt-1 text-[14px] font-semibold tabular-nums text-teal-900 dark:text-teal-100">
                  <Money value={statementData?.totalBalance || 0} />
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 py-3 print:hidden dark:border-white/[0.08]">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input ps-10"
                placeholder={language === 'ar' ? 'بحث في الحركات' : 'Search transactions'}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/[0.08]">
                  <th className="px-5 py-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المرجع' : 'Reference'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'البيان' : 'Description'}</th>
                  <th className="px-5 py-3 text-right">{language === 'ar' ? 'مدين' : 'Debit'}</th>
                  <th className="px-5 py-3 text-right">{language === 'ar' ? 'دائن' : 'Credit'}</th>
                  <th className="px-5 py-3 text-right">{language === 'ar' ? 'الرصيد' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-16 text-center">
                      <FileText className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-[14px] font-medium text-slate-700 dark:text-slate-200">
                        {language === 'ar' ? 'لا توجد حركات في هذه الفترة' : 'No transactions in this period'}
                      </p>
                      <p className="mt-1 text-[13px] text-slate-500">
                        {language === 'ar' ? 'جرّب توسيع نطاق التاريخ أو عميل آخر' : 'Try a wider date range or another customer'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.id}-${index}`} className={row.type === 'opening' ? 'bg-slate-50/80 dark:bg-white/[0.03]' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]'}>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{formatDate(row.date, language)}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{row.id || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-500">{rowDescription(row, language)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-rose-600">
                        {row.debit > 0 ? <Money value={row.debit} /> : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-emerald-600">
                        {row.credit > 0 ? <Money value={row.credit} /> : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr">
                        <Money value={row.balance} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {statementData && (
            <div className="flex justify-end border-t border-slate-100 px-5 py-4 dark:border-white/[0.08]">
              <div className="flex w-full max-w-xs justify-between text-[14px] font-semibold">
                <span>{language === 'ar' ? 'الرصيد النهائي' : 'Ending balance'}</span>
                <span dir="ltr"><Money value={statementData.totalBalance} /></span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {customerId && (
        <div className="print:hidden">
          <Link to={`/app/dashboard/customers/${customerId}`} className="text-[13px] font-medium text-teal-700 hover:underline dark:text-teal-300">
            {language === 'ar' ? 'فتح بطاقة العميل' : 'Open customer card'}
          </Link>
        </div>
      )}
    </div>
  )
}
