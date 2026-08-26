import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'
import { formatInvError } from '../../lib/invError'

/** Per-template price extras on attribute values (v5 §2.2). */
export default function TemplatePriceExtrasEditor({ productId, attributeLines, language }) {
  const ar = language === 'ar'
  const qc = useQueryClient()

  const lines = attributeLines || []
  const attributeIds = [...new Set(lines.map((l) => l.attributeId).filter(Boolean))]

  const { data: extras = [] } = useQuery({
    queryKey: ['template-attribute-values', productId],
    queryFn: () => api.get(`/stock/products/${productId}/template-attribute-values`).then((r) => asInvList(r.data)),
    enabled: Boolean(productId),
  })

  const valueQueries = useQuery({
    queryKey: ['template-price-value-labels', attributeIds.join(',')],
    queryFn: async () => {
      const maps = {}
      for (const aid of attributeIds) {
        // eslint-disable-next-line no-await-in-loop
        const rows = await api.get(`/stock/attributes/${aid}/values`).then((r) => asInvList(r.data))
        maps[aid] = rows
      }
      return maps
    },
    enabled: attributeIds.length > 0,
  })

  const saveMut = useMutation({
    mutationFn: (body) => api.post('/stock/template-attribute-values', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-attribute-values', productId] })
      toast.success(ar ? 'تم الحفظ' : 'Saved')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const entries = useMemo(() => {
    const out = []
    for (const line of lines) {
      for (const vid of line.valueIds || []) {
        const val = (valueQueries.data?.[line.attributeId] || []).find((v) => String(v._id) === String(vid))
        out.push({
          vid,
          attributeId: line.attributeId,
          label: val ? (ar && val.nameAr ? val.nameAr : val.name) : vid,
        })
      }
    }
    return out
  }, [lines, valueQueries.data, ar])

  if (!productId || !entries.length) return null

  const extraByValue = new Map((extras || []).map((e) => [String(e.attributeValueId), e.priceExtra]))

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-dark-600">
      <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
        {ar ? 'سعر إضافي لكل قيمة (على هذا المنتج)' : 'Extra price per value (this template)'}
      </h4>
      <div className="space-y-2">
        {entries.map(({ vid, attributeId, label }) => (
          <div key={vid} className="flex items-center gap-2 text-sm">
            <span className="min-w-[8rem] truncate text-slate-700 dark:text-slate-300">{label}</span>
            <input
              type="number"
              step="0.01"
              className="input input-sm w-28"
              defaultValue={extraByValue.get(String(vid)) ?? ''}
              placeholder="0"
              onBlur={(e) => {
                saveMut.mutate({
                  templateId: productId,
                  attributeId,
                  attributeValueId: vid,
                  priceExtra: Number(e.target.value) || 0,
                })
              }}
            />
            <span className="text-xs text-slate-400">SAR</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {ar ? 'يُضاف إلى سعر البيع الأساسي عند توليد المتغيرات.' : 'Added to base selling price when variants are generated.'}
      </p>
    </div>
  )
}
