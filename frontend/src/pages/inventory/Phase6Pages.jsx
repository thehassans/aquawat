import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import EmptyState from '../../components/ui/EmptyState'

export default function ReportingHub() {
  const { language } = useSelector((s) => s.ui)
  const links = [
    { to: '/app/dashboard/inventory/moves-analysis', en: 'Moves Analysis', ar: 'تحليل الحركات' },
    { to: '/app/dashboard/inventory/performance', en: 'Performance', ar: 'الأداء' },
    { to: '/app/dashboard/inventory/forecast', en: 'Forecast', ar: 'التوقع' },
    { to: '/app/dashboard/inventory/valuation', en: 'Valuation', ar: 'التقييم' },
    { to: '/app/dashboard/inventory/moves', en: 'Moves History', ar: 'سجل الحركات' },
    { to: '/app/dashboard/inventory/stock', en: 'Stock Report', ar: 'تقرير المخزون' },
  ]
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'التقارير' : 'Reporting'}
        </h2>
        <p className="text-sm text-slate-500">
          {language === 'ar' ? 'تحليل الحركات والأداء والتقييم' : 'Moves, performance, forecast, and valuation'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-xl border border-slate-200/80 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-primary-300 hover:bg-primary-50/40 dark:border-dark-600 dark:text-slate-100 dark:hover:bg-dark-800"
          >
            {language === 'ar' ? l.ar : l.en}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function MovesAnalysisPage() {
  const { language } = useSelector((s) => s.ui)
  const [groupBy, setGroupBy] = useState('product')

  const { data, isLoading } = useQuery({
    queryKey: ['moves-analysis', groupBy],
    queryFn: () =>
      api.get('/stock/report/moves-analysis', { params: { groupBy } }).then((r) => r.data),
  })

  const items = data?.items || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {language === 'ar' ? 'تحليل الحركات' : 'Moves Analysis'}
        </h2>
        <select className="select select-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="product">{language === 'ar' ? 'حسب المنتج' : 'By product'}</option>
          <option value="day">{language === 'ar' ? 'حسب اليوم' : 'By day'}</option>
          <option value="partner">{language === 'ar' ? 'حسب الشريك' : 'By partner'}</option>
        </select>
      </div>
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
    </div>
  )
}

export function PerformancePage() {
  const { language } = useSelector((s) => s.ui)
  const { data, isLoading } = useQuery({
    queryKey: ['inv-performance'],
    queryFn: () => api.get('/stock/report/performance').then((r) => r.data),
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {language === 'ar' ? 'أداء المخزون' : 'Inventory Performance'}
      </h2>
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
    </div>
  )
}

export function ForecastPage() {
  const { language } = useSelector((s) => s.ui)
  const { data, isLoading } = useQuery({
    queryKey: ['inv-forecast-report'],
    queryFn: () => api.get('/stock/report/forecast').then((r) => r.data),
  })
  const items = data?.items || []

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {language === 'ar' ? 'المخزون المتوقع' : 'Forecasted Inventory'}
      </h2>
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
    </div>
  )
}

