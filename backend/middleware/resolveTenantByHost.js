import Tenant from '../models/Tenant.js';

// Lightweight in-memory cache: host -> { tenant, expiry }
const tenantCache = new Map();
const TTL_MS = 60_000;

// Platform subdomain base, e.g. {slug}.shop.maqder.com
const PLATFORM_BASE = (process.env.ECOM_PLATFORM_BASE || '.shop.maqder.com').toLowerCase();

export const clearTenantHostCache = (host) => {
  if (host) tenantCache.delete(host.toLowerCase());
  else tenantCache.clear();
};

/**
 * Resolve Host for tenant routing.
 * Prefer req.hostname (Express, after trust proxy) over raw headers.
 * Never prefer client-supplied X-Forwarded-Host unless TRUST_FORWARDED_HOST=true
 * AND Express trust proxy is configured (edge strips spoofed headers).
 */
const resolveRequestHost = (req) => {
  if (process.env.TRUST_FORWARDED_HOST === 'true') {
    // Express already applies trust-proxy hop rules to req.hostname
    return String(req.hostname || '').trim().toLowerCase();
  }
  // Ignore X-Forwarded-Host from clients — use the connection Host only
  const rawHost = req.headers.host || '';
  return rawHost.split(':')[0].trim().toLowerCase();
};

/**
 * Resolves the storefront tenant for a PUBLIC (no-JWT) request by matching the
 * incoming Host header against either:
 *   1. A verified custom domain on Tenant.ecommerce.domains[]
 *   2. The free platform subdomain {slug}.shop.maqder.com
 *
 * Attaches the tenant to req.storeTenant. Used by storefront + public store APIs.
 */
export const resolveTenantByHost = async (req, res, next) => {
  try {
    const host = resolveRequestHost(req);
    if (!host) return res.status(400).json({ error: 'Missing host header' });

    const cached = tenantCache.get(host);
    if (cached && cached.expiry > Date.now()) {
      req.storeTenant = cached.tenant;
      return next();
    }

    let tenant = null;

    if (host.endsWith(PLATFORM_BASE)) {
      const slug = host.slice(0, host.length - PLATFORM_BASE.length);
      if (slug) {
        tenant = await Tenant.findOne({
          $or: [{ 'ecommerce.subdomain': slug }, { slug }],
          businessTypes: 'ecommerce',
          isActive: true,
        }).lean();
      }
    } else {
      tenant = await Tenant.findOne({
        'ecommerce.domains': { $elemMatch: { hostname: host, status: 'verified' } },
        businessTypes: 'ecommerce',
        isActive: true,
      }).lean();
    }

    if (!tenant) {
      return res.status(404).json({ error: 'Store not found for this domain' });
    }

    if (tenant.ecommerce?.storeStatus === 'paused') {
      return res.status(503).json({ error: 'Store is temporarily unavailable' });
    }

    tenantCache.set(host, { tenant, expiry: Date.now() + TTL_MS });
    req.storeTenant = tenant;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Store resolution error' });
  }
};

export default resolveTenantByHost;
