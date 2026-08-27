import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import api from '../../lib/api'
import { InventoryIeButtons } from '../../components/inventory/ImportExportDialog'
import { StatusChip, invTableWrapClass, invTableClass, invThClass, invTdClass } from './inventoryUi'
import EmptyState from '../../components/ui/EmptyState'
import InvListShell from './InvListShell'
import { ColumnChooser, useColumnVisibility } from './columnVisibility'
import { formatLocationLabel } from './receipts/locationLabel'

const PAGE_SIZE = 40

function codeFromPath(pathname) {
  if (pathname.includes('/receipts')) return 'incoming'
  if (pathname.includes('/deliveries')) return 'outgoing'
  if (pathname.includes('/pos')) return 'pos'
  if (pathname.includes('/manufacturing')) return 'manufacturing'
  return 'internal'
}

function buildColumnDefs(code, ar) {
  const partnerLabelEn = code === 'incoming' ? 'Vendor' : 'Customer'
  const partnerLabelAr = code === 'incoming' ? 'المورد' : 'العميل'
  const showPartnerBase = code === 'incoming' || code === 'outgoing' || code === 'pos'

  return [
    { id: 'reference', labelEn: 'Reference', labelAr: 'المرجع', locked: true, defaultVisible: true },
    ...(showPartnerBase
      ? [{ id: 'partner', labelEn: partnerLabelEn, labelAr: partnerLabelAr, locked: false, defaultVisible: true }]
      : []),
    { id: 'origin', labelEn: 'Origin', labelAr: 'المصدر', locked: false, defaultVisible: true },
    { id: 'scheduled', labelEn: 'Scheduled', labelAr: 'الموعد', locked: false, defaultVisible: true },
    { id: 'status', labelEn: 'Status', labelAr: 'الحالة', locked: true, defaultVisible: true },
    { id: 'sourceLocation', labelEn: 'From', labelAr: 'من', locked: false, defaultVisible: code === 'internal' },
    { id: 'destLocation', labelEn: 'To', labelAr: 'إلى', locked: false, defaultVisible: code === 'internal' },
    { id: 'warehouse', labelEn: 'Warehouse Responsible', labelAr: 'المستودع المسؤول', locked: false, defaultVisible: false },
    { id: 'priority', labelEn: 'Priority', labelAr: 'الأولوية', locked: false, defaultVisible: false },
    { id: 'createdAt', labelEn: 'Created', labelAr: 'تاريخ الإنشاء', locked: false, defaultVisible: false },
  ]
}

function cellValue(colId, t, { ar }) {
  switch (colId) {
    case 'partner': {
      if (!t.partner) return '—'
      return ar && t.partner.nameAr ? t.partner.nameAr : (t.partner.name || t.partner.nameEn || '—')
    }
    case 'origin':
      return t.origin || '—'
    case 'scheduled':
      return t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString() : '—'
    case 'sourceLocation':
      return formatLocationLabel(t.sourceLocationId?.completePath, t.sourceLocationId?.name || '—')
    case 'destLocation':
      return formatLocationLabel(t.destLocationId?.completePath, t.destLocationId?.name || '—')
    case 'warehouse': {
      const wh = t.operationTypeId?.warehouseId
      if (!wh) return '—'
      if (typeof wh === 'object') {
        const code = wh.code || ''
        const name = ar && wh.nameAr ? wh.nameAr : (wh.nameEn || wh.name || '')
        return [code, name].filter(Boolean).join(' · ') || '—'
      }
      return '—'
    }
    case 'priority':
      return t.priority === 'urgent'
        ? (ar ? 'عاجل' : 'Urgent')
        : (ar ? 'عادي' : 'Normal')
    case 'createdAt':
      return t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'
    default:
      return '—'
  }
}

