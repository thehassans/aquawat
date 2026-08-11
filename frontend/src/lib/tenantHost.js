// ─── Tenant Alias Domain Helpers ─────────────────────────────────────────────
// Every tenant automatically gets a dedicated login URL at
// `{slug}.maqder.com` (their `slug` is already guaranteed unique). This file
// detects when the app is being loaded from such a subdomain, and builds the
// alias URL for display in Settings / Super Admin.

const BASE_DOMAINS = ['maqder.com']

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'ftp', 'cdn', 'static', 'assets',
  'origin', 'shop', 'store',
])

const getHostname = (hostname) => String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '') || '').toLowerCase().trim()

export function getAliasSlugFromHost(hostname) {
  const host = getHostname(hostname)
  if (!host) return null

  for (const base of BASE_DOMAINS) {
    if (host === base || host === `www.${base}`) return null
    if (!host.endsWith(`.${base}`)) continue

    const prefix = host.slice(0, host.length - base.length - 1)
    if (!prefix || prefix.includes('.')) return null
    if (RESERVED_SUBDOMAINS.has(prefix)) return null
    return prefix
  }

  return null
}

export function isOnTenantAliasHost(hostname) {
  return Boolean(getAliasSlugFromHost(hostname))
}

export function isApexHost(hostname) {
  const host = getHostname(hostname)
  return BASE_DOMAINS.some((base) => host === base || host === `www.${base}`)
}

export function getTenantAliasUrl(slug, path = '/login') {
  if (!slug) return ''
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const base = BASE_DOMAINS[0]
  return `${protocol}//${String(slug).toLowerCase()}.${base}${path}`
}

export function getTenantAliasHandoffUrl(slug, token, options = {}) {
  if (!slug || !token) return ''
  const base = getTenantAliasUrl(slug, '/auth/handoff')
  const params = new URLSearchParams()
  params.set('access_token', token)
  const lang = String(options.lang || '').toLowerCase()
  if (lang === 'ar' || lang === 'en') params.set('lang', lang)
  return `${base}#${params.toString()}`
}
