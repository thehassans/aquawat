import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Money from '../ui/Money'
import { formatInvError } from '../../lib/invError'

/** Inline variant list on the product form (v5 §6). */
export default function ProductVariantsGrid({ productId, language }) {
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
        {ar ? 'لا متغيرات بعد — أضف سمات ثم اضغط «توليد المتغيرات».' : 'No variants yet — add attributes then click Generate variants.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-dark-600">
      <table className="min-w-[720px] w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-dark-800">
          <tr>
            <th className="px-3 py-2">{ar ? 'المتغير' : 'Variant'}</th>
            <th className="px-3 py-2">{ar ? 'القيم' : 'Values'}</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">{ar ? 'باركود' : 'Barcode'}</th>
            <th className="px-3 py-2">{ar ? 'المتاح' : 'On hand'}</th>
            <th className="px-3 py-2">{ar ? 'تكلفة' : 'Cost'}</th>
            <th className="px-3 py-2">{ar ? 'سعر' : 'Price'}</th>
            <th className="px-3 py-2">{ar ? 'نشط' : 'Active'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
          {variants.map((v) => (
            <tr key={v._id}>
              <td className="px-3 py-2.5 font-medium">
                {ar && v.nameAr ? v.nameAr : v.name}
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
  )
}
