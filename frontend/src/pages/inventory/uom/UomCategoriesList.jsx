import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import { invTableClass, invTableWrapClass, invThClass, invTdClass } from '../inventoryUi'
import { ConfigModal } from '../ConfigModal'

const MEASURE_TYPES = [
  { value: 'unit', en: 'Units', ar: 'وحدات' },
  { value: 'weight', en: 'Weight', ar: 'وزن' },
  { value: 'volume', en: 'Volume', ar: 'حجم' },
  { value: 'length', en: 'Length', ar: 'طول' },
  { value: 'time', en: 'Time', ar: 'وقت' },
  { value: 'workingTime', en: 'Working Time', ar: 'وقت عمل' },
]

function measureLabel(type, ar) {
  const m = MEASURE_TYPES.find((t) => t.value === type)
  if (!m) return type || '—'
  return ar ? m.ar : m.en
}

/**
 * Master list of UoM categories — detail manages units + reference ratio.
 */
export default function UomCategoriesList() {
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', nameAr: '', measureType: 'unit' })

  const { data, isLoading } = useQuery({
    queryKey: ['inv-uom-categories'],
    queryFn: () => api.get('/stock/uom-categories').then((r) => asInvList(r.data)),
  })
  const cats = data || []

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return cats
    return cats.filter((c) => {
      const hay = [c.name, c.nameAr, c.measureType, c.referenceUom?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [cats, q])

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/uom-categories', form),
    onSuccess: (res) => {
      toast.success(ar ? 'تمت إضافة الفئة' : 'Category created')
      setModalOpen(false)
      setForm({ name: '', nameAr: '', measureType: 'unit' })
      qc.invalidateQueries({ queryKey: ['inv-uom-categories'] })
      const id = res.data?._id
      if (id) navigate(`/app/dashboard/inventory/uom/${id}`)
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  return (
    <div className="flex min-h-[60vh] flex-col gap-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {ar ? 'فئات وحدات القياس' : 'Units of Measure'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'كل فئة لها وحدة مرجعية واحدة واحدة التحويل دائماً نسبةً إليها.'
              : 'Each category has one reference unit; all ratios are relative to it.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/dashboard/inventory/product-packagings" className="btn btn-secondary btn-sm">
            {ar ? 'تعبئة المنتجات' : 'Product packagings'}
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {ar ? 'فئة جديدة' : 'New category'}
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-10 pe-3 text-sm outline-none focus:border-sky-600/40 focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-800"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? 'بحث…' : 'Search…'}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !filtered.length ? (
        <EmptyState
          title={ar ? 'لا فئات' : 'No categories'}
          description={ar ? 'أنشئ فئة مثل الوزن أو الحجم' : 'Create a category such as Weight or Volume'}
        />
      ) : (
        <div className={`${invTableWrapClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className={`${invTableClass} min-w-[640px]`}>
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-start text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
                <tr>
                  <th className={invThClass}>{ar ? 'الفئة' : 'Category'}</th>
                  <th className={invThClass}>{ar ? 'النوع' : 'Measure type'}</th>
                  <th className={invThClass}>{ar ? 'الوحدة المرجعية' : 'Reference unit'}</th>
                  <th className={`${invThClass} text-end`}>{ar ? 'الوحدات' : 'Units'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c._id}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-700/40"
                    onClick={() => navigate(`/app/dashboard/inventory/uom/${c._id}`)}
                  >
                    <td className={invTdClass}>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {ar && c.nameAr ? c.nameAr : c.name}
                      </span>
                      {c.nameAr && !ar ? <div className="text-xs text-slate-400">{c.nameAr}</div> : null}
                    </td>
                    <td className={`${invTdClass} text-slate-600 dark:text-slate-300`}>
                      {measureLabel(c.measureType, ar)}
                    </td>
                    <td className={`${invTdClass} text-slate-600 dark:text-slate-300`}>
                      {c.referenceUom
                        ? (ar && c.referenceUom.nameAr ? c.referenceUom.nameAr : c.referenceUom.name)
                        : <span className="text-slate-400">{ar ? '— غير معيّن —' : '— None —'}</span>}
                    </td>
                    <td className={`${invTdClass} text-end tabular-nums font-semibold`}>
                      {c.uomCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ar={ar}
        title={ar ? 'فئة وحدة قياس جديدة' : 'New UoM category'}
        subtitle={ar ? 'مثال: وزن، حجم، وقت عمل' : 'e.g. Weight, Volume, Working Time'}
        footer={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createMut.isPending || !form.name.trim()}
              onClick={() => createMut.mutate()}
            >
              {ar ? 'إنشاء' : 'Create'}
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          <div>
            <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={ar ? 'وزن' : 'Weight'}
              autoFocus
            />
          </div>
          <div>
            <label className="label text-xs">{ar ? 'الاسم بالعربي' : 'Arabic name'}</label>
            <input
              className="input"
              value={form.nameAr}
              onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
            />
          </div>
          <div>
            <label className="label text-xs">{ar ? 'نوع القياس' : 'Measure type'}</label>
            <select
              className="select"
              value={form.measureType}
              onChange={(e) => setForm((f) => ({ ...f, measureType: e.target.value }))}
            >
              {MEASURE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>
              ))}
            </select>
          </div>
        </div>
      </ConfigModal>
    </div>
  )
}
