import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useSelector } from 'react-redux'
import { backBtnClass, fieldLabelClass, formShellClass, ghostBtn } from './inventoryUi'

/**
 * Premium back control — labeled, RTL-aware, never icon-only.
 */
export function InventoryBackButton({ to, label, onClick, className = '' }) {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const navigate = useNavigate()
  const text = label || (isAr ? 'رجوع' : 'Back')

  const content = (
    <>
      <ArrowLeft className={`h-4 w-4 shrink-0 ${isAr ? 'rotate-180' : ''}`} />
      <span>{text}</span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={`${backBtnClass} ${className}`}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick || (() => navigate(-1))}
      className={`${backBtnClass} ${className}`}
    >
      {content}
    </button>
  )
}

/** Page title row with back + optional actions */
export function InventoryPageHeader({ title, subtitle, backTo, backLabel, actions, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {(backTo || backLabel) && (
          <InventoryBackButton to={backTo} label={backLabel} />
        )}
        <div className="min-w-0 pt-0.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  )
}

/** Constrained form card — full usable width on large screens */
export function InventoryFormShell({ children, className = '', as: Tag = 'form', ...props }) {
  return (
    <Tag className={`${formShellClass} ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function InventoryField({ label, children, className = '', hint }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <label className={fieldLabelClass}>{label}</label>}
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function InventorySectionTitle({ children }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
      {children}
    </h2>
  )
}

export { ghostBtn }
