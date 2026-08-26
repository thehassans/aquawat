import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import api from '../../lib/api'
import { StatusChip } from './inventoryUi'
import EmptyState from '../../components/ui/EmptyState'

function codeFromPath(pathname) {
  if (pathname.includes('/receipts')) return 'incoming'
  if (pathname.includes('/deliveries')) return 'outgoing'
  if (pathname.includes('/pos')) return 'pos'
  if (pathname.includes('/manufacturing')) return 'manufacturing'
  return 'internal'
}

export default function TransfersList() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const code = codeFromPath(location.pathname)
  const state = searchParams.get('state') || ''
  const [q, setQ] = useState('')

  const title = {
    incoming: ar ? 'الاستلامات' : 'Receipts',
    outgoing: ar ? 'أوامر التسليم' : 'Delivery Orders',
    internal: ar ? 'تحويلات داخلية' : 'Internal Transfers',
    pos: ar ? 'طلبات نقطة البيع' : 'PoS Orders',
    manufacturing: ar ? 'التصنيع' : 'Manufacturing',
  }[code]

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers', code, state],
    queryFn: () =>
      api.get('/stock/transfers', { params: { code, state: state || undefined, limit: 80 } }).then((r) => r.data),
  })

  const rows = useMemo(() => {
    const list = data?.data || []
    if (!q.trim()) return list
    const needle = q.toLowerCase()
    return list.filter((t) => {
      const partnerName = [t.partner?.name, t.partner?.nameEn, t.partner?.nameAr]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (
        t.name?.toLowerCase().includes(needle) ||
        t.origin?.toLowerCase().includes(needle) ||
        partnerName.includes(needle)
      )
    })
  }, [data, q])

  const meta = data?._meta
  const applied = meta?.appliedFilters || {}
  const clearFilters = () => {
    setSearchParams({})
    setQ('')
  }

  const showPartner = code === 'outgoing' || code === 'incoming'
  const partnerCol = code === 'outgoing'
    ? (ar ? 'العميل' : 'Customer')
    : (ar ? 'المورد / الشريك' : 'Partner')

  const basePath = `/app/dashboard/inventory/${
    code === 'incoming' ? 'receipts'
      : code === 'outgoing' ? 'deliveries'
        : code === 'pos' ? 'pos'
          : code === 'manufacturing' ? 'manufacturing'
            : 'internal'
  }`

  const colSpan = showPartner ? 5 : 4

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <Link to={`${basePath}/new`} className="btn btn-primary text-sm">
          <Plus className="h-4 w-4" />
          {ar ? 'جديد' : 'New'}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث…' : 'Search…'}
          />
        </div>
        <select
          className="select"
          value={state}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('state', e.target.value)
            else next.delete('state')
            setSearchParams(next)
          }}
        >
          <option value="">{ar ? 'كل الحالات' : 'All states'}</option>
          {['draft', 'waiting', 'confirmed', 'assigned', 'done', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(state || q) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            {ar ? 'مسح التصفية' : 'Clear filters'}
          </button>
        )}
      </div>

      {meta && (
        <p className="text-xs text-slate-400">
          {meta.total ?? 0} {ar ? 'سجل' : 'record(s)'}
          {applied.state ? ` · state=${applied.state}` : ''}
          {applied.code ? ` · code=${applied.code}` : ''}
          {applied.emptyOperationTypeMatch
            ? (ar ? ' · لا أنواع عمليات مطابقة' : ' · no matching operation types')
            : ''}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-start text-xs uppercase tracking-wide text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">{ar ? 'المرجع' : 'Reference'}</th>
              {showPartner && <th className="px-4 py-3 font-medium">{partnerCol}</th>}
              <th className="px-4 py-3 font-medium">{ar ? 'المصدر' : 'Origin'}</th>
              <th className="px-4 py-3 font-medium">{ar ? 'الموعد' : 'Scheduled'}</th>
              <th className="px-4 py-3 font-medium">{ar ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">…</td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="p-8">
                  <EmptyState
                    title={ar ? 'لا توجد تحويلات' : 'No transfers'}
                    description={
                      applied.emptyOperationTypeMatch
                        ? (ar
                          ? 'لا توجد أنواع عمليات لهذا المستودع/الكود — شغّل التهيئة من الإعدادات'
                          : 'No operation types for this warehouse/code — run bootstrap from Settings')
                        : state
                          ? (ar
                            ? `لا نتائج للتصفية الحالية (state=${state}). جرّب «كل الحالات» أو مسح التصفية.`
                            : `No rows for current filters (state=${state}). Try “All states” or Clear filters.`)
                          : (ar ? 'أنشئ مستنداً جديداً للبدء' : 'Create a document to get started')
                    }
                  />
                  {(state || applied.emptyOperationTypeMatch) && (
                    <div className="mt-3 flex justify-center">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                        {ar ? 'مسح التصفية' : 'Clear filters'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const partnerLabel = t.partner
                ? (ar && t.partner.nameAr ? t.partner.nameAr : (t.partner.name || t.partner.nameEn))
                : '—'
              return (
                <tr key={t._id} className="border-b border-slate-50 transition hover:bg-slate-50/80 dark:border-dark-700 dark:hover:bg-dark-700/40">
                  <td className="px-4 py-3">
                    <Link to={`${basePath}/${t._id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                      {t.name}
                    </Link>
                  </td>
                  {showPartner && (
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{partnerLabel}</td>
                  )}
                  <td className="px-4 py-3 text-slate-500">{t.origin || '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={t.state} language={language} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
