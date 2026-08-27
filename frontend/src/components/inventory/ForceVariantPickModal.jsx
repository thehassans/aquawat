import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import api from '../../lib/api'
import { asInvList } from '../../lib/invList'

/**
 * Force the user to pick a concrete variant when a product template has variants.
 * Returns a resolved pick payload via onConfirm.
 */
export default function ForceVariantPickModal({
  open,
  productId,
  productName = '',
  ar = false,
  onClose,
  onConfirm,
}) {
  const [variantId, setVariantId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['force-variant-pick', productId],
    queryFn: () => api.get('/stock/variants', {
      params: { productId, active: 'true', limit: 200, enrich: '1' },
    }).then((r) => r.data),
    enabled: open && Boolean(productId),
  })

  const variants = useMemo(() => asInvList(data), [data])

  useEffect(() => {
    if (!open) setVariantId('')
    else if (variants.length === 1) setVariantId(String(variants[0]._id))
  }, [open, variants])

  if (!open) return null

  const selected = variants.find((v) => String(v._id) === String(variantId))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-dark-600 dark:bg-dark-800">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {ar ? 'اختر المتغير' : 'Select variant'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {ar
                ? `لا يمكن نقل مخزون القالب «${productName || 'المنتج'}» — اختر تركيبة سمات محددة.`
                : `Cannot stock template “${productName || 'product'}” — pick a specific attribute combination.`}
            </p>
          </div>
          <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400">…</p>
        ) : !variants.length ? (
          <p className="text-sm text-amber-700">
            {ar
              ? 'لا متغيرات مولّدة — افتح المنتج واضغط «توليد المتغيرات» أولاً.'
              : 'No variants generated — open the product and Generate variants first.'}
          </p>
        ) : (
          <select
            className="select w-full"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            autoFocus
          >
            <option value="">{ar ? '— متغير —' : '— Variant —'}</option>
            {variants.map((v) => (
              <option key={v._id} value={v._id}>
                {ar && v.nameAr ? v.nameAr : v.name}
                {v.sku ? ` (${v.sku})` : ''}
                {v.onHand != null ? ` · OH ${v.onHand}` : ''}
              </option>
            ))}
          </select>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selected}
            onClick={() => {
              onConfirm?.({
                kind: 'variant',
                productId,
                productName: productName || '',
                variantId: selected._id,
                variantName: selected.name,
                sku: selected.sku || '',
                name: selected.name,
                productHasVariants: true,
                needsVariant: false,
                variants: [],
              })
              onClose?.()
            }}
          >
            {ar ? 'تأكيد' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
