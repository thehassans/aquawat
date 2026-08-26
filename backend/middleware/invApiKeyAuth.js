import crypto from 'crypto';
import InvApiKey from '../../models/inventory/InvApiKey.js';

export function hashApiKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

export function generateApiKey() {
  const prefix = crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(24).toString('base64url');
  const raw = `maq_${prefix}_${secret}`;
  return { raw, prefix, hash: hashApiKey(secret) };
}

export async function authenticateApiKey(req, res, next) {
  const header = req.headers.authorization || req.headers['x-api-key'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : String(header).trim();
  const match = token.match(/^maq_([a-f0-9]+)_(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
  }
  const [, prefix, secret] = match;
  const key = await InvApiKey.findOne({ keyPrefix: prefix, active: true, revokedAt: null })
    .select('+keyHash scopes tenantId')
    .lean();
  if (!key || key.keyHash !== hashApiKey(secret)) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key not found' } });
  }
  req.apiKeyAuth = { tenantId: key.tenantId, scopes: key.scopes || ['read'], keyId: key._id };
  req.user = req.user || { tenantId: key.tenantId, _id: null };
  req.tenantFilter = { tenantId: key.tenantId };
  InvApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
  return next();
}

export function requireApiScope(scope) {
  return (req, res, next) => {
    const scopes = req.apiKeyAuth?.scopes || [];
    if (scopes.includes('admin') || scopes.includes(scope)) return next();
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: `Scope ${scope} required` } });
  };
}
