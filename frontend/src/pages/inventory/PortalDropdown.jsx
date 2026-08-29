import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Module z-index scale — keep literals out of call sites */
export const INV_Z = {
  /** Keep below app Header (z-50) so global search never stacks under module chrome */
  pageHeader: 10,
  navDropdown: 60,
  modal: 100,
  toast: 200,
}

/**
 * Portal dropdown with flip + shift collision detection.
 * Mounts to document.body (fixed) so overflow-x-auto ancestors cannot clip it
 * or push page layout when the menu opens.
 *
 * align:
 *  - "start" → bottom-start (left edge of panel = left edge of trigger in LTR)
 *  - "end"   → bottom-end
 */
export function PortalDropdown({
  open,
  onClose,
  anchorRef,
  align = 'start',
  children,
  className = '',
}) {
  const panelRef = useRef(null)
  const [style, setStyle] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
    width: 224,
    visibility: 'hidden',
  })

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return undefined

    const place = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      const gap = 4
      const pad = 8
      const rtl = document.documentElement.dir === 'rtl'

      // Prefer measured panel size; fall back to trigger-based min width
      const measuredW = panel?.offsetWidth || 0
      const measuredH = panel?.offsetHeight || 0
      const width = Math.max(measuredW || 224, Math.min(280, Math.max(224, rect.width)))

      const spaceBelow = viewportH - rect.bottom - pad
      const spaceAbove = rect.top - pad
      const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
      const maxHeight = Math.max(120, preferBelow ? spaceBelow : spaceAbove)

      // Bottom-start: panel opens to the right of the trigger's start edge
      let left
      if (rtl) {
        left = align === 'end' ? rect.left : rect.right - width
      } else {
        left = align === 'end' ? rect.right - width : rect.left
      }

      // Horizontal shift to stay in viewport
      if (left + width > viewportW - pad) left = viewportW - pad - width
      if (left < pad) left = pad

      let top = preferBelow ? rect.bottom + gap : rect.top - gap - (measuredH || maxHeight)
      // Vertical clamp
      if (top + Math.min(measuredH || maxHeight, maxHeight) > viewportH - pad) {
        top = Math.max(pad, viewportH - pad - Math.min(measuredH || maxHeight, maxHeight))
      }
      if (top < pad) top = pad

      setStyle({
        top,
        left,
        maxHeight,
        width,
        visibility: 'visible',
      })
    }

    // First pass (may use fallback width), then remeasure once panel is painted
    place()
    const raf = requestAnimationFrame(place)

    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef, align])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      const t = e.target
      if (panelRef.current?.contains(t)) return
      if (anchorRef?.current?.contains(t)) return
      onClose?.()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const onScrollClose = (e) => {
      if (panelRef.current?.contains(e.target)) return
      onClose?.()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollClose, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollClose, true)
    }
  }, [open, onClose, anchorRef])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      className={`fixed overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-dark-600 dark:bg-dark-900 ${className}`}
      style={{
        position: 'fixed',
        top: style.top,
        left: style.left,
        width: style.width,
        maxHeight: style.maxHeight,
        visibility: style.visibility,
        zIndex: INV_Z.navDropdown, // above module chrome; below modals
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
