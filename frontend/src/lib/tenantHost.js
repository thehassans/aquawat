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

/**
 * Build handoff URL using a one-time code (preferred) or legacy token hash.
 * Prefer `code` from POST /auth/handoff/issue — never put long-lived JWTs in the URL.
 */
export function getTenantAliasHandoffUrl(slug, codeOrToken, options = {}) {
  if (!slug || !codeOrToken) return ''
  const base = getTenantAliasUrl(slug, '/auth/handoff')
  const params = new URLSearchParams()
  const value = String(codeOrToken)
  // JWT-looking values still supported for one release as legacy fallback
  const looksLikeJwt = value.split('.').length === 3 && value.length > 40
  if (looksLikeJwt) {
    params.set('access_token', value)
  } else {
    params.set('code', value)
  }
  const lang = String(options.lang || '').toLowerCase()
  if (lang === 'ar' || lang === 'en') params.set('lang', lang)
  // Use query string for codes (not hash) so the exchange can clear them cleanly
  if (!looksLikeJwt) return `${base}?${params.toString()}`
  return `${base}#${params.toString()}`
}

/** Issue a one-time handoff code for a JWT via the API. */
export async function issueHandoffCode(api, token) {
  const { data } = await api.post('/auth/handoff/issue', { token })
  return data?.code
}
