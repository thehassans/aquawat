import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

/** Variant picker for sales/purchase line editors — shows attributes + on-hand stock. */
export default function VariantLineSelect({
  productId,
  value,
  onChange,
  language = 'en',
  className = 'select select-sm w-full',
  autoSelectSingle = true,
  required = false,
}) {
  const ar = language === 'ar'

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['line-variants', productId, 'enrich'],
    queryFn: () => api.get('/stock/variants', {
      params: { productId, active: 'true', limit: 200, enrich: '1' },
    }).then((r) => r.data?.items || r.data || []),
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

  if (!productId) return null
  if (isLoading) {
    return <div className="text-[11px] text-slate-400">{ar ? 'جاري تحميل المتغيرات…' : 'Loading variants…'}</div>
  }
  if (variants.length === 0) return null

  const labelOf = (v) => {
    const name = ar && v.nameAr ? v.nameAr : (v.name || v.attributeValuesLabel || 'Variant')
    const attrs = v.attributeValuesLabel && v.attributeValuesLabel !== name ? ` · ${v.attributeValuesLabel}` : ''
    const sku = v.sku ? ` (${v.sku})` : ''
    const stock = v.onHand != null ? ` · ${ar ? 'متاح' : 'OH'} ${v.onHand}` : ''
    return `${name}${attrs}${sku}${stock}`
  }

  if (variants.length === 1 && autoSelectSingle) {
    const v = variants[0]
    return (
      <div className="truncate text-xs text-slate-500" title={labelOf(v)}>
        {ar ? 'متغير: ' : 'Variant: '}
        {labelOf(v)}
      </div>
    )
  }

  const missing = required && !value

  return (
    <div className="space-y-0.5">
      <select
        className={`${className} ${missing ? 'border-amber-400 ring-1 ring-amber-300/60' : ''}`}
        value={value || ''}
        required={required}
        onChange={(e) => {
          const id = e.target.value
          const v = variants.find((x) => String(x._id) === String(id))
          onChange(id || '', v || null)
        }}
      >
        <option value="">{ar ? '— اختر متغير —' : '— Select variant —'}</option>
        {variants.map((v) => (
          <option key={v._id} value={v._id}>
            {labelOf(v)}
          </option>
        ))}
      </select>
      {missing ? (
        <p className="text-[10px] font-medium text-amber-600">
          {ar ? 'المتغير مطلوب للمنتجات ذات الخصائص' : 'Variant required for attributed products'}
        </p>
      ) : null}
    </div>
  )
}
