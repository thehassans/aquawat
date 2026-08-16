import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, PackageCheck, Clock3, Anchor } from 'lucide-react'
import api from '../../lib/api'
import Money from '../../components/ui/Money'
import {
  PURCHASES_PATH,
  shell,
  primaryBtn,
  ghostBtn,
  fieldControlClass,
  STATUS_PILL,
  statusLabel,
  partyName,
  warehouseName,
  formatDay,
} from './purchasesUi'

const FILTERS = ['upcoming', '', 'draft', 'received', 'completed', 'delayed', 'cancelled']

export default function GrnList() {
  const { language } = useSelector((state) => state.ui)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('upcoming')

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 280)
    return () => clearTimeout(h)
  }, [search])

  const upcomingQuery = useQuery({
    queryKey: ['grn-upcoming', debounced],
    queryFn: () => api.get('/grn/upcoming', { params: { search: debounced } }).then((res) => res.data),
    enabled: status === 'upcoming' || status === 'delayed',
  })

  const listQuery = useQuery({
    queryKey: ['grn-list', debounced, status],
    queryFn: () => api.get('/grn', {
      params: {
        search: debounced,
        status: status && !['upcoming', 'delayed'].includes(status) ? status : undefined,
      },
    }).then((res) => res.data),
    enabled: status !== 'upcoming',
  })

  const upcomingItems = useMemo(() => {
    const items = Array.isArray(upcomingQuery.data?.items) ? upcomingQuery.data.items : []
    if (status === 'delayed') return items.filter((row) => row.delayed || row.kind === 'delayed')
    return items
  }, [upcomingQuery.data, status])

  const grnRows = useMemo(() => {
    const rows = Array.isArray(listQuery.data) ? listQuery.data : []
    if (status === 'delayed') {
      return rows.filter((grn) => (grn.lines || []).some((line) => line.isDelayed))
    }
    return rows
  }, [listQuery.data, status])

  const isUpcomingView = status === 'upcoming' || status === 'delayed'
  const isLoading = isUpcomingView ? upcomingQuery.isLoading : listQuery.isLoading
  const showUpcoming = status === 'upcoming'
  const rows = showUpcoming || status === 'delayed' ? upcomingItems : grnRows

  const filterLabel = (value) => {
    if (value === 'upcoming') return language === 'ar' ? 'القادمة' : 'Upcoming'
    if (value === '') return language === 'ar' ? 'كل الإشعارات' : 'All GRNs'
    if (value === 'delayed') return language === 'ar' ? 'متأخرة' : 'Delayed'
    return statusLabel(value, language)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
            {language === 'ar' ? 'المشتريات' : 'Purchases'}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[30px]">
            {language === 'ar' ? 'إشعار استلام البضائع' : 'Goods receipt notes'}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'استلم من طلب الشراء، حدّث المخزون في المستودع، وسجّل التأخير على البنود.'
              : 'Receive from a purchase order, post warehouse stock, and flag delayed lines.'}
          </p>
        </div>
        <Link to={`${PURCHASES_PATH.grn}/new`} className={primaryBtn}>
          <Plus className="h-4 w-4 opacity-80" />
          {language === 'ar' ? 'إشعار استلام جديد' : 'New GRN'}
        </Link>
      </div>

      <div className={`${shell} p-4`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((value) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition ${
                  status === value
                    ? 'bg-teal-700 text-white ring-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:ring-teal-500'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300 dark:ring-white/10'
                }`}
              >
                {filterLabel(value)}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${fieldControlClass} ps-9`}
              placeholder={language === 'ar' ? 'بحث برقم الإشعار أو الطلب…' : 'Search GRN or PO number…'}
            />
          </div>
        </div>
      </div>

      <div className={shell}>
        {isLoading ? (
          <div className="flex justify-center p-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
              <PackageCheck className="h-7 w-7" />
            </div>
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {showUpcoming
                ? (language === 'ar' ? 'لا توجد استلامات قادمة' : 'No upcoming receipts')
                : (language === 'ar' ? 'لا توجد إشعارات استلام' : 'No goods receipts yet')}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              {language === 'ar' ? 'ابدأ باستلام طلب شراء معتمد.' : 'Start by receiving an approved purchase order.'}
            </p>
            <Link to={`${PURCHASES_PATH.grn}/new`} className={`${primaryBtn} mt-5`}>
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'إشعار استلام جديد' : 'New GRN'}
            </Link>
          </div>
        ) : showUpcoming || status === 'delayed' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-white/10">
                <tr>
                  <th className="px-5 py-3">{language === 'ar' ? 'المصدر' : 'Source'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المورد' : 'Vendor'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المتوقع' : 'Expected'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = row.kind === 'delayed' || row.grnId
                    ? `${PURCHASES_PATH.grn}/${row.grnId || row._id}`
                    : `${PURCHASES_PATH.grn}/new?poId=${row.purchaseOrderId || row._id}`
                  return (
                    <tr
                      key={`${row.kind}-${row._id}`}
                      onClick={() => navigate(href)}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-mono text-[13px] font-semibold text-slate-900 dark:text-white">
                          {row.grnNumber || row.poNumber}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {row.kind === 'delayed'
                            ? (language === 'ar' ? 'بنود متأخرة' : 'Delayed lines')
                            : (language === 'ar' ? 'بانتظار الاستلام' : 'Awaiting receipt')}
                          {row.poNumber && row.grnNumber ? ` · ${row.poNumber}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200">{partyName(row.supplierId, language)}</td>
                      <td className="px-5 py-4 text-slate-600">{warehouseName(row.warehouseId, language)}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDay(row.expectedDate, language)}</td>
                      <td className="px-5 py-4">
                        <p className="tabular-nums text-slate-900 dark:text-white">{row.remainingQty}</p>
                        <p className="text-[11px] text-slate-400"><Money value={row.remainingValue || 0} /></p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL[row.status] || STATUS_PILL.draft}`}>
                          {row.delayed ? (language === 'ar' ? 'متأخر' : 'Delayed') : statusLabel(row.status, language)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-end" onClick={(e) => e.stopPropagation()}>
                        <Link to={href} className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}>
                          {row.kind === 'delayed'
                            ? (language === 'ar' ? 'فتح' : 'Open')
                            : (language === 'ar' ? 'استلام' : 'Receive')}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-white/10">
                <tr>
                  <th className="px-5 py-3">{language === 'ar' ? 'الإشعار' : 'GRN'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المورد' : 'Vendor'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'طلب الشراء' : 'PO'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'التكلفة المرسية' : 'Landed cost'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {grnRows.map((grn) => {
                  const landed = (grn.landedCosts || [])[0]
                  return (
                    <tr
                      key={grn._id}
                      onClick={() => navigate(`${PURCHASES_PATH.grn}/${grn._id}`)}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{grn.grnNumber}</td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200">{partyName(grn.supplierId, language)}</td>
                      <td className="px-5 py-4 font-mono text-[12px] text-slate-500">{grn.purchaseOrderId?.poNumber || '—'}</td>
                      <td className="px-5 py-4 text-slate-600">{warehouseName(grn.warehouseId, language)}</td>
                      <td className="px-5 py-4 text-[12px] text-slate-600">
                        {landed ? (
                          <span className="inline-flex items-center gap-1">
                            <Anchor className="h-3.5 w-3.5 text-teal-700" />
                            {landed.lcNumber}
                            <span className="tabular-nums text-slate-900 dark:text-white"><Money value={landed.totalCost || 0} /></span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{formatDay(grn.dateReceived || grn.createdAt, language)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL[grn.status] || STATUS_PILL.draft}`}>
                          {(grn.lines || []).some((line) => line.isDelayed) ? (
                            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{language === 'ar' ? 'متأخر' : 'Delayed'}</span>
                          ) : statusLabel(grn.status, language)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
