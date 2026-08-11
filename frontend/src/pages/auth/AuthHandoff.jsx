import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { getMe, seedSessionToken, forceLogout } from '../../store/slices/authSlice'
import { setAppLauncherOpen, setHideSidebar, setLanguage, setNavigationStyle } from '../../store/slices/uiSlice'
import { getAliasSlugFromHost } from '../../lib/tenantHost'

/**
 * Cross-subdomain auth handoff.
 * Prefers one-time `?code=` exchange; legacy `#access_token=` still accepted once.
 */
export default function AuthHandoff() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let navigated = false

    const clearUrl = () => {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const run = async () => {
      try {
        const search = new URLSearchParams(window.location.search || '')
        const hash = String(window.location.hash || '').replace(/^#/, '')
        const hashParams = new URLSearchParams(hash)
        const code = search.get('code') || hashParams.get('code')
        const legacyToken = hashParams.get('access_token') || hashParams.get('token') || search.get('access_token')
        const lang = String(search.get('lang') || hashParams.get('lang') || '').toLowerCase()

        if (lang === 'ar' || lang === 'en') {
          dispatch(setLanguage(lang))
        }

        let token = null
        if (code) {
          const { data } = await api.post('/auth/handoff/exchange', { code })
          token = data?.token
          if (data?.user) {
            // Cookie is set by server; still seed token for Bearer/desktop fallback
            dispatch(seedSessionToken(token))
          }
        } else if (legacyToken) {
          token = legacyToken
          dispatch(seedSessionToken(token))
        } else {
          setError('Missing session. Please sign in again.')
          return
        }

        clearUrl()

        if (!token) {
          setError('Session handoff failed. Please sign in again.')
          return
        }

        const result = await dispatch(getMe()).unwrap()
        if (cancelled || navigated) return

        const tenant = result?.tenant
        const aliasSlug = getAliasSlugFromHost()
        if (
          aliasSlug &&
          tenant?.slug &&
          String(tenant.slug).toLowerCase() !== String(aliasSlug).toLowerCase()
        ) {
          dispatch(forceLogout())
          setError('This login belongs to a different workspace. Please sign in again.')
          return
        }
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
          setError(err?.response?.data?.error || err?.message || err?.error || 'Session handoff failed. Please sign in again.')
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
