import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

/** Variant picker for sales/purchase line editors (v5). */
export default function VariantLineSelect({
  productId,
  value,
  onChange,
  language = 'en',
  className = 'select select-sm w-full',
  autoSelectSingle = true,
}) {
  const ar = language === 'ar'

  const { data: variants = [] } = useQuery({
    queryKey: ['line-variants', productId],
    queryFn: () => api.get('/stock/variants', {
      params: { productId, active: 'true', limit: 200, enrich: '1' },
    }).then((r) => r.data?.items || []),
    enabled: Boolean(productId),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!autoSelectSingle || !productId || variants.length !== 1) return
    const only = variants[0]
    if (String(value || '') !== String(only._id)) {
      onChange(only._id, only)
    }
  }, [autoSelectSingle, productId, variants, value, onChange])

  if (!productId || variants.length === 0) return null

  if (variants.length === 1 && autoSelectSingle) {
    const v = variants[0]
    return (
      <div className="truncate text-xs text-slate-500" title={v.name}>
        {ar ? 'متغير: ' : 'Variant: '}
        {ar && v.nameAr ? v.nameAr : v.name}
      </div>
    )
  }

  return (
    <select
      className={`${className} ${!value ? 'border-amber-400' : ''}`}
      value={value || ''}
      onChange={(e) => {
        const id = e.target.value
        const v = variants.find((x) => String(x._id) === String(id))
        onChange(id || '', v || null)
      }}
    >
      <option value="">{ar ? '— اختر متغير —' : '— Select variant —'}</option>
      {variants.map((v) => (
        <option key={v._id} value={v._id}>
          {ar && v.nameAr ? v.nameAr : v.name}
          {v.sku ? ` (${v.sku})` : ''}
        </option>
      ))}
    </select>
  )
}
