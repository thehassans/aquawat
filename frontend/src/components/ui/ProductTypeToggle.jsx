import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS, normalizeProductType } from '../../lib/productType'

export default function ProductTypeToggle({ value, onChange, language = 'en', className = '' }) {
  const current = normalizeProductType(value)
  const aria = language === 'ar' ? 'نوع المنتج' : 'Product type'

  return (
    <div
      role="radiogroup"
      aria-label={aria}
      className={`inline-flex shrink-0 items-center rounded border border-slate-200/80 bg-transparent p-px dark:border-dark-500 ${className}`.trim()}
    >
      {PRODUCT_TYPES.map((type) => {
        const selected = current === type
        const { en, ar } = PRODUCT_TYPE_LABELS[type]
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            title={`${en} / ${ar}`}
            onClick={() => { if (!selected) onChange?.(type) }}
            className={`rounded px-1.5 py-[3px] text-[10px] font-medium leading-none tracking-wide transition ${
              selected
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            {en}
          </button>
        )
      })}
    </div>
  )
}
