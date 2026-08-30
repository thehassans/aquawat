import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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
