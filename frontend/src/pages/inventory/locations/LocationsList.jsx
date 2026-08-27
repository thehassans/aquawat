import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ChevronDown, ChevronRight, Plus, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import { InventoryIeButtons } from '../../../components/inventory/ImportExportDialog'
import { invTableClass, invThClass, invTdClass } from '../inventoryUi'
import { buildLocationForest, flattenLocationTree } from './locationTree'

const USAGE_META = {
  view: { en: 'View', ar: 'عرض' },
  internal: { en: 'Internal Location', ar: 'موقع داخلي' },
  vendor: { en: 'Vendor Location', ar: 'موقع المورد' },
  customer: { en: 'Customer Location', ar: 'موقع العميل' },
  inventoryLoss: { en: 'Inventory Loss', ar: 'فاقد المخزون' },
  scrap: { en: 'Inventory Loss', ar: 'فاقد المخزون' },
  production: { en: 'Production', ar: 'الإنتاج' },
  transit: { en: 'Transit Location', ar: 'موقع العبور' },
}

function usageLabel(usage, ar) {
  const m = USAGE_META[usage] || { en: usage || '—', ar: usage || '—' }
  return ar ? m.ar : m.en
}

/**
 * Hierarchical collapsible tree-grid of storage locations.
 */
export default function LocationsList() {
  const { language } = useSelector((s) => s.ui)
  const auth = useSelector((s) => s.auth)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())
  const [didInitExpand, setDidInitExpand] = useState(false)

  const companyName = auth?.user?.tenant?.name
    || auth?.tenant?.name
    || auth?.user?.companyName
    || (ar ? 'الشركة' : 'Company')

  const { data, isLoading } = useQuery({
    queryKey: ['inv-locations'],
    queryFn: () => api.get('/stock/locations', { params: { active: 'false' } }).then((r) => asInvList(r.data)),
  })

  const flat = data || []
  const forest = useMemo(() => buildLocationForest(flat), [flat])
  const visible = useMemo(() => flattenLocationTree(forest, expanded), [forest, expanded])

  useEffect(() => {
    if (didInitExpand || !forest.length) return
    // Expand top-level parents by default
    setExpanded(new Set(forest.filter((n) => n.children?.length).map((n) => String(n._id))))
    setDidInitExpand(true)
  }, [forest, didInitExpand])

  const visibleIds = useMemo(() => visible.map((r) => String(r._id)), [visible])
  const selectedRows = useMemo(() => [...selected].filter((id) => flat.some((r) => String(r._id) === id)), [selected, flat])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = visibleIds.some((id) => selected.has(id)) && !allVisibleSelected

  const toggleExpand = (id, e) => {
    e?.stopPropagation?.()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleOne = (id, e) => {
    e?.stopPropagation?.()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  const printLabels = async () => {
    if (!selectedRows.length) {
      toast.error(ar ? 'حدد مواقع لطباعة الملصقات' : 'Select locations to print labels')
      return
    }
    try {
      const res = await api.post('/stock/print', {
        layout: 'location_label',
        locationIds: selectedRows.slice(0, 200),
        lang: ar ? 'ar' : 'en',
      }, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'location-labels.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(formatInvError(e, language))
    }
  }

  return (
    <div className="flex h-screen max-h-screen flex-col gap-3 overflow-hidden" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'المواقع' : 'Locations'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'شجرة مواقع تخزين هرمية — مواقع العرض مجلدات افتراضية فقط.'
              : 'Relational location hierarchy — View locations are virtual folders only.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InventoryIeButtons
            model="locations"
            ar={ar}
            filters={selectedRows.length ? { ids: selectedRows } : {}}
            exportDisabled={!selectedRows.length}
            onImported={() => qc.invalidateQueries({ queryKey: ['inv-locations'] })}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!selectedRows.length}
            onClick={printLabels}
            title={!selectedRows.length ? (ar ? 'حدد صفوفاً' : 'Select rows') : undefined}
          >
            <Printer className="h-4 w-4" />
            {ar
              ? `ملصقات${selectedRows.length ? ` (${selectedRows.length})` : ''}`
              : `Labels${selectedRows.length ? ` (${selectedRows.length})` : ''}`}
          </button>
          <Link to="/app/dashboard/inventory/locations/new" className="btn btn-primary btn-sm">
            <Plus className="h-4 w-4" />
            {ar ? 'موقع' : 'Location'}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !flat.length ? (
        <EmptyState
          title={ar ? 'لا مواقع' : 'No locations'}
          description={ar ? 'فعّل المحرك أو أضف موقعاً' : 'Enable the engine or add a location'}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-dark-600 dark:bg-dark-800">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className={`${invTableClass} min-w-[860px]`}>
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-start text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected
                      }}
                      onChange={toggleAllVisible}
                      aria-label={ar ? 'تحديد الكل' : 'Select all'}
                    />
                  </th>
                  <th className={invThClass}>{ar ? 'اسم الموقع' : 'Location name'}</th>
                  <th className={invThClass}>{ar ? 'نوع الموقع' : 'Location type'}</th>
                  <th className={invThClass}>{ar ? 'الشركة' : 'Company'}</th>
                  <th className={invThClass}>{ar ? 'الباركود' : 'Barcode'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((loc) => {
                  const id = String(loc._id)
                  const pad = loc.depth * 18
                  return (
                    <tr
                      key={id}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-700/40"
                      onClick={() => navigate(`/app/dashboard/inventory/locations/${id}/edit`)}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selected.has(id)}
                          onChange={(e) => toggleOne(id, e)}
                          aria-label={ar ? 'تحديد الصف' : 'Select row'}
                        />
                      </td>
                      <td className={invTdClass}>
                        <div className="flex items-center gap-1" style={{ paddingInlineStart: pad }}>
                          {loc.hasChildren ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-700"
                              onClick={(e) => toggleExpand(id, e)}
                              aria-label={loc.expanded ? 'Collapse' : 'Expand'}
                            >
                              {loc.expanded
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="inline-block h-7 w-7 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {ar && loc.nameAr ? loc.nameAr : loc.name}
                          </span>
                          {loc.usage === 'view' ? (
                            <span className="ms-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {ar ? 'مجلد' : 'Folder'}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${invTdClass} text-slate-600 dark:text-slate-300`}>
                        {usageLabel(loc.usage, ar)}
                      </td>
                      <td className={`${invTdClass} text-slate-600 dark:text-slate-300`}>{companyName}</td>
                      <td className={`${invTdClass} font-mono text-xs text-slate-500`}>
                        {loc.barcode || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
