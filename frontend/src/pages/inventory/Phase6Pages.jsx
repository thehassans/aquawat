import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, REPORT_TABS, useReportFilters, exportCsv } from './ReportShell'
import ImportExportDialog from '../../components/inventory/ImportExportDialog'
import { formatInvError } from '../../lib/invError'

const QUANT_STATUSES = ['available', 'quarantine', 'damaged', 'on_hold', 'expired']

export default function ReportingHub() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { qs } = useReportFilters()

  const links = REPORT_TABS.map((t) => ({
    to: `${t.path}${qs}`,
    en: t.en,
    ar: t.ar,
    id: t.id,
  }))

  return (
    <ReportShell
      activeId="hub"
      title={ar ? 'التقارير' : 'Reporting'}
      subtitle={ar
        ? 'عائلة تقارير واحدة — نفس الفلاتر والتصدير'
        : 'One report family — shared filters and export'}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.id}
            to={l.to}
            className="rounded-xl border border-slate-200/80 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-primary-300 hover:bg-primary-50/40 dark:border-dark-600 dark:text-slate-100 dark:hover:bg-dark-800"
          >
            {ar ? l.ar : l.en}
          </Link>
        ))}
      </div>
    </ReportShell>
  )
}

export function MovesAnalysisPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { filters, setFilter, queryParams } = useReportFilters()
  const groupBy = filters.groupBy || 'product'
  const view = filters.view || 'list'

  const { data, isLoading } = useQuery({
    queryKey: ['moves-analysis', groupBy, queryParams],
    queryFn: () =>
      api.get('/stock/report/moves-analysis', {
        params: { groupBy, warehouseId: queryParams.warehouseId, dateFrom: queryParams.dateFrom, dateTo: queryParams.dateTo },
      }).then((r) => r.data),
  })

  const items = data?.items || []
  const totals = items.reduce(
    (acc, row) => ({
      incomingQty: acc.incomingQty + Number(row.incomingQty || 0),
      outgoingQty: acc.outgoingQty + Number(row.outgoingQty || 0),
      netQty: acc.netQty + Number(row.netQty || 0),
      lines: acc.lines + Number(row.lines || 0),
    }),
    { incomingQty: 0, outgoingQty: 0, netQty: 0, lines: 0 },
  )

  return (
    <ReportShell
      activeId="moves-analysis"
      title={ar ? 'تحليل الحركات' : 'Moves Analysis'}
      subtitle={ar ? 'تصدير كل المجموعات المصفّاة' : 'Export exports the full filtered aggregation'}
      extraFilters={(
        <div>
          <label className="label text-[11px]">{ar ? 'تجميع' : 'Group by'}</label>
          <select className="select select-sm" value={groupBy} onChange={(e) => setFilter('groupBy', e.target.value)}>
            <option value="product">{ar ? 'حسب المنتج' : 'By product'}</option>
            <option value="day">{ar ? 'حسب اليوم' : 'By day'}</option>
            <option value="partner">{ar ? 'حسب الشريك' : 'By partner'}</option>
          </select>
        </div>
      )}
      toolbar={(
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!items.length}
          onClick={() => exportCsv('moves-analysis.csv', items, [
            { label: 'Group', get: (r) => r.label },
            { label: 'Incoming', get: (r) => r.incomingQty },
            { label: 'Outgoing', get: (r) => r.outgoingQty },
            { label: 'Net', get: (r) => r.netQty },
            { label: 'Lines', get: (r) => r.lines },
          ])}
        >
          {ar ? 'تصدير الكل' : 'Export all'}
        </button>
      )}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={ar ? 'لا بيانات' : 'No moves yet'} />
      ) : (
        <>
          {view === 'graph' && (
            <div className="rounded-xl border border-slate-200/80 p-4 dark:border-dark-600">
              <p className="mb-3 text-xs font-medium uppercase text-slate-500">{ar ? 'صافي الكمية' : 'Net qty'}</p>
              <div className="flex h-40 items-end gap-1">
                {items.slice(0, 32).map((r) => {
                  const max = Math.max(...items.map((x) => Math.abs(Number(x.netQty || 0))), 1)
                  const h = Math.max(4, (Math.abs(Number(r.netQty || 0)) / max) * 100)
                  const neg = Number(r.netQty || 0) < 0
                  return (
                    <div
                      key={r.key}
                      className={`flex-1 rounded-t ${neg ? 'bg-rose-500/80' : 'bg-sky-600/80'}`}
                      style={{ height: `${h}%` }}
                      title={`${r.label}: ${r.netQty}`}
                    />
                  )
                })}
              </div>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-dark-800">
                <tr>
                  <th className="px-3 py-2 text-start">{ar ? 'المجموعة' : 'Group'}</th>
                  <th className="px-3 py-2 text-right">{ar ? 'وارد' : 'In'}</th>
                  <th className="px-3 py-2 text-right">{ar ? 'صادر' : 'Out'}</th>
                  <th className="px-3 py-2 text-right">{ar ? 'صافي' : 'Net'}</th>
                  <th className="px-3 py-2 text-right">{ar ? 'أسطر' : 'Lines'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                {items.map((row) => (
                  <tr key={row.key}>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{row.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.incomingQty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.outgoingQty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.netQty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{row.lines}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/80 text-sm font-semibold dark:border-dark-600 dark:bg-dark-900/40">
                <tr>
                  <td className="px-3 py-2.5">{ar ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.incomingQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.outgoingQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.netQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.lines}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </ReportShell>
  )
}

export function PerformancePage() {
  const { language } = useSelector((s) => s.ui)
  const { queryParams } = useReportFilters()
  const { data, isLoading } = useQuery({
    queryKey: ['inv-performance', queryParams],
    queryFn: () => api.get('/stock/report/performance', { params: queryParams }).then((r) => r.data),
  })

  const cards = useMemo(() => {
    if (!data) return []
    return [
      {
        label: language === 'ar' ? 'تحويلات منجزة' : 'Transfers done',
        value: data.transfersDone ?? 0,
      },
      {
        label: language === 'ar' ? 'في الموعد' : 'On-time rate',
        value: data.onTimeRate == null ? '—' : `${Math.round(data.onTimeRate * 100)}%`,
      },
      {
        label: language === 'ar' ? 'متأخرة (مفتوحة)' : 'Open late',
        value: data.openLateCount ?? 0,
      },
      {
        label: language === 'ar' ? 'متوسط أيام الإنجاز' : 'Avg lead days',
        value: data.avgLeadDays == null ? '—' : Number(data.avgLeadDays).toFixed(1),
      },
      {
        label: language === 'ar' ? 'أوامر متبقية' : 'Backorders',
        value: data.backorderCount ?? 0,
      },
    ]
  }, [data, language])

  return (
    <ReportShell
      activeId="performance"
      title={language === 'ar' ? 'أداء المخزون' : 'Inventory Performance'}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200/80 px-4 py-3 dark:border-dark-600">
              <div className="text-xs uppercase tracking-wide text-slate-400">{c.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{c.value}</div>
            </div>
          ))}
        </div>
      )}
    </ReportShell>
  )
}

export function ExpiryAtRiskPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const { queryParams } = useReportFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['expiry-at-risk', queryParams],
    queryFn: () => api.get('/stock/report/expiry-at-risk', { params: queryParams }).then((r) => r.data),
  })

  const statusMut = useMutation({
    mutationFn: ({ quantId, status }) =>
      api.patch(`/stock/quants/${quantId}/status`, { status }),
    onSuccess: () => {
      toast.success(ar ? 'تم تحديث الحالة' : 'Status updated')
      qc.invalidateQueries({ queryKey: ['expiry-at-risk'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const writeOffMut = useMutation({
    mutationFn: (quantId) => api.post(`/stock/quants/${quantId}/write-off-expired`),
    onSuccess: () => {
      toast.success(ar ? 'تم شطب الكمية المنتهية' : 'Expired qty written off')
      qc.invalidateQueries({ queryKey: ['expiry-at-risk'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const buckets = data?.buckets || []
  const lines = data?.lines || []
  const totals = data?.totals || {}

  return (
    <ReportShell
      activeId="expiry-at-risk"
      title={ar ? 'انتهاء الصلاحية — مخاطر' : 'Expiry at risk'}
      subtitle={ar
        ? 'دفعات بكمية متاحة تنتهي خلال 7 / 30 / 60 / 90 يوماً'
        : 'Lots on hand expiring within 7 / 30 / 60 / 90 days'}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {buckets.map((b) => (
              <div key={b.withinDays} className="rounded-xl border border-slate-200/80 px-4 py-3 dark:border-dark-600">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {ar ? `≤ ${b.withinDays} يوم` : `≤ ${b.withinDays} days`}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{b.qty}</div>
                <div className="text-xs text-slate-500">{b.lineCount} {ar ? 'سطر' : 'lines'} · {b.valueAtRisk} SAR</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {ar ? 'إجمالي الكمية' : 'Total qty'}: <strong>{totals.qty || '0'}</strong>
            {' · '}
            {ar ? 'قيمة المخاطرة' : 'Value at risk'}: <strong>{totals.valueAtRisk || '0'}</strong> SAR
          </p>
          {!lines.length ? (
            <EmptyState title={ar ? 'لا دفعات منتهية قريباً' : 'No lots expiring soon'} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-dark-800">
                  <tr>
                    <th className="px-3 py-2 text-start">{ar ? 'الدفعة' : 'Lot'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="px-3 py-2 text-right">{ar ? 'الكمية' : 'Qty'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'انتهاء' : 'Expiry'}</th>
                    <th className="px-3 py-2 text-right">{ar ? 'أيام' : 'Days'}</th>
                    <th className="px-3 py-2 text-right">{ar ? 'قيمة' : 'Value'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="px-3 py-2 text-end">{ar ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                  {lines.map((row) => (
                    <tr key={`${row.lotId}-${row.locationId}`}>
                      <td className="px-3 py-2">{row.lotName}</td>
                      <td className="px-3 py-2">{row.productName || row.sku}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.qty}</td>
                      <td className="px-3 py-2">{row.expirationDate ? new Date(row.expirationDate).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.daysToExpiry}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.valueAtRisk}</td>
                      <td className="px-3 py-2">
                        {row.quantId ? (
                          <select
                            className="input input-sm min-w-[7rem]"
                            value={row.inventoryStatus || 'available'}
                            disabled={statusMut.isPending}
                            onChange={(e) => statusMut.mutate({ quantId: row.quantId, status: e.target.value })}
                          >
                            {QUANT_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          row.inventoryStatus
                        )}
                      </td>
                      <td className="px-3 py-2 text-end">
                        {row.quantId && row.daysToExpiry != null && row.daysToExpiry <= 0 ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            disabled={writeOffMut.isPending}
                            onClick={() => writeOffMut.mutate(row.quantId)}
                          >
                            {ar ? 'شطب' : 'Write off'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ReportShell>
  )
}

export function ReceptionReportPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { queryParams } = useReportFilters()

  const { data, isLoading, error } = useQuery({
    queryKey: ['reception-report', queryParams],
    queryFn: () => api.get('/stock/report/reception', { params: queryParams }).then((r) => r.data),
    retry: false,
  })

  const items = data?.items || []
  const totals = data?.totals || {}

  return (
    <ReportShell
      activeId="reception"
      title={ar ? 'تقرير الاستلام' : 'Reception report'}
      subtitle={ar
        ? 'إيصالات واردة مكتملة في الفترة — قراءة من دفتر الحركات فقط'
        : 'Done incoming receipts in period — read from the move ledger only'}
    >
      {error ? (
        <EmptyState
          title={ar ? 'التقرير متوقف' : 'Report disabled'}
          description={error.response?.data?.error || error.message}
        />
      ) : isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
            <span>{ar ? 'إيصالات' : 'Receipts'}: <strong className="tabular-nums">{totals.receipts ?? 0}</strong></span>
            <span>{ar ? 'بنود' : 'Lines'}: <strong className="tabular-nums">{totals.lines ?? 0}</strong></span>
            <span>{ar ? 'الكمية' : 'Qty'}: <strong className="tabular-nums">{totals.qty ?? '0'}</strong></span>
            <span className={totals.late ? 'text-amber-600' : ''}>
              {ar ? 'متأخر' : 'Late'}: <strong className="tabular-nums">{totals.late ?? 0}</strong>
            </span>
          </div>
          {!items.length ? (
            <EmptyState title={ar ? 'لا استلامات في الفترة' : 'No receipts in period'} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-dark-800">
                  <tr>
                    <th className="px-3 py-2 text-start">{ar ? 'الإيصال' : 'Receipt'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'التاريخ' : 'Done'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'الشريك' : 'Partner'}</th>
                    <th className="px-3 py-2 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="px-3 py-2 text-right">{ar ? 'الكمية' : 'Qty'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                  {items.map((row, i) => (
                    <tr key={`${row.transferId}-${row.productId}-${i}`} className={row.late ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                      <td className="px-3 py-2.5">
                        <Link className="font-medium text-primary-600 hover:underline" to={`/app/dashboard/inventory/receipts/${row.transferId}`}>
                          {row.transferName}
                        </Link>
                        {row.origin ? <div className="text-xs text-slate-400">{row.origin}</div> : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-500">
                        {row.doneDate ? new Date(row.doneDate).toLocaleDateString() : '—'}
                        {row.late ? <span className="ms-1 text-xs text-amber-600">{ar ? 'متأخر' : 'late'}</span> : null}
                      </td>
                      <td className="px-3 py-2.5">{(ar && row.partnerNameAr) || row.partnerName || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{(ar && row.productNameAr) || row.productName}</div>
                        <div className="text-xs text-slate-400">{row.sku}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ReportShell>
  )
}

export function ForecastPage() {
  const { language } = useSelector((s) => s.ui)
  const { queryParams } = useReportFilters()
  const { data, isLoading } = useQuery({
    queryKey: ['inv-forecast-report', queryParams],
    queryFn: () => api.get('/stock/report/forecast', { params: queryParams }).then((r) => r.data),
  })
  const items = data?.items || []

  return (
    <ReportShell
      activeId="forecast"
      title={language === 'ar' ? 'المخزون المتوقع' : 'Forecasted Inventory'}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={language === 'ar' ? 'لا بيانات' : 'No forecast rows'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2 text-start">{language === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'متاح' : 'On hand'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'وارد' : 'In'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'صادر' : 'Out'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'متوقع' : 'Forecast'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.map((row) => (
                <tr key={row.productId} className={Number(row.forecasted) < 0 ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900 dark:text-white">{row.name}</div>
                    <div className="text-xs text-slate-400">{row.sku}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.onHand}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.incoming}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.outgoing}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{row.forecasted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  )
}

export { default as InventorySettingsPage } from './InventorySettingsPage'

export function ImportExportPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [model, setModel] = useState('products')
  const [dialog, setDialog] = useState(null)

  const { data } = useQuery({
    queryKey: ['ie-models'],
    queryFn: () => api.get('/stock/ie/models').then((r) => r.data),
  })
  const models = data?.models || []
  const selected = models.find((m) => m.key === model)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {ar ? 'استيراد وتصدير' : 'Import & Export'}
        </h2>
        <p className="text-sm text-slate-500">
          {ar
            ? 'واجهة موحّدة لكل قوائم المخزون — معاينة أولاً؛ دفتر الحركات للتصدير فقط.'
            : 'Shared shell for every inventory list — dry-run first; ledger models are export-only.'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs">{ar ? 'النموذج' : 'Model'}</label>
          <select className="select" value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}{!m.importable ? (ar ? ' (تصدير فقط)' : ' (export only)') : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!selected?.importable}
          title={!selected?.importable ? (ar ? 'تصدير فقط' : 'Export only') : undefined}
          onClick={() => setDialog('import')}
        >
          {ar ? 'استيراد' : 'Import'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setDialog('export')}>
          {ar ? 'تصدير' : 'Export'}
        </button>
      </div>

      {dialog && (
        <ImportExportDialog
          mode={dialog}
          model={model}
          importable={selected?.importable}
          ar={ar}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

export function BarcodeNomenclaturePage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const [testCode, setTestCode] = useState('')
  const [testResult, setTestResult] = useState(null)

  const { data } = useQuery({
    queryKey: ['barcode-noms'],
    queryFn: () => api.get('/stock/barcode-nomenclatures').then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/barcode-nomenclatures', { name: 'Default', isDefault: true }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الإنشاء' : 'Created')
      qc.invalidateQueries({ queryKey: ['barcode-noms'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const items = data?.items || []
  const primary = items[0]

  const runTest = async () => {
    if (!primary) return
    const res = await api.post(`/stock/barcode-nomenclatures/${primary._id}/test`, { barcode: testCode })
    setTestResult(res.data)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'تسمية الباركود' : 'Barcode Nomenclature'}
          </h2>
          <p className="text-sm text-slate-500">
            {language === 'ar' ? 'قواعد مطابقة الأنماط للمسح' : 'Pattern rules for scanned codes'}
          </p>
        </div>
        {!items.length && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => createMut.mutate()}>
            {language === 'ar' ? 'إنشاء افتراضي' : 'Create default'}
          </button>
        )}
      </div>

      {primary && (
        <>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 dark:divide-dark-700 dark:border-dark-600">
            {(primary.rules || []).map((r) => (
              <li key={r._id || r.name} className="px-4 py-2 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="ms-2 text-xs text-slate-400">{r.type} · /{r.pattern}/</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              className="input input-sm min-w-[12rem]"
              placeholder={language === 'ar' ? 'باركود للاختبار' : 'Test barcode'}
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={runTest}>
              {language === 'ar' ? 'اختبار' : 'Test'}
            </button>
          </div>
          {testResult && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {testResult.matched
                ? `${language === 'ar' ? 'مطابقة' : 'Matched'}: ${testResult.rule?.name} (${testResult.rule?.type})`
                : (language === 'ar' ? 'لا مطابقة' : 'No match')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
