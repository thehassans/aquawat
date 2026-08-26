import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/** F5 — warn before leaving with unsaved form changes (tab close + in-app navigation) */
export function useDirtyGuard(dirty, message) {
  const msg = message || 'You have unsaved changes'

  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = msg
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, msg])

  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(msg)) blocker.proceed()
    else blocker.reset()
  }, [blocker, msg])
}
