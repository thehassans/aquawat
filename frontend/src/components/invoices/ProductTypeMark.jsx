import { formatProductTypeBilingual, formatProductTypeLabel, lineProductType, productTypeBadgeClass } from '../../lib/productType'

export default function ProductTypeMark({ productType, line, language = 'en', bilingual = false, className = '' }) {
  const type = lineProductType(line || { productType })
  if (!type || type === 'goods') return null
  const text = bilingual ? formatProductTypeBilingual(type) : formatProductTypeLabel(type, language)
  return (
    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${productTypeBadgeClass(type)} ${className}`.trim()}>
      {text}
    </span>
  )
}
