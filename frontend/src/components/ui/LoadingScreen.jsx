import React, { useState, useEffect } from 'react'

export default function LoadingScreen() {
  const [showSlowNotice, setShowSlowNotice] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowNotice(true)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  const handleForceReload = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n)))
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
      }
    } catch {}
    const url = new URL(window.location.href)
    url.searchParams.set('_v', Date.now().toString())
    window.location.replace(url.toString())
  }

  const handleResetSession = () => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
    window.location.replace('/login')
  }

  return (
    <div className="min-h-screen bg-[#1a3d28] flex items-center justify-center px-4 py-8 select-none">
      <div className="text-center flex flex-col items-center gap-5 sm:gap-6 max-w-xs sm:max-w-sm">
        <div className="w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center">
          <img src="/maqdernewlogo.webp" alt="Maqder" className="h-full w-auto max-w-full object-contain" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wide">Loading your workspace...</p>
        </div>

        {showSlowNotice && (
          <div className="mt-4 p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-col items-center gap-2.5 animate-fade-in text-white">
            <p className="text-xs text-white/80">Taking longer than expected?</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleForceReload}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow transition-all active:scale-95"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all active:scale-95"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
