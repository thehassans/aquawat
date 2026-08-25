import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'
import { ReportShell, REPORT_TABS, useReportFilters } from './ReportShell'

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
  const { filters, setFilter, queryParams } = useReportFilters()
  const groupBy = filters.groupBy || 'product'

  const { data, isLoading } = useQuery({
    queryKey: ['moves-analysis', groupBy, queryParams],
    queryFn: () =>
      api.get('/stock/report/moves-analysis', {
        params: { groupBy, warehouseId: queryParams.warehouseId, dateFrom: queryParams.dateFrom, dateTo: queryParams.dateTo },
      }).then((r) => r.data),
  })

  const items = data?.items || []

  return (
    <ReportShell
      activeId="moves-analysis"
      title={language === 'ar' ? 'تحليل الحركات' : 'Moves Analysis'}
      extraFilters={(
        <div>
          <label className="label text-[11px]">{language === 'ar' ? 'تجميع' : 'Group by'}</label>
          <select className="select select-sm" value={groupBy} onChange={(e) => setFilter('groupBy', e.target.value)}>
            <option value="product">{language === 'ar' ? 'حسب المنتج' : 'By product'}</option>
            <option value="day">{language === 'ar' ? 'حسب اليوم' : 'By day'}</option>
            <option value="partner">{language === 'ar' ? 'حسب الشريك' : 'By partner'}</option>
          </select>
        </div>
      )}
    >
      {isLoading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : !items.length ? (
        <EmptyState title={language === 'ar' ? 'لا بيانات' : 'No moves yet'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-dark-800">
              <tr>
                <th className="px-3 py-2 text-start">{language === 'ar' ? 'المجموعة' : 'Group'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'وارد' : 'In'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'صادر' : 'Out'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'صافي' : 'Net'}</th>
                <th className="px-3 py-2 text-right">{language === 'ar' ? 'أسطر' : 'Lines'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
              {items.slice(0, 80).map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{row.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.incomingQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.outgoingQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.netQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{row.lines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [csvText, setCsvText] = useState('')
  const [result, setResult] = useState(null)
  const [warehouseId, setWarehouseId] = useState('')

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-lite'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
  })

  const importMut = useMutation({
    mutationFn: (dryRun) =>
      api.post('/stock/import/products', { csvText, dryRun, warehouseId: warehouseId || undefined }),
    onSuccess: (res) => {
      setResult(res.data)
      toast.success(
        res.data.dryRun
          ? (language === 'ar' ? 'معاينة جاهزة' : 'Dry-run ready')
          : (language === 'ar' ? 'تم الاستيراد' : 'Import committed'),
      )
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const download = async (collection) => {
    try {
      const res = await api.get(`/stock/export/${collection}`, {
        params: { warehouseId: warehouseId || undefined },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collection}-export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'استيراد وتصدير' : 'Import & Export'}
        </h2>
        <p className="text-sm text-slate-500">
          {language === 'ar'
            ? 'معاينة أولاً. الكميات الافتتاحية تُرحَّل كتحويل تسوية — لا كتابة مباشرة على الرصيد.'
            : 'Dry-run first. Opening qty posts as an inventory adjustment transfer — never a direct quant write.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="select select-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">{language === 'ar' ? 'مستودع (للافتتاحي / المواقع)' : 'Warehouse (opening / locations)'}</option>
          {(warehouses || []).map((w) => (
            <option key={w._id} value={w._id}>{w.name || w.code}</option>
          ))}
        </select>
        {['products', 'stock', 'locations', 'lots', 'reorder-rules'].map((c) => (
          <button key={c} type="button" className="btn btn-secondary btn-sm" onClick={() => download(c)}>
            {language === 'ar' ? `تصدير ${c}` : `Export ${c}`}
          </button>
        ))}
      </div>

      <textarea
        className="textarea min-h-[10rem] font-mono text-xs"
        placeholder="externalId,sku,barcode,nameEn,costPrice,onHand"
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
      />

      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary" disabled={!csvText || importMut.isPending} onClick={() => importMut.mutate(true)}>
          {language === 'ar' ? 'معاينة (dry-run)' : 'Dry-run'}
        </button>
        <button type="button" className="btn btn-primary" disabled={!csvText || importMut.isPending} onClick={() => importMut.mutate(false)}>
          {language === 'ar' ? 'تنفيذ الاستيراد' : 'Commit import'}
        </button>
      </div>

      {result && (
        <pre className="overflow-auto rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-dark-600 dark:bg-dark-800">
          {JSON.stringify(result, null, 2)}
        </pre>
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
    onError: (e) => toast.error(e.response?.data?.error || e.message),
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
