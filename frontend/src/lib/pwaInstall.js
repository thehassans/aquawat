/**
 * Maqder web-app (PWA) install helpers.
 * Captures the browser install prompt and registers a lightweight SW for installability.
 */

const SW_URL = '/maqder-install-sw.js'
const SW_SCOPE = '/'

let deferredPrompt = null
const listeners = new Set()

const notify = () => {
  listeners.forEach((fn) => {
    try { fn(deferredPrompt) } catch { /* ignore */ }
  })
}

export const isMaqderWebAppInstalled = () => {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')
  if (mq?.matches) return true
  if (window.navigator?.standalone) return true
  return false
}

export const isIosDevice = () => {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export const subscribePwaInstallPrompt = (listener) => {
  listeners.add(listener)
  listener(deferredPrompt)
  return () => listeners.delete(listener)
}

export const registerMaqderInstallServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
    return registration
  } catch (err) {
    console.warn('[PWA] Install SW registration failed:', err)
    return null
  }
}

export const initMaqderPwaInstall = () => {
  if (typeof window === 'undefined') return () => {}

  const onBeforeInstall = (event) => {
    event.preventDefault()
    deferredPrompt = event
    notify()
  }

  const onInstalled = () => {
    deferredPrompt = null
    notify()
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  window.addEventListener('appinstalled', onInstalled)
  registerMaqderInstallServiceWorker()

  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

/**
 * Trigger native install when available.
 * Returns: 'prompted' | 'accepted' | 'dismissed' | 'installed' | 'ios' | 'unavailable'
 */
export const promptMaqderWebAppInstall = async () => {
  if (isMaqderWebAppInstalled()) return 'installed'
  if (isIosDevice()) return 'ios'

  if (!deferredPrompt) {
    // Last chance: wait briefly in case the event arrives after SW registers
    await new Promise((r) => setTimeout(r, 250))
  }

  if (!deferredPrompt) return 'unavailable'

  const promptEvent = deferredPrompt
  deferredPrompt = null
  notify()

  await promptEvent.prompt()
  const choice = await promptEvent.userChoice
  return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
}
