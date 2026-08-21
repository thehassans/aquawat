import { useSelector } from 'react-redux'
import { isSarCurrency, getCurrencyMeta } from '../../lib/currency'
import SarIcon from './SarIcon'

const joinClasses = (...classes) => classes.filter(Boolean).join(' ')

export default function CurrencySymbol({ currency: currencyProp, className = 'w-4 h-4', style, ...props }) {
  const tenant = useSelector((state) => state.auth?.tenant)
  const currency = String(currencyProp || tenant?.settings?.currency || 'SAR').trim().toUpperCase()

  if (isSarCurrency(currency)) {
    return <SarIcon className={className} style={style} {...props} />
  }

  const meta = getCurrencyMeta(currency)
  const displaySymbol = meta?.symbol || currency

  return (
    <span
      dir="ltr"
      className={joinClasses('inline-flex items-center text-[0.8em] font-semibold text-slate-500 dark:text-slate-400', className)}
      style={style}
      title={meta?.nameEn || currency}
      {...props}
    >
      {displaySymbol}
    </span>
  )
}
