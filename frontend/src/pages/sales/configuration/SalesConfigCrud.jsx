import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import {
  fieldControlClass,
  fieldLabelClass,
  ghostActionClass,
  listShellClass,
  pageSubtitleClass,
  salesTableClass,
  salesTdClass,
  salesThClass,
  salesTrClass,
  sectionCardClass,
} from '../salesUi'

/**
 * Generic CRUD list for /api/sales/:resource endpoints returning { items }.
 */
export default function SalesConfigCrud({
  title,
  subtitle,
  apiPath,
  columns = [],
  fields = [],
  emptyLabel = 'No records yet',
}) {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [form, setForm] = useState({})
  const [editingId, setEditingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-config', apiPath],
    queryFn: async () => {
      const { data: res } = await api.get(apiPath)
      return res.items || res || []
    },
  })

  const items = useMemo(() => (Array.isArray(data) ? data : data?.items || []), [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { data: res } = await api.put(`${apiPath}/${editingId}`, form)
        return res
      }
      const { data: res } = await api.post(apiPath, form)
      return res
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
      setForm({})
      setEditingId(null)
      qc.invalidateQueries({ queryKey: ['sales-config', apiPath] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`${apiPath}/${id}`),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحذف' : 'Deleted')
      qc.invalidateQueries({ queryKey: ['sales-config', apiPath] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const startEdit = (row) => {
    setEditingId(row._id)
    const next = {}
    for (const f of fields) next[f.key] = row[f.key] ?? f.default ?? ''
    setForm(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className={pageSubtitleClass}>{subtitle}</p>}
      </div>

      <div className={sectionCardClass}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className={fieldLabelClass}>{f.label}</label>
              {f.type === 'select' ? (
                <select
                  className={fieldControlClass}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                >
                  {(f.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : f.type === 'color' ? (
                <input
                  type="color"
                  className={`${fieldControlClass} h-11 p-1`}
                  value={form[f.key] || '#14b8a6'}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  className={fieldControlClass}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {editingId ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إضافة' : 'Add')}
          </button>
          {editingId && (
            <button type="button" className={ghostActionClass} onClick={() => { setEditingId(null); setForm({}) }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      <div className={listShellClass}>
        <div className="overflow-x-auto">
          <table className={salesTableClass}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={salesThClass}>{c.label}</th>
                ))}
                <th className={salesThClass}>{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={columns.length + 1} className={salesTdClass}>{isAr ? 'جاري التحميل…' : 'Loading…'}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className={salesTdClass}>{emptyLabel}</td></tr>
              ) : items.map((row) => (
                <tr key={row._id} className={salesTrClass}>
                  {columns.map((c) => (
                    <td key={c.key} className={salesTdClass}>
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className={salesTdClass}>
                    <div className="flex gap-2">
                      <button type="button" className={ghostActionClass} onClick={() => startEdit(row)}>{isAr ? 'تعديل' : 'Edit'}</button>
                      <button type="button" className={ghostActionClass} onClick={() => deleteMutation.mutate(row._id)}>{isAr ? 'حذف' : 'Delete'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
