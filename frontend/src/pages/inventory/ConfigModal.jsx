import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Focused config modal — mounts to body, dimmed overlay. */
export function ConfigModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  ar = false,
  wide = false,
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label={ar ? 'إغلاق' : 'Close'}
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-dark-600 dark:bg-dark-800 ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        dir={ar ? 'rtl' : 'ltr'}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-dark-600">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-dark-700"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-dark-600">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
