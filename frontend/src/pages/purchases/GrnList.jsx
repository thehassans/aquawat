import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { Search, PackageCheck, Clock3, Anchor } from 'lucide-react'
import api from '../../lib/api'
import { normalizeGrnList } from '../../lib/grnApi'
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
  isFutureDate,
  earliestDelayedUntil,
} from './purchasesUi'

const FILTERS = [
  { id: 'grns', kind: 'grn', status: '' },
  { id: 'upcoming_po', kind: 'po', bucket: 'upcoming' },
  { id: 'delayed_po', kind: 'po', bucket: 'delayed' },
  { id: 'partially_received_po', kind: 'po', bucket: 'partially_received' },
  { id: 'draft', kind: 'grn', status: 'draft' },
  { id: 'received', kind: 'grn', status: 'received' },
  { id: 'completed', kind: 'grn', status: 'completed' },
  { id: 'cancelled', kind: 'grn', status: 'cancelled' },
]

export default function GrnList() {
  const { language } = useSelector((state) => state.ui)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filterId, setFilterId] = useState('grns')
  const activeFilter = FILTERS.find((row) => row.id === filterId) || FILTERS[0]

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 280)
    return () => clearTimeout(h)
  }, [search])

  const upcomingQuery = useQuery({
    queryKey: ['grn-upcoming', debounced],
    queryFn: () => api.get('/grn/upcoming', { params: { search: debounced } }).then((res) => res.data),
    enabled: activeFilter.kind === 'po',
  })

  const listQuery = useQuery({
    queryKey: ['grn-list', debounced, activeFilter.status],
    queryFn: () => api.get('/grn', {
      params: {
        search: debounced,
        status: activeFilter.status || undefined,
      },
    }).then((res) => normalizeGrnList(res.data)),
    enabled: activeFilter.kind === 'grn',
  })

  const poRows = useMemo(() => {
    const items = Array.isArray(upcomingQuery.data?.items) ? upcomingQuery.data.items : []
    if (activeFilter.bucket === 'delayed') return items.filter((row) => row.delayed || row.kind === 'delayed')
    if (activeFilter.bucket === 'partially_received') {
      return items.filter((row) => row.kind === 'po' && row.status === 'partially_received')
    }
    return items.filter((row) => row.kind === 'po')
  }, [upcomingQuery.data, activeFilter.bucket])

  const grnRows = normalizeGrnList(listQuery.data)
  const isPoView = activeFilter.kind === 'po'
  const isLoading = isPoView ? upcomingQuery.isLoading : listQuery.isLoading
  const rows = isPoView ? poRows : grnRows

  const filterLabel = (row) => {
    if (row.id === 'grns') return language === 'ar' ? 'كل الإشعارات' : 'All GRNs'
    if (row.id === 'upcoming_po') return language === 'ar' ? 'طلبات قادمة' : 'Upcoming POs'
    if (row.id === 'delayed_po') return language === 'ar' ? 'طلبات متأخرة' : 'Delayed POs'
    if (row.id === 'partially_received_po') return language === 'ar' ? 'مستلمة جزئياً' : 'Partially received POs'
    return statusLabel(row.status, language)
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
              ? 'استلم فقط من طلب الشراء المعتمد — لا إنشاء إشعار استلام مستقل.'
              : 'Receive only from an approved purchase order — no standalone GRN create.'}
          </p>
        </div>
      </div>

      <div className={`${shell} p-4`}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setFilterId(row.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition ${
                  filterId === row.id
                    ? 'bg-teal-700 text-white ring-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:ring-teal-500'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300 dark:ring-white/10'
                }`}
              >
                {filterLabel(row)}
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
              {isPoView
                ? (language === 'ar' ? 'لا توجد طلبات في هذا التصفية' : 'No purchase orders in this filter')
                : (language === 'ar' ? 'لا توجد إشعارات استلام' : 'No goods receipts yet')}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              {language === 'ar' ? 'افتح طلب شراء معتمد واستلم البضاعة منه.' : 'Open an approved purchase order and receive goods from it.'}
            </p>
            <Link to={PURCHASES_PATH.orders} className={`${primaryBtn} mt-5`}>
              <PackageCheck className="h-4 w-4" />
              {language === 'ar' ? 'طلبات الشراء' : 'Purchase orders'}
            </Link>
          </div>
        ) : isPoView && activeFilter.bucket === 'delayed' ? (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {rows.map((row) => {
              const href = `${PURCHASES_PATH.grn}/${row.grnId || row._id}`
              const delayLines = Array.isArray(row.delayLines) ? row.delayLines : []
              return (
                <div key={`${row.kind}-${row._id}`} className="px-5 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-[13px] font-semibold text-slate-900 dark:text-white">
                          {row.grnNumber || row.poNumber}
                        </p>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_PILL.delayed}`}>
                          {language === 'ar' ? 'متأخر' : 'Delayed'}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {row.poNumber ? `${row.poNumber} · ` : ''}
                        {partyName(row.supplierId, language)}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {warehouseName(row.warehouseId, language)}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {language === 'ar' ? 'متبقي' : 'Remaining'} {row.remainingQty}
                      </p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {row.purchaseOrderId ? (
                        <Link
                          to={`${PURCHASES_PATH.orders}/${row.purchaseOrderId}`}
                          className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}
                        >
                          {language === 'ar' ? 'الطلب' : 'PO'}
                        </Link>
                      ) : null}
                      <Link to={href} className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}>
                        {language === 'ar' ? 'فتح' : 'Open'}
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {delayLines.length === 0 ? (
                      <p className="text-[13px] text-slate-400">
                        {language === 'ar' ? 'لا توجد تفاصيل تأخير' : 'No delay details'}
                      </p>
                    ) : delayLines.map((line, index) => (
                      <div
                        key={`${row._id}-${index}`}
                        className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-3.5 py-3 dark:border-amber-500/20 dark:bg-amber-500/[0.06]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-medium text-slate-900 dark:text-white">
                              {line.productName || (language === 'ar' ? 'بند' : 'Line')}
                            </p>
                            <p className="mt-0.5 text-[12px] tabular-nums text-slate-500">
                              {language === 'ar' ? 'الكمية' : 'Qty'} {line.quantityOrdered}
                              <span className="mx-2 text-slate-300">·</span>
                              {language === 'ar' ? 'حتى' : 'Until'} {formatDay(line.delayedUntil, language)}
                            </p>
                          </div>
                          <Money value={Number(line.quantityOrdered || 0) * Number(line.costPrice || 0)} />
                        </div>
                        {line.delayReason ? (
                          <p className="mt-2 text-[13px] text-slate-700 dark:text-slate-200">
                            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                              {language === 'ar' ? 'السبب' : 'Reason'}
                            </span>
                            <span className="ms-2">{line.delayReason}</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-[12px] text-slate-400">
                            {language === 'ar' ? 'بدون سبب مسجّل' : 'No reason recorded'}
                          </p>
                        )}
                        {line.notes ? (
                          <p className="mt-1 text-[13px] leading-6 text-slate-600 dark:text-slate-300">{line.notes}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : isPoView ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-white/10">
                <tr>
                  <th className="px-5 py-3">{language === 'ar' ? 'المصدر' : 'Source'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المورد' : 'Vendor'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المتوقع' : 'Expected'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'المتأخر حتى' : 'Delayed until'}</th>
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
                      <td className="px-5 py-4 text-slate-500">{formatDay(earliestDelayedUntil(row.delayLines), language)}</td>
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
                        <Link
                          to={isFutureDate(row.expectedDate) ? `${href}${href.includes('?') ? '&' : '?'}early=1` : href}
                          className={ghostBtn.replace('px-3.5 py-2.5', 'px-3 py-1.5 text-[12px]')}
                        >
                          {row.kind === 'delayed'
                            ? (language === 'ar' ? 'فتح' : 'Open')
                            : isFutureDate(row.expectedDate)
                              ? (language === 'ar' ? 'استلام مبكر' : 'Receive early')
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
                  <th className="px-5 py-3">{language === 'ar' ? 'المتوقع' : 'Estimated'}</th>
                  <th className="px-5 py-3">{language === 'ar' ? 'التأخير' : 'Delayed until'}</th>
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
                      <td className="px-5 py-4 text-slate-500">{formatDay(grn.expectedDate || grn.purchaseOrderId?.expectedDate, language)}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDay(earliestDelayedUntil(grn.lines), language)}</td>
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
