import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS, normalizeProductType } from '../../lib/productType'

/** Compact Goods / Service switch — use bare inside a shared product picker shell */
export default function ProductTypeToggle({ value, onChange, language = 'en', className = '', bare = false }) {
  const current = normalizeProductType(value)
  const aria = language === 'ar' ? 'نوع المنتج' : 'Product type'

  return (
    <div
      role="radiogroup"
      aria-label={aria}
      className={
        bare
          ? `inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100/90 p-0.5 dark:bg-white/10 ${className}`.trim()
          : `inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100/80 p-0.5 dark:bg-white/5 ${className}`.trim()
      }
    >
      {PRODUCT_TYPES.map((type) => {
        const selected = current === type
        const { en, ar } = PRODUCT_TYPE_LABELS[type]
        const label = language === 'ar' ? ar : en
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            title={`${en} / ${ar}`}
            onClick={() => { if (!selected) onChange?.(type) }}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold leading-none tracking-wide transition ${
              selected
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
