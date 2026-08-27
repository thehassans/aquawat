import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { MoreVertical, Plus, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import { InventoryIeButtons } from '../../../components/inventory/ImportExportDialog'
import { invTableClass, invTableWrapClass, invThClass, invTdClass } from '../inventoryUi'
import { PortalDropdown } from '../PortalDropdown'

const MODE_META = {
  always: { en: 'Instantly (Always)', ar: 'فوري (دائماً)' },
  dynamic: { en: 'Dynamically', ar: 'ديناميكي' },
  never: { en: 'Never (filter only)', ar: 'أبداً (تصفية فقط)' },
}

function modeLabel(mode, ar) {
  const key = mode || 'always'
  const m = MODE_META[key] || MODE_META.always
  return ar ? m.ar : m.en
}

function attrDisplayName(a, ar) {
  return ar && a.nameAr ? a.nameAr : a.name
}

function RowActionsMenu({ ar, onEdit, onDelete, deleting }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-dark-700 dark:hover:text-slate-100"
        aria-label={ar ? 'إجراءات' : 'Actions'}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="end">
        <button
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-dark-700"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            onEdit()
          }}
        >
          {ar ? 'تعديل' : 'Edit'}
        </button>
        <button
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2 text-start text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/30"
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            onDelete()
          }}
        >
          {ar ? 'حذف' : 'Delete'}
        </button>
      </PortalDropdown>
    </>
  )
}

/**
 * Full-width master list of product attributes — bulk select, IE, row actions.
 */
export default function AttributesList() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['inv-attributes'],
    queryFn: () => api.get('/stock/attributes', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
  })
  const attrs = data || []

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return attrs
    return attrs.filter((a) => {
      const hay = [a.name, a.nameAr, a.createVariantMode, a.displayType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [attrs, q])

  const filteredIds = useMemo(() => filtered.map((a) => String(a._id)), [filtered])
  const selectedRows = useMemo(
    () => filteredIds.filter((id) => selected.has(id)),
    [filteredIds, selected],
  )
  const allPageSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const somePageSelected = filteredIds.some((id) => selected.has(id)) && !allPageSelected

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/stock/attributes/${id}`),
  })

  const toggleOne = (id, e) => {
    e?.stopPropagation?.()
    const key = String(id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        filteredIds.forEach((id) => next.delete(id))
      } else {
        filteredIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const confirmDelete = (names) => {
    const label = names.length === 1
      ? (ar ? `حذف السمة «${names[0]}»؟` : `Delete attribute "${names[0]}"?`)
      : (ar ? `حذف ${names.length} سمات محددة؟` : `Delete ${names.length} selected attributes?`)
    return window.confirm(label)
  }

  const runDeletes = async (ids) => {
    const idList = ids.map(String)
    const nameById = new Map(attrs.map((a) => [String(a._id), attrDisplayName(a, ar)]))
    if (!confirmDelete(idList.map((id) => nameById.get(id) || id))) return

    let ok = 0
    for (const id of idList) {
      try {
        await deleteMut.mutateAsync(id)
        ok += 1
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (e) {
        toast.error(formatInvError(e, language))
      }
    }
    if (ok) {
      toast.success(ar ? `تم حذف ${ok}` : `Deleted ${ok}`)
      qc.invalidateQueries({ queryKey: ['inv-attributes'] })
    }
  }

  const goDetail = (id) => {
    navigate(`/app/dashboard/inventory/attributes/${id}`)
  }

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {ar ? 'سمات المنتج' : 'Product attributes'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {ar
            ? 'عرّف السمات وقيمها لتوليد مصفوفة المتغيرات.'
            : 'Define attributes and values for the variant generation matrix.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm text-slate-800 shadow-sm outline-none focus:border-sky-600/40 focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث بالاسم…' : 'Search by name…'}
          />
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {selectedRows.length > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
              disabled={deleteMut.isPending}
              onClick={() => runDeletes(selectedRows)}
            >
              <Trash2 className="h-4 w-4" />
              {ar ? `حذف المحدد (${selectedRows.length})` : `Delete Selected (${selectedRows.length})`}
            </button>
          ) : (
            <InventoryIeButtons
              model="product_attributes"
              ar={ar}
              onImported={() => qc.invalidateQueries({ queryKey: ['inv-attributes'] })}
            />
          )}
          <Link
            to="/app/dashboard/inventory/attributes/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {ar ? 'سمة جديدة' : 'New attribute'}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !filtered.length ? (
        <EmptyState
          title={ar ? 'لا سمات' : 'No attributes'}
          description={ar ? 'أنشئ سمة لبدء مصفوفة المتغيرات' : 'Create an attribute to start the variant matrix'}
        />
      ) : (
        <div className={invTableWrapClass}>
          <table className={`${invTableClass} min-w-[720px]`}>
            <thead className="border-b border-slate-100 bg-slate-50/80 text-start text-xs uppercase tracking-wide text-slate-500 dark:border-dark-600 dark:bg-dark-900/50">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected
                    }}
                    onChange={toggleAll}
                    aria-label={ar ? 'تحديد الكل' : 'Select all'}
                  />
                </th>
                <th className={invThClass}>{ar ? 'اسم السمة' : 'Attribute name'}</th>
                <th className={invThClass}>{ar ? 'وضع إنشاء المتغير' : 'Variant creation mode'}</th>
                <th className={`${invThClass} text-end`}>{ar ? 'عدد القيم' : 'Total values'}</th>
                <th className="min-w-[72px] px-3 py-3 text-end">{ar ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const id = String(a._id)
                const isChecked = selected.has(id)
                return (
                  <tr
                    key={id}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-700/40"
                    onClick={() => goDetail(id)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={isChecked}
                        onChange={(e) => toggleOne(id, e)}
                        aria-label={ar ? 'تحديد الصف' : 'Select row'}
                      />
                    </td>
                    <td className={invTdClass}>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {attrDisplayName(a, ar)}
                      </span>
                      {a.nameAr && !ar ? (
                        <div className="text-xs text-slate-400">{a.nameAr}</div>
                      ) : null}
                      {a.name && ar && a.nameAr ? (
                        <div className="text-xs text-slate-400">{a.name}</div>
                      ) : null}
                    </td>
                    <td className={`${invTdClass} text-slate-600 dark:text-slate-300`}>
                      {modeLabel(a.createVariantMode || (a.createVariant === false ? 'never' : 'always'), ar)}
                    </td>
                    <td className={`${invTdClass} text-end tabular-nums font-semibold text-slate-800 dark:text-slate-100`}>
                      {a.valueCount ?? 0}
                    </td>
                    <td className="px-3 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        ar={ar}
                        deleting={deleteMut.isPending}
                        onEdit={() => goDetail(id)}
                        onDelete={() => runDeletes([id])}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
