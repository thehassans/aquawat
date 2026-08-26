import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { formatInvError, pickApiErrorPayload } from '../../lib/invError'

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Shared Inventory Import / Export shell (v3 §2.2).
 *
 * @param {object} props
 * @param {'export'|'import'} props.mode
 * @param {string} props.model — IE registry key (products, locations, stock, …)
 * @param {boolean} [props.importable] — override; false disables import with tooltip
 * @param {object} [props.filters] — current list filters (search, warehouseId, …)
 * @param {string} [props.warehouseId] — for location/product opening imports
 * @param {() => void} props.onClose
 * @param {() => void} [props.onImported]
 * @param {boolean} [props.ar]
 */
export default function ImportExportDialog({
  mode = 'export',
  model,
  importable: importableProp,
  filters = {},
  warehouseId,
  onClose,
  onImported,
  ar = false,
}) {
  const qc = useQueryClient()
  const [importCompatible, setImportCompatible] = useState(mode === 'import')
  const [format, setFormat] = useState('xlsx')
  const [selected, setSelected] = useState([])
  const [fieldSearch, setFieldSearch] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [jobId, setJobId] = useState(null)
  const [filePayload, setFilePayload] = useState({ name: '', csvText: '', xlsxBase64: null, headers: [] })
  const [columnMap, setColumnMap] = useState({})
  const [report, setReport] = useState(null)
  const [whForImport, setWhForImport] = useState(warehouseId || '')

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-lite-ie'],
    queryFn: () => api.get('/warehouses').then((r) => r.data?.warehouses || r.data || []),
    enabled: mode === 'import' && (model === 'locations' || model === 'products'),
    staleTime: 10 * 60 * 1000,
  })

  const { data: fieldsPayload } = useQuery({
    queryKey: ['ie-fields', model, importCompatible],
    queryFn: () =>
      api
        .get(`/stock/ie/models/${model}/fields`, {
          params: { importCompatible: importCompatible ? '1' : undefined },
        })
        .then((r) => r.data),
    enabled: Boolean(model),
  })

  const importable = importableProp ?? fieldsPayload?.importable !== false
  const available = useMemo(() => fieldsPayload?.fields || [], [fieldsPayload])

  const { data: templatesPayload } = useQuery({
    queryKey: ['ie-templates', model],
    queryFn: () => api.get('/stock/ie/templates', { params: { model } }).then((r) => r.data),
    enabled: Boolean(model),
  })
  const templates = templatesPayload?.items || []

  useEffect(() => {
    if (!fieldsPayload) return
    const defaults = fieldsPayload.defaultExport || []
    const allowed = new Set((fieldsPayload.fields || []).map((f) => f.path || f.key))
    const next = (defaults.length ? defaults : (fieldsPayload.fields || []).slice(0, 8).map((f) => f.path))
      .filter((k) => allowed.has(k))
    setSelected((prev) => (prev.length ? prev.filter((k) => allowed.has(k)) : next))
  }, [fieldsPayload])

  const filteredAvailable = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase()
    const picked = new Set(selected)
    return available.filter((f) => {
      const key = f.path || f.key
      if (picked.has(key)) return false
      if (!q) return true
      return `${f.label} ${key}`.toLowerCase().includes(q)
    })
  }, [available, selected, fieldSearch])

  const addField = (key) => setSelected((s) => (s.includes(key) ? s : [...s, key]))
  const removeField = (key) => setSelected((s) => s.filter((k) => k !== key))
  const moveField = (key, dir) => {
    setSelected((s) => {
      const i = s.indexOf(key)
      if (i < 0) return s
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const saveTpl = useMutation({
    mutationFn: () =>
      api.post('/stock/ie/templates', {
        model,
        name: templateName.trim(),
        fields: selected,
        importCompatible,
      }),
    onSuccess: () => {
      toast.success(ar ? 'تم حفظ القالب' : 'Template saved')
      qc.invalidateQueries({ queryKey: ['ie-templates', model] })
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  const deleteTpl = useMutation({
    mutationFn: (id) => api.delete(`/stock/ie/templates/${id}`),
    onSuccess: () => {
      setTemplateId('')
      qc.invalidateQueries({ queryKey: ['ie-templates', model] })
    },
  })

  const exportMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/stock/ie/export', {
        model,
        fields: selected,
        importCompatible,
        format,
        filters,
        download: false,
      })
      return res.data
    },
    onSuccess: (result) => {
      if (result.async) {
        setJobId(result.jobId)
        toast.success(ar ? 'التصدير في الخلفية…' : 'Export queued in background…')
        return
      }
      let blob
      if (result.encoding === 'base64') {
        const bin = atob(result.payload)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
        blob = new Blob([bytes], { type: result.mime })
      } else {
        blob = new Blob([result.payload], { type: result.mime || 'text/csv;charset=utf-8' })
      }
      downloadBlob(blob, result.filename || `${model}-export.${format}`)
      toast.success(ar ? `تم التصدير (${result.rowCount} صف)` : `Exported (${result.rowCount} rows)`)
      onClose?.()
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  const { data: job } = useQuery({
    queryKey: ['ie-export-job', jobId],
    queryFn: () => api.get(`/stock/ie/export/jobs/${jobId}`).then((r) => r.data),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const st = q.state.data?.status
      return st === 'done' || st === 'failed' ? false : 1500
    },
  })

  useEffect(() => {
    if (!jobId || job?.status !== 'done') return
    ;(async () => {
      try {
        const res = await api.get(`/stock/ie/export/jobs/${jobId}`, {
          params: { download: '1' },
          responseType: 'blob',
        })
        downloadBlob(res.data, job.filename || `${model}-export.${format}`)
        toast.success(ar ? `جاهز (${job.rowCount} صف)` : `Ready (${job.rowCount} rows)`)
        setJobId(null)
        onClose?.()
      } catch (e) {
        toast.error(formatInvError(e, ar ? 'ar' : 'en'))
      }
    })()
  }, [job?.status, jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const importMut = useMutation({
    mutationFn: (dryRun) =>
      api.post('/stock/ie/import', {
        model,
        csvText: filePayload.xlsxBase64 ? undefined : filePayload.csvText,
        xlsxBase64: filePayload.xlsxBase64 || undefined,
        columnMap,
        dryRun,
        warehouseId: whForImport || warehouseId || filters.warehouseId || undefined,
      }),
    onSuccess: (res, dryRun) => {
      setReport(res.data)
      if (dryRun) {
        toast.success(ar ? 'معاينة جاهزة' : 'Dry-run ready')
      } else {
        toast.success(ar ? 'تم الاستيراد' : 'Import committed')
        onImported?.()
        onClose?.()
      }
    },
    onError: (e) => toast.error(formatInvError(e, ar ? 'ar' : 'en')),
  })

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setReport(null)
    const lower = f.name.toLowerCase()
    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        setFilePayload({ name: f.name, csvText: '', xlsxBase64: await fileToBase64(f), headers: [] })
        setColumnMap({})
      } else {
        const text = await f.text()
        const headerLine = text.split(/\r?\n/)[0] || ''
        const headers = headerLine.split(',').map((h) => h.replace(/^"|"$/g, '').trim()).filter(Boolean)
        const map = {}
        headers.forEach((h) => {
          const match = available.find(
            (f) => f.path === h || f.key === h || f.label.toLowerCase() === h.toLowerCase(),
          )
          map[h] = match?.path || h
        })
        setFilePayload({ name: f.name, csvText: text, xlsxBase64: null, headers })
        setColumnMap(map)
      }
    } catch (err) {
      toast.error(err.message || 'File read failed')
    }
  }

  const downloadErrors = () => {
    if (report?.errorFileCsv) {
      downloadBlob(new Blob([report.errorFileCsv], { type: 'text/csv;charset=utf-8' }), report.errorFileName || `${model}-import-errors.csv`)
      return
    }
    const errs = report?.errors || []
    const lines = ['row,field,reason', ...errs.map((e) => `${e.row},"${e.field || ''}","${(e.reason || e.message || '').replace(/"/g, '""')}"`)]
    downloadBlob(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }), `${model}-import-errors.csv`)
  }

  const title = mode === 'export'
    ? (ar ? 'تصدير البيانات' : 'Export Data')
    : (ar ? 'استيراد البيانات' : 'Import Data')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-dark-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500">{fieldsPayload?.label || model}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            {ar ? 'إغلاق' : 'Close'}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {mode === 'export' && (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={importCompatible}
                  onChange={(e) => setImportCompatible(e.target.checked)}
                />
                {ar
                  ? 'أريد تحديث البيانات (تصدير متوافق مع الاستيراد)'
                  : 'I want to update data (import-compatible export)'}
              </label>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
                  XLSX
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} />
                  CSV
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1">
                  <label className="label text-xs">{ar ? 'قالب' : 'Template'}</label>
                  <select
                    className="select w-full"
                    value={templateId}
                    onChange={(e) => {
                      const id = e.target.value
                      setTemplateId(id)
                      const tpl = templates.find((t) => t._id === id)
                      if (tpl) {
                        setSelected(tpl.fields || [])
                        setImportCompatible(!!tpl.importCompatible)
                        setTemplateName(tpl.name)
                      }
                    }}
                  >
                    <option value="">—</option>
                    {templates.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <input
                  className="input min-w-[8rem] flex-1"
                  placeholder={ar ? 'اسم القالب' : 'Template name'}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={!templateName.trim() || !selected.length || saveTpl.isPending}
                  onClick={() => saveTpl.mutate()}
                >
                  {ar ? 'حفظ' : 'Save'}
                </button>
                {templateId && (
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => deleteTpl.mutate(templateId)}>
                    {ar ? 'حذف' : 'Delete'}
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-dark-600">
                  <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    {ar ? 'الحقول المتاحة' : 'Available fields'}
                  </div>
                  <input
                    className="input mb-2 w-full text-sm"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder={ar ? 'بحث…' : 'Search…'}
                  />
                  <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                    {filteredAvailable.map((f) => {
                      const key = f.path || f.key
                      const locked = f.locked || f.importable === false
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-slate-50 dark:hover:bg-dark-700"
                            onClick={() => addField(key)}
                          >
                            {f.group && (
                              <span className="me-1 text-[10px] uppercase text-slate-400">{f.group}</span>
                            )}
                            {locked && <span className="me-1 text-slate-400" title="Export only">🔒</span>}
                            {f.label}
                            <span className="ms-2 text-xs text-slate-400">{key}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-dark-600">
                  <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    {ar ? 'حقول التصدير' : 'Fields to export'}
                  </div>
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                    {selected.map((key) => {
                      const f = available.find((x) => (x.path || x.key) === key)
                      return (
                        <li key={key} className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 dark:bg-dark-700">
                          <span className="flex-1 truncate">{f?.label || key}</span>
                          <button type="button" className="text-xs text-slate-400" onClick={() => moveField(key, -1)}>↑</button>
                          <button type="button" className="text-xs text-slate-400" onClick={() => moveField(key, 1)}>↓</button>
                          <button type="button" className="text-xs text-rose-500" onClick={() => removeField(key)}>×</button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              {jobId && (
                <p className="text-sm text-amber-700">
                  {ar ? 'جاري التصدير في الخلفية…' : 'Background export running…'}{' '}
                  {job?.status || 'pending'}
                  {job?.error ? ` — ${pickApiErrorPayload(job.error, ar ? 'ar' : 'en') || ''}` : ''}
                </p>
              )}
            </>
          )}

          {mode === 'import' && (
            <>
              {!importable ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {ar
                    ? 'هذا النموذج للتصدير فقط — الاستيراد سيفسد دفتر الحركات.'
                    : 'This model is export-only — importing would corrupt the ledger.'}
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    {ar
                      ? 'المعاينة أولاً دائماً. عمود id أو external_ref يحدّث السجل؛ بدونهما إنشاء.'
                      : 'Dry-run first, always. id / external_ref updates; otherwise create.'}
                  </p>
                  {(model === 'locations' || model === 'products') && (
                    <div>
                      <label className="label text-xs">
                        {ar ? 'مستودع (افتتاحي / مواقع)' : 'Warehouse (opening / locations)'}
                      </label>
                      <select
                        className="select w-full"
                        value={whForImport}
                        onChange={(e) => setWhForImport(e.target.value)}
                      >
                        <option value="">—</option>
                        {(Array.isArray(warehouses) ? warehouses : []).map((w) => (
                          <option key={w._id} value={w._id}>{w.nameEn || w.name || w.code}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv"
                    className="block w-full text-sm"
                    onChange={onFile}
                  />
                  {filePayload.name && <p className="text-xs text-slate-400">{filePayload.name}</p>}

                  {filePayload.headers?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-dark-600">
                      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                        {ar ? 'تعيين الأعمدة' : 'Column mapping'}
                      </div>
                      <div className="space-y-2">
                        {filePayload.headers.map((h) => (
                          <div key={h} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-36 truncate text-slate-500">{h}</span>
                            <span className="text-slate-300">→</span>
                            <select
                              className="select flex-1"
                              value={columnMap[h] || h}
                              onChange={(e) => setColumnMap((m) => ({ ...m, [h]: e.target.value }))}
                            >
                              <option value={h}>{h}</option>
                              {available.map((f) => {
                                const key = f.path || f.key
                                return <option key={key} value={key}>{f.label}</option>
                              })}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report && (
                    <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-dark-600">
                      <div className="flex flex-wrap gap-3">
                        <span>{ar ? 'صفوف' : 'Rows'}: {report.totalRows ?? report.matched ?? '—'}</span>
                        <span>{ar ? 'إنشاء' : 'Create'}: {report.wouldCreate ?? report.created ?? 0}</span>
                        <span>{ar ? 'تحديث' : 'Update'}: {report.wouldUpdate ?? report.updated ?? 0}</span>
                        {report.costChanges != null && (
                          <span>{ar ? 'تغيير تكلفة' : 'Cost changes'}: {report.costChanges}</span>
                        )}
                        {report.variantCreates != null && (
                          <span>{ar ? 'متغيرات جديدة' : 'Variant creates'}: {report.variantCreates}</span>
                        )}
                        {report.variantUpdates != null && (
                          <span>{ar ? 'تحديث متغيرات' : 'Variant updates'}: {report.variantUpdates}</span>
                        )}
                        <span className="text-rose-600">{ar ? 'أخطاء' : 'Errors'}: {(report.errors || []).length}</span>
                      </div>
                      {(report.errors || []).slice(0, 6).map((err) => (
                        <div key={`${err.row}-${err.field}`} className="mt-1 text-xs text-rose-600">
                          Row {err.row}: {err.field} — {err.reason || err.message}
                        </div>
                      ))}
                      {(report.errors || []).length > 0 && (
                        <button type="button" className="mt-2 text-xs text-primary-600 hover:underline" onClick={downloadErrors}>
                          {ar ? 'تنزيل ملف الأخطاء' : 'Download error file'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-dark-600">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          {mode === 'export' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selected.length || exportMut.isPending}
              onClick={() => exportMut.mutate()}
            >
              {ar ? 'تصدير' : 'Export'}
            </button>
          )}
          {mode === 'import' && importable && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!(filePayload.csvText || filePayload.xlsxBase64) || importMut.isPending}
                onClick={() => importMut.mutate(true)}
              >
                {ar ? 'معاينة' : 'Dry run'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!report?.dryRun || importMut.isPending}
                onClick={() => {
                  const creates = Number(report?.wouldCreate ?? report?.created ?? 0)
                  const costChanges = Number(report?.costChanges ?? 0)
                  if (creates > 500 || costChanges > 50) {
                    const msg = ar
                      ? `تأكيد: سيتم إنشاء ${creates} صف وتغيير تكلفة ${costChanges} منتج. المتابعة؟`
                      : `Confirm: create ${creates} rows and change cost on ${costChanges} products. Continue?`
                    if (!window.confirm(msg)) return
                  }
                  importMut.mutate(false)
                }}
              >
                {ar ? 'تنفيذ' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Compact Import + Export toolbar buttons that open the shared dialog. */
export function InventoryIeButtons({
  model,
  importable,
  filters,
  warehouseId,
  ar = false,
  onImported,
  className = '',
}) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <button
          type="button"
          className="btn btn-secondary text-sm"
          title={!importable && importable !== undefined ? (ar ? 'تصدير فقط' : 'Export only') : undefined}
          onClick={() => setOpen('import')}
          disabled={importable === false}
        >
          {ar ? 'استيراد' : 'Import'}
        </button>
        <button type="button" className="btn btn-secondary text-sm" onClick={() => setOpen('export')}>
          {ar ? 'تصدير' : 'Export'}
        </button>
      </div>
      {open && (
        <ImportExportDialog
          mode={open}
          model={model}
          importable={importable}
          filters={filters}
          warehouseId={warehouseId}
          ar={ar}
          onClose={() => setOpen(null)}
          onImported={onImported}
        />
      )}
    </>
  )
}
