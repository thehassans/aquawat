import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import EmptyState from '../../../components/ui/EmptyState'
import { invTableClass, invTableWrapClass } from '../inventoryUi'

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

/**
 * Full-width master list of product attributes.
 */
export default function AttributesList() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const [q, setQ] = useState('')

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

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <Link
          to="/app/dashboard/inventory/attributes/new"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          {ar ? 'سمة جديدة' : 'New attribute'}
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm text-slate-800 shadow-sm outline-none focus:border-sky-600/40 focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-800 dark:text-slate-100"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? 'بحث بالاسم…' : 'Search by name…'}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !filtered.length ? (
        <EmptyState
          title={ar ? 'لا سمات' : 'No attributes'}
          description={ar ? 'أنشئ سمة لبدء مصفوفة المتغيرات' : 'Create an attribute to start the variant matrix'}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_20px_50px_-32px_rgba(15,23,42,0.25)] dark:border-dark-600 dark:bg-dark-800">
          <div className={invTableWrapClass}>
            <table className={`${invTableClass} min-w-[720px]`}>
              <thead>
                <tr className="border-b border-slate-100 text-start text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-dark-600">
                  <th className="min-w-[200px] px-5 py-3">{ar ? 'اسم السمة' : 'Attribute name'}</th>
                  <th className="min-w-[180px] px-3 py-3">{ar ? 'وضع إنشاء المتغير' : 'Variant creation mode'}</th>
                  <th className="min-w-[120px] px-3 py-3 text-end">{ar ? 'عدد القيم' : 'Total values'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-dark-700">
                {filtered.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50/80 dark:hover:bg-dark-700/40">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/app/dashboard/inventory/attributes/${a._id}`}
                        className="font-semibold text-slate-900 hover:text-sky-800 hover:underline dark:text-slate-100"
                      >
                        {ar && a.nameAr ? a.nameAr : a.name}
                      </Link>
                      {a.nameAr && !ar ? (
                        <div className="text-xs text-slate-400">{a.nameAr}</div>
                      ) : null}
                      {a.name && ar && a.nameAr ? (
                        <div className="text-xs text-slate-400">{a.name}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                      {modeLabel(a.createVariantMode || (a.createVariant === false ? 'never' : 'always'), ar)}
                    </td>
                    <td className="px-3 py-3.5 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {a.valueCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
