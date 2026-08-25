import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Module z-index scale — keep literals out of call sites */
export const INV_Z = {
  pageHeader: 30,
  navDropdown: 50,
  modal: 100,
  toast: 200,
}

/**
 * Portal dropdown with flip + max-height collision.
 * Closes on outside click, Escape, route change (caller), and scroll.
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
  const [style, setStyle] = useState({ top: 0, left: 0, maxHeight: 320, width: 224 })

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return undefined

    const place = () => {
      const rect = anchorRef.current.getBoundingClientRect()
      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      const gap = 4
      const minWidth = Math.max(224, rect.width)
      const pad = 16
      const spaceBelow = viewportH - rect.bottom - pad
      const spaceAbove = rect.top - pad
      const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
      const maxHeight = Math.max(120, preferBelow ? spaceBelow : spaceAbove)

      let left = align === 'end' ? rect.right - minWidth : rect.left
      if (document.documentElement.dir === 'rtl') {
        left = align === 'end' ? rect.left : rect.right - minWidth
      }
      // Flip horizontally if overflowing
      if (left + minWidth > viewportW - pad) left = viewportW - pad - minWidth
      if (left < pad) left = pad

      const top = preferBelow ? rect.bottom + gap : Math.max(pad, rect.top - gap - maxHeight)

      setStyle({
        top,
        left,
        maxHeight,
        width: minWidth,
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
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
        top: style.top,
        left: style.left,
        width: style.width,
        maxHeight: style.maxHeight,
        zIndex: INV_Z.navDropdown,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