export function InventorySettingsPage() {
  const { language } = useSelector((s) => s.ui)
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['stock-settings'],
    queryFn: () => api.get('/stock/settings').then((r) => r.data),
  })

  const [form, setForm] = useState(null)
  const current = form || settings || {}

  const saveMut = useMutation({
    mutationFn: (body) => api.patch('/stock/settings', body),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved')
      qc.invalidateQueries({ queryKey: ['stock-settings'] })
      setForm(null)
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const ensureAcc = useMutation({
    mutationFn: () => api.post('/stock/accounting/ensure-accounts'),
    onSuccess: () => toast.success(language === 'ar' ? 'تم تجهيز الحسابات' : 'Stock accounts ready'),
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  })

  const toggle = (key) => {
    setForm({ ...current, [key]: !current[key] })
  }

  const setNum = (key, v) => setForm({ ...current, [key]: Number(v) })

  if (isLoading && !settings) return <div className="text-sm text-slate-500">…</div>

  const flags = [
    { key: 'engineEnabled', en: 'Inventory engine', ar: 'محرك المخزون' },
    { key: 'stockAccountingEnabled', en: 'Stock accounting journals', ar: 'قيود تقييم المخزون' },
    { key: 'schedulerEnabled', en: 'Scheduler enabled', ar: 'تفعيل المجدول' },
    { key: 'groupStockTrackingLot', en: 'Lots & serials', ar: 'دفعات وأرقام تسلسلية' },
    { key: 'moduleProductExpiry', en: 'Expiration dates', ar: 'تواريخ الصلاحية' },
    { key: 'showLotsOnDeliverySlips', en: 'Show lots on delivery slips', ar: 'إظهار الدفعات في التسليم' },
    { key: 'showLotsOnInvoices', en: 'Show lots on invoices', ar: 'إظهار الدفعات في الفواتير' },
    { key: 'receptionReportEnabled', en: 'Reception report', ar: 'تقرير الاستلام' },
    { key: 'emailConfirmationOnDelivery', en: 'Email on delivery', ar: 'بريد عند التسليم' },
    { key: 'signatureOnDelivery', en: 'Signature on delivery', ar: 'توقيع عند التسليم' },
    { key: 'enforceWarehouseRestriction', en: 'Enforce warehouse restriction', ar: 'تقييد المستودع' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {language === 'ar' ? 'إعدادات المخزون' : 'Inventory Settings'}
          </h2>
          <p className="text-sm text-slate-500">
            {language === 'ar' ? 'مفاتيح الميزات ومواعيد الجرد والمهل' : 'Feature flags, count calendar, lead times'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ensureAcc.mutate()}>
            {language === 'ar' ? 'تجهيز حسابات المخزون' : 'Ensure stock accounts'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMut.isPending || !form}
            onClick={() => saveMut.mutate(form)}
          >
            {language === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>

      <section className="grid gap-2 rounded-xl border border-slate-200/80 p-4 dark:border-dark-600 sm:grid-cols-2">
        {flags.map((f) => (
          <label key={f.key} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-primary-600"
              checked={!!current[f.key]}
              onChange={() => toggle(f.key)}
            />
            <span className="text-slate-800 dark:text-slate-200">{language === 'ar' ? f.ar : f.en}</span>
          </label>
        ))}
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200/80 p-4 dark:border-dark-600 md:grid-cols-3">
        {[
          { key: 'securityLeadTimeSales', en: 'Security lead (sales)', ar: 'مهلة أمان المبيعات' },
          { key: 'securityLeadTimePurchase', en: 'Security lead (purchase)', ar: 'مهلة أمان الشراء' },
          { key: 'daysToPurchase', en: 'Days to purchase', ar: 'أيام حتى الشراء' },
          { key: 'annualInventoryDay', en: 'Annual count day', ar: 'يوم الجرد السنوي' },
          { key: 'annualInventoryMonth', en: 'Annual count month', ar: 'شهر الجرد السنوي' },
        ].map((f) => (
          <div key={f.key}>
            <label className="label text-xs">{language === 'ar' ? f.ar : f.en}</label>
            <input
              type="number"
              className="input input-sm"
              value={current[f.key] ?? 0}
              onChange={(e) => setNum(f.key, e.target.value)}
            />
          </div>
        ))}
      </section>

      <p className="text-xs text-slate-500">
        <Link to="/app/dashboard/inventory/import-export" className="text-primary-600 hover:underline">
          {language === 'ar' ? 'استيراد / تصدير' : 'Import / Export'}
        </Link>
        {' · '}
        <Link to="/app/dashboard/inventory/barcode" className="text-primary-600 hover:underline">
          {language === 'ar' ? 'تسمية الباركود' : 'Barcode nomenclature'}
        </Link>
      </p>
    </div>
  )
}

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
            ? 'الكميات المستوردة تُحفظ كجرد محسوب فقط — طبّق من الجرد الفعلي'
            : 'Imported quantities become counted stock only — apply via Physical Inventory'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="select select-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">{language === 'ar' ? 'مستودع (لجرد الاستيراد)' : 'Warehouse (for count import)'}</option>
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
        placeholder="externalId,sku,nameEn,costPrice,countedQty"
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
