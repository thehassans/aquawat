// ─── Tenant Alias Domain Helpers ─────────────────────────────────────────────
// Every tenant automatically gets a dedicated login URL at
// `{slug}.maqder.com` (their `slug` is already guaranteed unique). This file
// detects when the app is being loaded from such a subdomain, and builds the
// alias URL for display in Settings / Super Admin.

// The production apex domain(s) this app is served from. Extend this list if
// a staging domain is ever used with the same alias-subdomain scheme.
const BASE_DOMAINS = ['maqder.com']

// Subdomains that must never be treated as a tenant alias (platform-reserved).
const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'ftp', 'cdn', 'static', 'assets',
  'origin', 'shop', 'store',
])

/**
 * Returns the tenant slug encoded in the current hostname, or null when the
 * app is being served from the apex domain, localhost, a reserved subdomain,
 * or a multi-level host (e.g. the e-commerce `{slug}.shop.maqder.com` base).
 */
export function getAliasSlugFromHost(hostname) {
  const host = String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '') || '').toLowerCase().trim()
  if (!host) return null

  for (const base of BASE_DOMAINS) {
    if (host === base) return null
    if (!host.endsWith(`.${base}`)) continue

    const prefix = host.slice(0, host.length - base.length - 1)
    if (!prefix || prefix.includes('.')) return null // e.g. "acme.shop" → storefront base, not an ERP alias
    if (RESERVED_SUBDOMAINS.has(prefix)) return null
    return prefix
  }

  return null
}

/** True when the app is currently being loaded from a tenant alias subdomain. */
export function isOnTenantAliasHost(hostname) {
  return Boolean(getAliasSlugFromHost(hostname))
}

/** Builds the public alias login URL for a given tenant slug, e.g. https://acme.maqder.com/login */
export function getTenantAliasUrl(slug, path = '/login') {
  if (!slug) return ''
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  const base = BASE_DOMAINS[0]
  return `${protocol}//${String(slug).toLowerCase()}.${base}${path}`
}
