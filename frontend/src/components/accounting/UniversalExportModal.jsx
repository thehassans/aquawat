import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, GripVertical, Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { buildDefaultFileName, exportToCsv, exportToExcel } from '../../lib/export'

const TEMPLATE_KEY = 'maqder:export-templates:'

/**
 * Universal Export Data modal — dual-list field picker (Odoo-style).
 * Trigger from any list view after selecting rows (or export all via getRows).
 */
export default function UniversalExportModal({
  open,
  onClose,
  language = 'en',
  title,
  fileBaseName = 'export',
  availableFields = [],
  getRows,
  rows,
  entityKey = 'default',
}) {
  const isAr = language === 'ar'
  const [format, setFormat] = useState('xlsx')
  const [query, setQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState(() => availableFields.slice(0, 6).map((f) => f.key))
  const [exporting, setExporting] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const templates = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`${TEMPLATE_KEY}${entityKey}`) || '[]')
    } catch {
      return []
    }
  }, [entityKey, open])

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return availableFields.filter((f) => {
      if (selectedKeys.includes(f.key)) return false
      if (!q) return true
      return String(f.label || f.key).toLowerCase().includes(q)
    })
  }, [availableFields, selectedKeys, query])

  const selectedFields = useMemo(
    () => selectedKeys.map((k) => availableFields.find((f) => f.key === k)).filter(Boolean),
    [selectedKeys, availableFields],
  )

  const addField = (key) => setSelectedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
  const removeField = (key) => setSelectedKeys((prev) => prev.filter((k) => k !== key))
  const moveField = (from, to) => {
    setSelectedKeys((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const saveTemplate = () => {
    const name = templateName.trim() || (isAr ? 'قالب' : 'Template')
    const next = [{ name, keys: selectedKeys }, ...templates.filter((t) => t.name !== name)].slice(0, 12)
    localStorage.setItem(`${TEMPLATE_KEY}${entityKey}`, JSON.stringify(next))
    toast.success(isAr ? 'تم حفظ القالب' : 'Template saved')
    setTemplateName('')
  }

  const loadTemplate = (keys) => {
    if (Array.isArray(keys)) setSelectedKeys(keys.filter((k) => availableFields.some((f) => f.key === k)))
  }

  const resolveRows = async () => {
    if (typeof getRows === 'function') {
      const r = await getRows()
      return Array.isArray(r) ? r : []
    }
    return Array.isArray(rows) ? rows : []
  }

  const runExport = async () => {
    if (!selectedFields.length) {
      toast.error(isAr ? 'اختر حقولاً للتصدير' : 'Select fields to export')
      return
    }
    try {
      setExporting(true)
      const data = await resolveRows()
      const columns = selectedFields.map((f) => ({
        key: f.key,
        label: f.label,
        value: f.value,
      }))
      const base = buildDefaultFileName(fileBaseName)
      if (format === 'csv') {
        exportToCsv({ fileName: base, rows: data, columns })
      } else {
        await exportToExcel({ fileName: base, rows: data, columns, sheetName: String(fileBaseName || 'Export') })
      }
      toast.success(isAr ? 'تم التصدير' : 'Exported')
      onClose?.()
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#12161d]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {title || (isAr ? 'تصدير البيانات' : 'Export Data')}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAr ? 'اختر الحقول والترتيب والصيغة' : 'Choose fields, order, and format'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/10">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{isAr ? 'الصيغة' : 'Format'}</span>
          {[['xlsx', 'XLSX'], ['csv', 'CSV']].map(([id, label]) => (
            <label key={id} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${format === id ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 text-slate-600 dark:border-white/10'}`}>
              <input type="radio" className="sr-only" checked={format === id} onChange={() => setFormat(id)} />
              {label}
            </label>
          ))}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-dark-800"
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((x) => x.name === e.target.value)
                if (t) loadTemplate(t.keys)
                e.target.value = ''
              }}
            >
              <option value="">{isAr ? 'قالب…' : 'Template…'}</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={isAr ? 'اسم القالب' : 'Template name'}
              className="w-28 rounded-xl border border-slate-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-dark-800"
            />
            <button type="button" onClick={saveTemplate} className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-semibold dark:border-white/10">
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-slate-100 md:border-b-0 md:border-e dark:border-white/10">
            <div className="border-b border-slate-100 px-4 py-2 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{isAr ? 'الحقول المتاحة' : 'Available fields'}</p>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 py-1.5 pe-2 ps-8 text-xs dark:border-white/10 dark:bg-dark-900" placeholder={isAr ? 'بحث…' : 'Search…'} />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {available.map((f) => (
                <li key={f.key}>
                  <button type="button" onClick={() => addField(f.key)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                    <span>{f.label}</span>
                    <Plus className="h-3.5 w-3.5 text-emerald-600" />
                  </button>
                </li>
              ))}
              {!available.length ? <li className="px-3 py-6 text-center text-xs text-slate-400">{isAr ? 'لا حقول' : 'No fields'}</li> : null}
            </ul>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-4 py-2 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{isAr ? 'الحقول للتصدير' : 'Fields to export'}</p>
              <p className="mt-1 text-[10px] text-slate-400">{isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}</p>
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {selectedFields.map((f, index) => (
                <li
                  key={f.key}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = Number(e.dataTransfer.getData('text/plain'))
                    if (!Number.isNaN(from)) moveField(from, index)
                  }}
                  className="mb-1 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-sm dark:border-white/5 dark:bg-white/[0.03]"
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  <button type="button" onClick={() => removeField(f.key)} className="rounded p-1 text-slate-400 hover:bg-white dark:hover:bg-white/10">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {!selectedFields.length ? <li className="px-3 py-6 text-center text-xs text-slate-400">{isAr ? 'أضف حقولاً من اليسار' : 'Add fields from the left'}</li> : null}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/10">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={exporting || !selectedFields.length}
            onClick={runExport}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {exporting ? '…' : (isAr ? 'تصدير' : 'Export')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
