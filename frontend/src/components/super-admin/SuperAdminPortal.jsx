import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

/** Above Super Admin sticky header (z-50) and in-page stacking contexts. */
export const SA_BACKDROP_Z = 'z-[200]'
export const SA_MODAL_Z = 'z-[210]'

/**
 * Render pop-outs on document.body so sticky header / transforms cannot trap z-index.
 */
export default function SuperAdminPortal({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

/**
 * Viewport-centered modal shell (flex), avoids left-1/2 + translate offset bugs.
 */
export function SuperAdminCenteredFrame({
  open,
  onClose,
  children,
  panelClassName = '',
  maxWidthClass = 'max-w-lg',
  backdropClassName = 'bg-black/50',
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className={`fixed inset-0 ${SA_MODAL_Z} flex items-center justify-center p-4 sm:p-6`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 ${backdropClassName}`}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className={`relative w-full ${maxWidthClass} max-h-[min(90vh,900px)] overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-dark-800 ${panelClassName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

export function resolveTenantLogoSrc(tenant) {
  const candidates = [
    tenant?.branding?.logo,
    tenant?.settings?.invoiceBranding?.logo,
    tenant?.logo,
  ]
  for (const value of candidates) {
    const src = String(value || '').trim()
    if (src) return src
  }
  return null
}

export function TenantLogoAvatar({ tenant, className = 'h-10 w-10', letterClassName = 'text-white font-bold' }) {
  const src = resolveTenantLogoSrc(tenant)
  const letter = String(tenant?.name || tenant?.business?.legalNameEn || '?').trim().charAt(0).toUpperCase() || '?'
  const [failed, setFailed] = useState(false)

  if (src && !failed) {
    return (
      <div className={`${className} shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-dark-600 dark:bg-dark-800`}>
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className={`${className} shrink-0 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center ${letterClassName}`}>
      {letter}
    </div>
  )
}
