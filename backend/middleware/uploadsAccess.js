import { protect } from './auth.js';

const SENSITIVE_PREFIXES = ['hr/', 'expense-receipts/', 'khayyat/'];

function normalizeUploadPath(reqPath = '') {
  return String(reqPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
}

function isSensitiveUploadPath(relPath) {
  return SENSITIVE_PREFIXES.some(
    (prefix) => relPath === prefix.slice(0, -1) || relPath.startsWith(prefix)
  );
}

/**
 * Public catalog/branding images stay world-readable.
 * HR CVs, expense receipts, and khayyat measurements require a logged-in user
 * whose tenantId matches the path segment when present.
 */
export const gateSensitiveUploads = (req, res, next) => {
  const relPath = normalizeUploadPath(req.path);
  if (!isSensitiveUploadPath(relPath)) return next();

  return protect(req, res, () => {
    if (req.user?.role === 'super_admin') return next();
    const tenantId = String(req.user?.tenantId || '');
    if (!tenantId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const hasTenantSegment = /(?:^|\/)[a-f0-9]{24}(?:\/|$)/i.test(relPath);
    if (hasTenantSegment && !relPath.includes(tenantId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    return next();
  });
};
