import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, ReportTableFrame, REPORT_THEAD, useReportFilters, exportCsv } from './ReportShell'
import { formatInvError } from '../../lib/invError'
import {
  formatDsi,
  formatReportLocation,
  formatReportMoney,
  formatReportMoneyCsv,
  formatReportProduct,
  formatReportQty,
  formatTurns,
} from '../../lib/reportFormat'
import { invTableWrapClass } from './inventoryUi'

export function CountPlansPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState('monthly')

  const { data, isLoading } = useQuery({
    queryKey: ['count-plans'],
    queryFn: () => api.get('/stock/count-plans').then((r) => asInvList(r.data)),
  })
  const plans = data || []

  const create = useMutation({
    mutationFn: () => api.post('/stock/count-plans', { name, frequency, scopeType: 'warehouse' }),
    onSuccess: () => {
      toast.success(ar ? 'تم' : 'Created')
      setName('')
      qc.invalidateQueries({ queryKey: ['count-plans'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const run = useMutation({
    mutationFn: (id) => api.post(`/stock/count-plans/${id}/run`),
    onSuccess: (r) => toast.success(ar ? `تم جدولة ${r.data?.scheduled || 0}` : `Scheduled ${r.data?.scheduled || 0}`),
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const abc = useMutation({
    mutationFn: () => api.post('/stock/count-plans/compute-abc'),
    onSuccess: (r) => toast.success(ar ? `ABC: ${r.data?.updated}` : `ABC updated: ${r.data?.updated}`),
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{ar ? 'خطط العد الدوري' : 'Cycle count plans'}</h2>
        <button type="button" className="btn btn-secondary btn-sm" disabled={abc.isPending} onClick={() => abc.mutate()}>
          {ar ? 'حساب ABC' : 'Compute ABC'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input input-sm" placeholder={ar ? 'اسم الخطة' : 'Plan name'} value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input input-sm" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="weekly">{ar ? 'أسبوعي' : 'Weekly'}</option>
          <option value="monthly">{ar ? 'شهري' : 'Monthly'}</option>
          <option value="quarterly">{ar ? 'ربع سنوي' : 'Quarterly'}</option>
        </select>
        <button type="button" className="btn btn-primary btn-sm" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          <Plus className="h-4 w-4" />{ar ? 'خطة' : 'Plan'}
        </button>
      </div>
      {isLoading ? <div className="text-slate-400">…</div> : !plans.length ? (
        <EmptyState title={ar ? 'لا خطط' : 'No plans'} />
      ) : (
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-xs uppercase text-slate-500">
            <th className="py-2 text-start">{ar ? 'الاسم' : 'Name'}</th>
            <th>{ar ? 'التكرار' : 'Frequency'}</th>
            <th>{ar ? 'التالي' : 'Next'}</th>
            <th />
          </tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="py-2">{p.name}</td>
                <td>{p.frequency}</td>
                <td className="tabular-nums">{p.nextRunAt ? new Date(p.nextRunAt).toLocaleDateString() : '—'}</td>
                <td className="text-end">
                  <button type="button" className="btn btn-secondary btn-xs" onClick={() => run.mutate(p._id)}>{ar ? 'تشغيل' : 'Run'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function PeriodClosePage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [lockDate, setLockDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['period-close'],
    queryFn: () => api.get('/stock/period-close/checklist').then((r) => r.data),
  })

  const lock = useMutation({
    mutationFn: () => api.post('/stock/period-close/lock', { lockDate }),
    onSuccess: () => {
      toast.success(ar ? 'تم قفل الفترة' : 'Period locked')
      qc.invalidateQueries({ queryKey: ['period-close'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{ar ? 'إغلاق الفترة' : 'Period close'}</h2>
      {isLoading ? <div>…</div> : (
        <>
          <p className="text-sm text-slate-600">
            {ar ? 'قفل حالي:' : 'Current lock:'} <strong>{data?.lockDate || (ar ? 'لا يوجد' : 'None')}</strong>
            {' · '}
            {data?.canClose ? (ar ? 'جاهز للإغلاق' : 'Ready to close') : (ar ? 'عناصر معطلة' : 'Blocking items')}
          </p>
          {(data?.blocking || []).map((b) => (
            <div key={b.code} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {ar && b.messageAr ? b.messageAr : b.message}
            </div>
          ))}
          {(data?.warnings || []).map((w) => (
            <div key={w.code} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {ar && w.messageAr ? w.messageAr : w.message}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label text-xs">{ar ? 'قفل حتى تاريخ' : 'Lock through date'}</label>
              <input type="date" className="input input-sm" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled={!lockDate || lock.isPending} onClick={() => lock.mutate()}>
              {ar ? 'تطبيق القفل' : 'Apply lock'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function DemandSuggestionsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [groupByVendor, setGroupByVendor] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['demand-suggestions', groupByVendor],
    queryFn: () => groupByVendor
      ? api.get('/stock/replenishment/suggestions', { params: { groupBy: 'vendor' } }).then((r) => r.data?.groups || [])
      : api.get('/stock/replenishment/suggestions').then((r) => asInvList(r.data)),
  })
  const rows = groupByVendor ? null : (data || [])
  const groups = groupByVendor ? (data || []) : null

  const apply = useMutation({
    mutationFn: (ruleId) => api.post(`/stock/replenishment/suggestions/${ruleId}/apply`),
    onSuccess: () => {
      toast.success(ar ? 'تم تطبيق الاقتراح' : 'Suggestion applied')
      qc.invalidateQueries({ queryKey: ['demand-suggestions'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{ar ? 'اقتراحات التزويد' : 'Replenishment suggestions'}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={groupByVendor} onChange={(e) => setGroupByVendor(e.target.checked)} />
          {ar ? 'تجميع حسب المورد' : 'Group by vendor'}
        </label>
      </div>
      {isLoading ? <div>…</div> : groupByVendor ? (
        !groups?.length ? (
          <EmptyState title={ar ? 'لا قواعد' : 'No reorder rules'} />
        ) : (
          groups.map((g) => (
            <div key={g.vendorId || g.vendorName} className="rounded-xl border border-slate-200 p-3 dark:border-dark-600">
              <h3 className="mb-2 font-medium">{g.vendorName}</h3>
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="py-1 text-end">{ar ? 'min/max' : 'min/max'}</th>
                    <th className="py-1 text-end">{ar ? 'مقترح' : 'Suggested'}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((r) => (
                    <tr key={r.ruleId} className="border-t border-slate-100">
                      <td className="py-1">{r.productName}</td>
                      <td className="py-1 text-end tabular-nums">{r.currentMin} / {r.currentMax}</td>
                      <td className="py-1 text-end tabular-nums">{r.suggestedMin} / {r.suggestedMax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )
      ) : !rows.length ? (
        <EmptyState title={ar ? 'لا قواعد' : 'No reorder rules'} description={ar ? 'أضف قواعد إعادة الطلب أولاً' : 'Add reorder rules first'} />
      ) : (
        <div className={invTableWrapClass}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase dark:bg-dark-800">
              <tr>
                <th className="min-w-[150px] px-3 py-2 text-start">{ar ? 'المنتج' : 'Product'}</th>
                <th className="min-w-[150px] px-3 py-2 text-end">{ar ? 'الحالي min/max' : 'Current min/max'}</th>
                <th className="min-w-[150px] px-3 py-2 text-end">{ar ? 'مقترح min/max' : 'Suggested min/max'}</th>
                <th className="min-w-[150px] px-3 py-2 text-start">{ar ? 'الأساس' : 'Basis'}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.ruleId}>
                  <td className="px-3 py-2">{r.productName}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.currentMin} / {r.currentMax}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.suggestedMin} / {r.suggestedMax}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-xs">{ar ? r.explanationAr : r.explanation}</td>
                  <td className="px-3 py-2 text-end">
                    <button type="button" className="btn btn-secondary btn-xs" onClick={() => apply.mutate(r.ruleId)}>{ar ? 'تطبيق' : 'Apply'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GenericReportTable({ activeId, title, subtitle, queryKey, endpoint, columns, ar }) {
  const { queryParams } = useReportFilters()
  const { data, isLoading } = useQuery({
    queryKey: [queryKey, queryParams],
    queryFn: () => api.get(endpoint, { params: queryParams }).then((r) => r.data),
  })
  const lines = data?.lines || data?.locations || data?.deliveries || []
  const csvColumns = columns.map((c) => ({
    label: c.label,
    get: c.csvGet || c.get || ((row) => row[c.key]),
  }))
  return (
    <ReportShell activeId={activeId} title={title} subtitle={subtitle}>
      {isLoading ? <div>…</div> : !lines.length ? (
        <EmptyState title={ar ? 'لا بيانات' : 'No data'} />
      ) : (
        <ReportTableFrame
          toolbar={(
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => exportCsv(`${activeId}.csv`, lines, csvColumns)}
            >
              CSV
            </button>
          )}
        >
          <table className="w-full min-w-[720px] text-sm">
            <thead className={REPORT_THEAD}>
              <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 text-start">{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {lines.map((row, i) => (
                <tr key={row._id || `${row.productId || ''}|${row.variantId || ''}|${i}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.align === 'end' ? 'text-end tabular-nums' : ''}`}>
                      {c.get ? c.get(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ReportTableFrame>
      )}
    </ReportShell>
  )
}

export function StockAgeingPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  return (
    <GenericReportTable
      activeId="stock-ageing"
      title={ar ? 'تقادم المخزون' : 'Stock ageing'}
      subtitle={ar ? 'صف واحد لكل متغير · كميات حسب الفئة' : 'One row per variant · qty by age bucket'}
      queryKey="stock-ageing"
      endpoint="/stock/report/stock-ageing"
      ar={ar}
      columns={[
        { key: 'product', label: ar ? 'المنتج' : 'Product', get: (r) => formatReportProduct(r, { ar }) },
        { key: 'qty0', label: '0–30', align: 'end', get: (r) => formatReportQty(r.qty0_30 ?? 0) },
        { key: 'qty31', label: '31–60', align: 'end', get: (r) => formatReportQty(r.qty31_60 ?? 0) },
        { key: 'qty61', label: '61–90', align: 'end', get: (r) => formatReportQty(r.qty61_90 ?? 0) },
        { key: 'qty90', label: '90+', align: 'end', get: (r) => formatReportQty(r.qty90plus ?? 0) },
        { key: 'qty', label: ar ? 'الإجمالي' : 'Total qty', align: 'end', get: (r) => formatReportQty(r.qty) },
        {
          key: 'value',
          label: ar ? 'القيمة' : 'Value',
          align: 'end',
          get: (r) => formatReportMoney(r.value),
          csvGet: (r) => formatReportMoneyCsv(r.value),
        },
      ]}
    />
  )
}

export function DeadStockPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  return (
    <GenericReportTable
      activeId="dead-stock"
      title={ar ? 'مخزون راكد' : 'Dead / slow stock'}
      subtitle={ar ? 'بدون صرف خلال 90 يوماً' : 'No outbound in 90 days'}
      queryKey="dead-stock"
      endpoint="/stock/report/dead-stock"
      ar={ar}
      columns={[
        { key: 'product', label: ar ? 'المنتج' : 'Product', get: (r) => formatReportProduct(r, { ar }) },
        { key: 'qty', label: ar ? 'الكمية' : 'Qty', align: 'end', get: (r) => formatReportQty(r.qty) },
        {
          key: 'value',
          label: ar ? 'القيمة' : 'Value',
          align: 'end',
          get: (r) => formatReportMoney(r.value),
          csvGet: (r) => formatReportMoneyCsv(r.value),
        },
        {
          key: 'lastMoved',
          label: ar ? 'آخر حركة' : 'Last Moved Date',
          get: (r) => {
            const d = r.lastMovedDate || r.lastMovedAt
            return d ? new Date(d).toLocaleDateString() : '—'
          },
        },
        {
          key: 'days',
          label: ar ? 'أيام راكدة' : 'Days idle',
          align: 'end',
          get: (r) => (r.daysSinceMove != null ? String(r.daysSinceMove) : '—'),
        },
      ]}
    />
  )
}

export function CountAccuracyPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  return (
    <GenericReportTable
      activeId="count-accuracy"
      title={ar ? 'دقة العد' : 'Count accuracy'}
      subtitle={ar ? 'نسبة الدقة حسب الموقع' : 'Accuracy % by location'}
      queryKey="count-accuracy"
      endpoint="/stock/report/count-accuracy"
      ar={ar}
      columns={[
        { key: 'loc', label: ar ? 'الموقع' : 'Location', get: (r) => formatReportLocation(r.locationName || r.location) },
        { key: 'lines', label: ar ? 'أسطر' : 'Lines', align: 'end', get: (r) => r.lines },
        { key: 'acc', label: ar ? 'الدقة %' : 'Accuracy %', align: 'end', get: (r) => formatTurns(r.accuracyPct) },
      ]}
    />
  )
}

export function InventoryTurnsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const { queryParams } = useReportFilters()
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-turns', queryParams],
    queryFn: () => api.get('/stock/report/inventory-turns', { params: queryParams }).then((r) => r.data),
  })
  const lines = data?.lines || []
  const totals = data?.totals || {}

  const csvCols = [
    { label: 'Product', get: (r) => formatReportProduct(r, { ar }) },
    { label: 'Units out', get: (r) => formatReportQty(r.unitsOut) },
    { label: 'COGS', get: (r) => formatReportMoneyCsv(r.cogs) },
    { label: 'Inv. value', get: (r) => formatReportMoneyCsv(r.avgInventoryValue) },
    { label: 'Turns', get: (r) => formatTurns(r.turns) },
    { label: 'DSI', get: (r) => formatDsi(r.dsiDays) },
  ]

  return (
    <ReportShell
      activeId="inventory-turns"
      title={ar ? 'دوران المخزون' : 'Inventory turns & DSI'}
      subtitle={ar ? 'COGS / متوسط قيمة المخزون · أيام المبيعات' : 'COGS / avg inventory value · days sales of inventory'}
    >
      {isLoading ? <div>…</div> : (
        <>
          <p className="mb-2 shrink-0 text-sm text-slate-600">
            {ar ? 'إجمالي الدوران' : 'Portfolio turns'}: <strong>{formatTurns(totals.turns)}</strong>
            {' · '}
            DSI: <strong>{formatDsi(totals.dsiDays)}</strong> {ar ? 'يوم' : 'days'}
          </p>
          {!lines.length ? (
            <EmptyState title={ar ? 'لا بيانات' : 'No data'} />
          ) : (
            <ReportTableFrame
              toolbar={(
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => exportCsv('inventory-turns.csv', lines, csvCols)}
                >
                  CSV
                </button>
              )}
            >
              <table className="w-full min-w-[720px] text-sm">
                <thead className={REPORT_THEAD}>
                  <tr>
                    <th className="min-w-[150px] px-3 py-2 text-start">{ar ? 'المنتج' : 'Product'}</th>
                    <th className="min-w-[100px] px-3 py-2 text-end">{ar ? 'صرف' : 'Units out'}</th>
                    <th className="min-w-[100px] px-3 py-2 text-end">COGS</th>
                    <th className="min-w-[100px] px-3 py-2 text-end">{ar ? 'قيمة المخزون' : 'Inv. value'}</th>
                    <th className="min-w-[100px] px-3 py-2 text-end">{ar ? 'الدوران' : 'Turns'}</th>
                    <th className="min-w-[100px] px-3 py-2 text-end">DSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                  {lines.map((row) => (
                    <tr key={`${row.productId}|${row.variantId || ''}`}>
                      <td className="px-3 py-2">{formatReportProduct(row, { ar })}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatReportQty(row.unitsOut)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatReportMoney(row.cogs)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatReportMoney(row.avgInventoryValue)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatTurns(row.turns)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{formatDsi(row.dsiDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportTableFrame>
          )}
        </>
      )}
    </ReportShell>
  )
}

export function MockRecallPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [lotId, setLotId] = useState('')
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['mock-recall', lotId],
    enabled: false,
    queryFn: () => api.get('/stock/report/mock-recall', { params: { lotId } }).then((r) => r.data),
  })
  return (
    <ReportShell activeId="mock-recall" title={ar ? 'استدعاء تجريبي' : 'Mock recall'} subtitle={ar ? 'تتبع الدفعة للعملاء' : 'Trace lot to customers'}>
      <div className="mb-4 flex gap-2">
        <input className="input input-sm flex-1" placeholder={ar ? 'معرف الدفعة' : 'Lot ID'} value={lotId} onChange={(e) => setLotId(e.target.value)} />
        <button type="button" className="btn btn-primary btn-sm" disabled={!lotId || isFetching} onClick={() => refetch()}>{ar ? 'بحث' : 'Trace'}</button>
      </div>
      {data?.deliveries?.length ? (
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-xs uppercase text-slate-500">
            <th className="py-2 text-start">{ar ? 'التسليم' : 'Delivery'}</th>
            <th>{ar ? 'الكمية' : 'Qty'}</th>
            <th>{ar ? 'التاريخ' : 'Date'}</th>
          </tr></thead>
          <tbody>
            {data.deliveries.map((d, i) => (
              <tr key={i} className="border-t"><td className="py-2">{d.transferName}</td><td>{d.qty}</td><td>{d.date ? new Date(d.date).toLocaleDateString() : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      ) : data ? <EmptyState title={ar ? 'لا نتائج' : 'No hits'} /> : null}
    </ReportShell>
  )
}

export function ApiIntegrationsPage() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const qc = useQueryClient()
  const [keyName, setKeyName] = useState('')
  const [newSecret, setNewSecret] = useState(null)
  const [chName, setChName] = useState('')
  const [chPlatform, setChPlatform] = useState('salla')

  const { data: keys } = useQuery({
    queryKey: ['inv-api-keys'],
    queryFn: () => api.get('/stock/api-keys').then((r) => asInvList(r.data)),
  })

  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['sales-channels'],
    queryFn: () => api.get('/stock/sales-channels').then((r) => asInvList(r.data)),
  })

  const createKey = useMutation({
    mutationFn: () => api.post('/stock/api-keys', { name: keyName, scopes: ['read', 'write'] }),
    onSuccess: (r) => {
      setNewSecret(r.data?.secret)
      setKeyName('')
      qc.invalidateQueries({ queryKey: ['inv-api-keys'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const createChannel = useMutation({
    mutationFn: () => api.post('/stock/sales-channels', { name: chName, platform: chPlatform }),
    onSuccess: () => {
      toast.success(ar ? 'تم إنشاء القناة' : 'Channel created')
      setChName('')
      qc.invalidateQueries({ queryKey: ['sales-channels'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const syncChannel = useMutation({
    mutationFn: (id) => api.post(`/stock/sales-channels/${id}/sync`),
    onSuccess: (r) => {
      const d = r.data
      toast.success(
        ar
          ? `مزامنة: ${d.stockPushed || 0} SKU · ${d.message || ''}`
          : `Sync: ${d.stockPushed || 0} SKUs · ${d.message || ''}`,
      )
      qc.invalidateQueries({ queryKey: ['sales-channels'] })
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{ar ? 'مفاتيح API' : 'API keys'}</h2>
        <p className="text-sm text-slate-500">
          {ar ? 'REST على /api/v1/inventory · ' : 'REST at /api/v1/inventory · '}
          <a href="/api/v1/inventory/openapi.json" className="text-primary-600 hover:underline" target="_blank" rel="noreferrer">
            OpenAPI
          </a>
        </p>
        <div className="mt-2 flex gap-2">
          <input className="input input-sm" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={ar ? 'الاسم' : 'Name'} />
          <button type="button" className="btn btn-primary btn-sm" disabled={!keyName || createKey.isPending} onClick={() => createKey.mutate()}>{ar ? 'إنشاء' : 'Create'}</button>
        </div>
        {newSecret && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-mono text-amber-900">{newSecret}</p>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {(keys || []).map((k) => (
            <li key={k._id}>{k.name} · {k.keyPrefix}… · {k.scopes?.join(', ')}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-medium">{ar ? 'قنوات البيع' : 'Sales channels'}</h3>
        <p className="text-xs text-slate-500">{ar ? 'Salla / Shopify / Zid — موصلات OAuth قادمة' : 'Salla / Shopify / Zid — OAuth connectors pending credentials'}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="input input-sm" value={chName} onChange={(e) => setChName(e.target.value)} placeholder={ar ? 'اسم القناة' : 'Channel name'} />
          <select className="input input-sm" value={chPlatform} onChange={(e) => setChPlatform(e.target.value)}>
            <option value="salla">Salla</option>
            <option value="shopify">Shopify</option>
            <option value="zid">Zid</option>
            <option value="woocommerce">WooCommerce</option>
          </select>
          <button type="button" className="btn btn-primary btn-sm" disabled={!chName.trim() || createChannel.isPending} onClick={() => createChannel.mutate()}>
            {ar ? 'إضافة' : 'Add'}
          </button>
        </div>
        {channelsLoading ? <div className="mt-2 text-sm text-slate-400">…</div> : (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-xs uppercase text-slate-500">
              <th className="py-2 text-start">{ar ? 'الاسم' : 'Name'}</th>
              <th>{ar ? 'المنصة' : 'Platform'}</th>
              <th>{ar ? 'الحالة' : 'Status'}</th>
              <th>{ar ? 'آخر مزامنة' : 'Last sync'}</th>
              <th />
            </tr></thead>
            <tbody>
              {(channels || []).map((c) => (
                <tr key={c._id} className="border-t border-slate-100">
                  <td className="py-2">{c.name}</td>
                  <td>{c.platform}</td>
                  <td>{c.status}</td>
                  <td className="tabular-nums">{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : '—'}</td>
                  <td className="text-end">
                    <button type="button" className="btn btn-secondary btn-xs" disabled={syncChannel.isPending} onClick={() => syncChannel.mutate(c._id)}>
                      {ar ? 'مزامنة' : 'Sync'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!channelsLoading && !(channels || []).length && (
          <EmptyState title={ar ? 'لا قنوات' : 'No channels'} className="mt-3" />
        )}
      </div>
    </div>
  )
}