export default function TransfersList() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const code = codeFromPath(location.pathname)
  const state = searchParams.get('state') || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [q, setQ] = useState('')

  const title = {
    incoming: ar ? 'الاستلامات' : 'Receipts',
    outgoing: ar ? 'أوامر التسليم' : 'Delivery Orders',
    internal: ar ? 'تحويلات داخلية' : 'Internal Transfers',
    pos: ar ? 'طلبات نقطة البيع' : 'PoS Orders',
    manufacturing: ar ? 'التصنيع' : 'Manufacturing',
  }[code]

  const columnDefs = useMemo(() => buildColumnDefs(code, ar), [code, ar])
  const storageKey = `maqder-inv-transfer-cols-${code}`
  const { visible, toggle, activeColumns } = useColumnVisibility(storageKey, columnDefs)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers', code, state, page],
    queryFn: () =>
      api.get('/stock/transfers', {
        params: { code, state: state || undefined, page, limit: PAGE_SIZE },
      }).then((r) => r.data),
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
      const from = String(t.sourceLocationId?.completePath || t.sourceLocationId?.name || '').toLowerCase()
      const to = String(t.destLocationId?.completePath || t.destLocationId?.name || '').toLowerCase()
      return (
        t.name?.toLowerCase().includes(needle)
        || t.origin?.toLowerCase().includes(needle)
        || partnerName.includes(needle)
        || from.includes(needle)
        || to.includes(needle)
      )
    })
  }, [data, q])

  const meta = data?._meta
  const total = meta?.total ?? 0
  const applied = meta?.appliedFilters || {}
  const filtersActive = Boolean(state || q.trim() || applied.emptyOperationTypeMatch)

  const setPage = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
  }

  const clearFilters = () => {
    setSearchParams({})
    setQ('')
  }

  const basePath = `/app/dashboard/inventory/${
    code === 'incoming' ? 'receipts'
      : code === 'outgoing' ? 'deliveries'
        : code === 'pos' ? 'pos'
          : code === 'manufacturing' ? 'manufacturing'
            : 'internal'
  }`

  return (
    <InvListShell
      title={title}
      filtersActive={filtersActive}
      loading={isLoading}
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      onPageChange={setPage}
      language={language}
      action={(
        <div className="flex flex-wrap items-center gap-2">
          <InventoryIeButtons
            model="transfers"
            importable={false}
            ar={ar}
            filters={{ code, state: state || undefined }}
          />
          <Link to={`${basePath}/new`} className="btn btn-primary text-sm">
            <Plus className="h-4 w-4" />
            {code === 'incoming'
              ? (ar ? 'استلام جديد' : 'New Receipt')
              : code === 'outgoing'
                ? (ar ? 'تسليم جديد' : 'New Delivery')
                : code === 'internal'
                  ? (ar ? 'تحويل جديد' : 'New Transfer')
                  : (ar ? 'جديد' : 'New')}
          </Link>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Filter bar — always visible */}
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
              next.delete('page')
              setSearchParams(next)
            }}
          >
            <option value="">{ar ? 'كل الحالات' : 'All states'}</option>
            {[
              { id: 'draft', en: 'Draft', ar: 'مسودة' },
              { id: 'waiting', en: 'Waiting', ar: 'انتظار' },
              { id: 'confirmed', en: 'Ready', ar: 'جاهز' },
              { id: 'assigned', en: 'Ready (assigned)', ar: 'جاهز (مخصص)' },
              { id: 'done', en: 'Done', ar: 'منجز' },
              { id: 'cancelled', en: 'Cancelled', ar: 'ملغى' },
            ].map((s) => (
              <option key={s.id} value={s.id}>{ar ? s.ar : s.en}</option>
            ))}
          </select>
          <ColumnChooser ar={ar} definitions={columnDefs} visible={visible} onToggle={toggle} />
          {filtersActive && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              {ar ? 'مسح التصفية' : 'Clear filters'}
            </button>
          )}
        </div>

        {meta && (
          <p className="text-xs text-slate-400">
            {total} {ar ? 'سجل' : 'record(s)'}
            {applied.state ? ` · state=${applied.state}` : ''}
            {applied.emptyOperationTypeMatch
              ? (ar ? ' · لا أنواع عمليات مطابقة' : ' · no matching operation types')
              : ''}
          </p>
        )}

        <div className={invTableWrapClass}>
          <table className={invTableClass}>
            <thead className="border-b border-slate-100 bg-slate-50/80 text-start text-xs uppercase tracking-wide text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
              <tr>
                {activeColumns.map((col) => (
                  <th key={col.id} className={invThClass}>
                    {ar ? col.labelAr : col.labelEn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t._id}
                  className="border-b border-slate-50 transition hover:bg-slate-50/80 dark:border-dark-700 dark:hover:bg-dark-700/40"
                >
                  {activeColumns.map((col) => {
                    if (col.id === 'reference') {
                      return (
                        <td key={col.id} className={invTdClass}>
                          <Link
                            to={`${basePath}/${t._id}`}
                            className="font-medium text-sky-800 hover:underline dark:text-sky-300"
                          >
                            {t.name}
                          </Link>
                        </td>
                      )
                    }
                    if (col.id === 'status') {
                      return (
                        <td key={col.id} className="min-w-[150px] px-4 py-3">
                          <StatusChip status={t.state} language={language} />
                        </td>
                      )
                    }
                    return (
                      <td
                        key={col.id}
                        className={`min-w-[150px] px-4 py-3 ${
                          col.id === 'scheduled' || col.id === 'createdAt'
                            ? 'tabular-nums text-slate-500'
                            : col.id === 'partner'
                              ? 'font-medium text-slate-700 dark:text-slate-200'
                              : 'text-slate-500'
                        }`}
                      >
                        {cellValue(col.id, t, { ar })}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {rows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={Math.max(activeColumns.length, 1)} className="p-8">
                    <EmptyState
                      title={ar ? 'لا توجد تحويلات' : 'No transfers'}
                      description={
                        applied.emptyOperationTypeMatch
                          ? (ar
                            ? 'لا توجد أنواع عمليات لهذا المستودع/الكود — شغّل التهيئة من الإعدادات'
                            : 'No operation types for this warehouse/code — run bootstrap from Settings')
                          : state || q
                            ? (ar
                              ? 'لا نتائج للتصفية الحالية. غيّر الحالة أو امسح التصفية من الشريط أعلاه.'
                              : 'No rows for current filters. Change the state or Clear filters above.')
                            : (ar ? 'أنشئ مستنداً جديداً للبدء' : 'Create a document to get started')
                      }
                    />
                    {filtersActive && (
                      <div className="mt-3 flex justify-center">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                          {ar ? 'مسح التصفية' : 'Clear filters'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </InvListShell>
  )
}
