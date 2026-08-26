import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { formatInvError } from '../../lib/invError'

function valueLabel(v, language) {
  if (!v) return '—'
  if (typeof v === 'string') return v
  return language === 'ar' && v.nameAr ? v.nameAr : (v.name || v.nameAr || v._id)
}

/**
 * Pick an attribute value → excluded values that cannot combine with it.
 */
export default function AttributeExclusionsEditor({
  productId,
  attributeLines = [],
  language = 'en',
}) {
  const ar = language === 'ar'
  const queryClient = useQueryClient()
  const [pickValueId, setPickValueId] = useState('')
  const [excludedIds, setExcludedIds] = useState([])

  const valueIdsOnTemplate = useMemo(() => {
    const ids = new Set()
    for (const line of attributeLines || []) {
      for (const id of line.valueIds || []) ids.add(String(id))
    }
    return [...ids]
  }, [attributeLines])

  const { data: allValues = [] } = useQuery({
    queryKey: ['inv-exclusion-value-labels', valueIdsOnTemplate.join(',')],
    queryFn: async () => {
      const byAttr = new Map()
      for (const line of attributeLines || []) {
        if (!line.attributeId) continue
        if (!byAttr.has(line.attributeId)) {
          const rows = await api
            .get(`/stock/attributes/${line.attributeId}/values`)
            .then((r) => asInvList(r.data))
          byAttr.set(line.attributeId, rows)
        }
      }
      const flat = []
      for (const rows of byAttr.values()) flat.push(...rows)
      return flat.filter((v) => valueIdsOnTemplate.includes(String(v._id)))
    },
    enabled: Boolean(productId) && valueIdsOnTemplate.length > 0,
  })

  const { data: exclusions = [], isLoading } = useQuery({
    queryKey: ['inv-exclusions', productId],
    queryFn: () =>
      api.get(`/stock/products/${productId}/exclusions`).then((r) => asInvList(r.data)),
    enabled: Boolean(productId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inv-exclusions', productId] })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/stock/exclusions', {
        templateId: productId,
        attributeValueId: pickValueId,
        excludedValueIds: excludedIds,
      }),
    onSuccess: () => {
      toast.success(ar ? 'تم حفظ الاستثناء' : 'Exclusion saved')
      setPickValueId('')
      setExcludedIds([])
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/stock/exclusions/${id}`),
    onSuccess: () => {
      toast.success(ar ? 'تم الحذف' : 'Removed')
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  if (!productId) return null

  const otherValues = allValues.filter((v) => String(v._id) !== String(pickValueId))

  return (
    <div className="space-y-3 border-t border-slate-200/80 pt-4 dark:border-dark-600">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          {ar ? 'استثناءات التركيب' : 'Attribute exclusions'}
        </h4>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {ar
            ? 'مثال: حرير لا يتوفر مع مقاس XXL — تُتخطى أثناء التوليد.'
            : 'Example: Silk cannot combine with XXL — skipped during generation.'}
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-100 p-3 dark:border-dark-600 md:grid-cols-3">
        <div>
          <label className="label">{ar ? 'القيمة' : 'Value'}</label>
          <select
            className="select"
            value={pickValueId}
            onChange={(e) => {
              setPickValueId(e.target.value)
              setExcludedIds([])
            }}
          >
            <option value="">{ar ? 'اختر…' : 'Pick…'}</option>
            {allValues.map((v) => (
              <option key={v._id} value={v._id}>{valueLabel(v, language)}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">{ar ? 'قيم مستبعدة' : 'Excluded values'}</label>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            {!pickValueId ? (
              <span className="text-xs text-slate-400">{ar ? 'اختر قيمة أولاً' : 'Pick a value first'}</span>
            ) : (
              otherValues.map((v) => {
                const on = excludedIds.includes(String(v._id))
                return (
                  <button
                    key={v._id}
                    type="button"
                    className={`rounded-lg border px-2 py-0.5 text-xs ${on ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-slate-200'}`}
                    onClick={() => {
                      const id = String(v._id)
                      setExcludedIds((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id]))
                    }}
                  >
                    {valueLabel(v, language)}
                  </button>
                )
              })
            )}
          </div>
        </div>
        <div className="md:col-span-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!pickValueId || excludedIds.length === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Plus className="h-4 w-4" /> {ar ? 'حفظ الاستثناء' : 'Save exclusion'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : exclusions.length === 0 ? (
        <p className="text-xs text-slate-400">{ar ? 'لا استثناءات بعد.' : 'No exclusions yet.'}</p>
      ) : (
        <ul className="space-y-1.5">
          {exclusions.map((ex) => (
            <li
              key={ex._id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-dark-600"
            >
              <span>
                <span className="font-medium">{valueLabel(ex.attributeValueId, language)}</span>
                <span className="mx-1 text-slate-400">≠</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {(ex.excludedValueIds || []).map((v) => valueLabel(v, language)).join(', ')}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-red-600"
                onClick={() => deleteMutation.mutate(ex._id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
