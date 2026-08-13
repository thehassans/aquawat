/**
 * FRONTEND_URL allowlist — shared by CORS and cookie CSRF origin checks.
 */
export function configuredFrontendOrigins() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedWebOrigin(origin) {
  if (!origin) return false;
  const configured = configuredFrontendOrigins();
  if (configured.includes('*') && process.env.NODE_ENV !== 'production') return true;
  if (configured.includes(origin)) return true;
  return configured.some((configuredUrl) => {
    try {
      const configuredHost = new URL(configuredUrl).hostname.replace(/^www\./, '');
      const originHost = new URL(origin).hostname.replace(/^www\./, '');
      return originHost === configuredHost || originHost.endsWith(`.${configuredHost}`);
    } catch {
      return false;
    }
  });
}

export function originFromRequest(req) {
  const origin = String(req?.headers?.origin || '').trim();
  if (origin) return origin;
  const referer = String(req?.headers?.referer || '').trim();
  if (!referer) return '';
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

export default { configuredFrontendOrigins, isAllowedWebOrigin, originFromRequest };
