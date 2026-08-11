import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Loader2 } from 'lucide-react'
import { getMe, seedSessionToken, forceLogout } from '../../store/slices/authSlice'
import { setAppLauncherOpen, setHideSidebar, setLanguage, setNavigationStyle } from '../../store/slices/uiSlice'

/**
 * Cross-subdomain auth handoff.
 * Apex login (maqder.com) redirects here on {slug}.maqder.com with
 * `#access_token=…` so localStorage can be seeded on the tenant origin.
 */
export default function AuthHandoff() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let navigated = false

    const run = async () => {
      try {
        const hash = String(window.location.hash || '').replace(/^#/, '')
        const params = new URLSearchParams(hash)
        const token = params.get('access_token') || params.get('token')
        const lang = String(params.get('lang') || '').toLowerCase()
        if (!token) {
          setError('Missing session token. Please sign in again.')
          return
        }

        // Seed Redux + localStorage BEFORE getMe so ProtectedRoute sees a token.
        dispatch(seedSessionToken(token))
        if (lang === 'ar' || lang === 'en') {
          dispatch(setLanguage(lang))
        }

        // Clear the token from the URL so it is not left in history.
        window.history.replaceState(null, '', window.location.pathname)

        const result = await dispatch(getMe()).unwrap()
        if (cancelled || navigated) return

        const tenant = result?.tenant
        if (result?.user?.role === 'super_admin') {
          navigated = true
          navigate('/super-admin', { replace: true })
          return
        }
        if (result?.user?.role === 'reseller') {
          navigated = true
          navigate('/reseller', { replace: true })
          return
        }

        dispatch(setNavigationStyle({ tenantId: tenant?._id, style: 'launcher' }))
        dispatch(setHideSidebar(true))
        navigated = true
        navigate('/app/dashboard', { replace: true })
        setTimeout(() => dispatch(setAppLauncherOpen(true)), 50)
      } catch (err) {
        if (!cancelled) {
          dispatch(forceLogout())
          setError(err?.message || err?.error || 'Session handoff failed. Please sign in again.')
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [dispatch, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#1a3d28] text-white px-6 text-center">
        <p className="text-lg font-semibold">{error}</p>
        <a href="/login" className="px-5 py-2.5 rounded-xl bg-white text-[#1a3d28] font-semibold">Go to Login</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#1a3d28] text-white">
      <Loader2 className="w-10 h-10 animate-spin" />
      <p className="text-sm text-white/80">Opening your workspace…</p>
    </div>
  )
}
