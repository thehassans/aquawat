import { useSelector } from 'react-redux'
import { formatCurrency, formatCurrencyAmount, isSarCurrency, CURRENCY_CODE } from '../../lib/currency'
import { isMissingMoney } from '../../lib/fmtMoney'
import { getInvoiceCurrencyDisplay } from '../../lib/invoiceBranding'
import SarIcon from './SarIcon'

const joinClasses = (...classes) => classes.filter(Boolean).join(' ')

const renderSarMoney = ({ formatted, className = '', amountClassName = '', iconClassName = '', position = 'after' }) => {
  const icon = (
    <SarIcon
      key="icon"
      className={joinClasses(
        'inline-block h-[0.95em] w-[0.95em] shrink-0 overflow-visible',
        position === 'before' ? 'me-[0.18em]' : 'ms-[0.18em]',
        iconClassName,
      )}
      style={{ overflow: 'visible' }}
      title="Saudi Riyal"
    />
  )
  const amount = <span key="amount" className={joinClasses('leading-none', amountClassName)}>{formatted}</span>
  return (
    <span dir="ltr" className={joinClasses('inline-flex items-center whitespace-nowrap tabular-nums leading-none', className)}>
      {position === 'before' ? [icon, amount] : [amount, icon]}
    </span>
  )
}

const renderSarText = ({ formatted, className = '', amountClassName = '', position = 'after' }) => {
  const label = <span key="label" className="leading-none">SAR</span>
  const amount = <span key="amount" className={joinClasses('leading-none', amountClassName)}>{formatted}</span>
  return (
    <span dir="ltr" className={joinClasses('inline-flex items-baseline gap-[0.28em] whitespace-nowrap tabular-nums leading-none', className)}>
      {position === 'before' ? [label, amount] : [amount, label]}
    </span>
  )
}

export default function Money({
  value,
  className = '',
  amountClassName = '',
  iconClassName = '',
  minimumFractionDigits,
  maximumFractionDigits,
  currency: currencyProp,
  language: providedLanguage,
  display,
  position,
}) {
  const { language: storeLanguage } = useSelector((state) => state.ui)
  const tenant = useSelector((state) => state.auth?.tenant)
  const language = providedLanguage || storeLanguage
  // Falls back to the tenant's configured default currency (Settings ->
  // Preferences) so amounts across the app follow the tenant's choice
  // whenever a specific record doesn't carry its own currency.
  const currency = currencyProp || tenant?.settings?.currency || CURRENCY_CODE
  const resolved = getInvoiceCurrencyDisplay(tenant)
  const effectiveDisplay = display || resolved.display
  const effectivePosition = position || resolved.position

  // Missing / failed loads must never render as 0.00
  if (isMissingMoney(value)) {
    return <span className={joinClasses('tabular-nums text-slate-400', className)}>—</span>
  }

  const isSar = isSarCurrency(currency)

  const formatted = isSar
    ? formatCurrencyAmount(value, {
        language,
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits,
        maximumFractionDigits
      })
    : formatCurrency(value, {
        language,
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits,
        maximumFractionDigits
      })

  if (!isSar) {
    return <span dir="ltr" className={joinClasses('whitespace-nowrap tabular-nums', className)}>{formatted}</span>
  }

  if (effectiveDisplay === 'text') {
    return renderSarText({ formatted, className, amountClassName, position: effectivePosition })
  }

  return renderSarMoney({ formatted, className, amountClassName, iconClassName, position: effectivePosition })
}
