import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../ui/Money'
import { formatInvError } from '../../lib/invError'

/**
 * Read-only matrix output grid — variants are system-generated.
 * Editable: SKU, Barcode, Price Extra, Active. Name is locked.
 */
export default function ProductVariantsGrid({ productId, language, templateName = '' }) {
  const ar = language === 'ar'
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['inv-variants', productId],
    queryFn: () => api.get('/stock/variants', {
      params: { productId, active: 'false', limit: 500, enrich: '1' },
    }).then((r) => r.data),
    enabled: Boolean(productId),
  })

  const variants = data?.items || []

  const patchMut = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/stock/variants/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-variants', productId] })
      qc.invalidateQueries({ queryKey: ['product-smart-buttons', productId] })
      toast.success(ar ? 'تم الحفظ' : 'Saved')
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  if (!productId) return null

  if (isLoading) {
    return <div className="text-sm text-slate-500">{ar ? 'جاري التحميل…' : 'Loading variants…'}</div>
  }

  if (!variants.length) {
    return (
      <p className="text-sm text-slate-500">
        {ar
          ? 'لا متغيرات بعد — عرّف أسطر السمات ثم اضغط «توليد المتغيرات». لا تُضاف صفوفاً يدوياً.'
          : 'No variants yet — define attribute lines then click Generate variants. Rows cannot be added manually.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        {ar
          ? 'الأسماء تُبنى تلقائياً من القالب + قيم السمات. عدّل SKU / الباركود / فرق السعر فقط.'
          : 'Names are locked (Template + attribute values). Edit SKU, barcode, and price extra only.'}
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
        <table className="min-w-[860px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
            <tr>
              <th className="px-3 py-2">{ar ? 'المتغير' : 'Variant'}</th>
              <th className="px-3 py-2">{ar ? 'القيم' : 'Values'}</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">{ar ? 'باركود' : 'Barcode'}</th>
              <th className="px-3 py-2 text-end">{ar ? 'فرق السعر' : 'Price extra'}</th>
              <th className="px-3 py-2">{ar ? 'المتاح' : 'On hand'}</th>
              <th className="px-3 py-2">{ar ? 'تكلفة' : 'Cost'}</th>
              <th className="px-3 py-2">{ar ? 'سعر' : 'Price'}</th>
              <th className="px-3 py-2">{ar ? 'نشط' : 'Active'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
            {variants.map((v) => (
              <tr key={v._id} className={v.active === false ? 'opacity-50' : ''}>
                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                  {ar && v.nameAr ? v.nameAr : v.name}
                  <div className="text-[10px] font-normal text-slate-400">
                    {ar ? 'مقفل' : 'Locked'}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{v.attributeValuesLabel || '—'}</td>
                <td className="px-3 py-2.5">
                  <input
                    className="input input-sm w-28"
                    defaultValue={v.sku || ''}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next !== (v.sku || '')) patchMut.mutate({ id: v._id, sku: next })
                    }}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    className="input input-sm w-32"
                    defaultValue={v.barcode || ''}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next !== (v.barcode || '')) patchMut.mutate({ id: v._id, barcode: next })
                    }}
                  />
                </td>
                <td className="px-3 py-2.5 text-end">
                  <input
                    className="input input-sm w-24 text-end tabular-nums"
                    type="number"
                    step="any"
                    defaultValue={v.extraPrice ?? 0}
                    onBlur={(e) => {
                      const next = Number(e.target.value) || 0
                      if (next !== Number(v.extraPrice || 0)) {
                        patchMut.mutate({ id: v._id, extraPrice: next })
                      }
                    }}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums">{v.onHand ?? '—'}</td>
                <td className="px-3 py-2"><Money value={v.cost} /></td>
                <td className="px-3 py-2"><Money value={v.price} /></td>
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={v.active !== false}
                    onChange={(e) => patchMut.mutate({ id: v._id, active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
