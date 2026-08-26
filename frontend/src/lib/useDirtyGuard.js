import { useEffect } from 'react'

/** F5 — warn before closing tab with unsaved form changes (BrowserRouter-safe; no useBlocker). */
export function useDirtyGuard(dirty, message) {
  useEffect(() => {
    if (!dirty) return undefined
    const msg = message || 'You have unsaved changes'
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = msg
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, message])
}
