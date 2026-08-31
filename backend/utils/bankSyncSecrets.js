import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const keyMaterial = (raw) => crypto.createHash('sha256').update(String(raw)).digest();

const encryptionKeyCandidates = () => {
  const keys = [];
  const seen = new Set();
  const push = (raw) => {
    const value = String(raw || '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    keys.push(keyMaterial(value));
  };
  push(process.env.BANK_SYNC_ENCRYPTION_KEY);
  push(process.env.BANK_SYNC_ENCRYPTION_KEY_PREVIOUS);
  push(process.env.ZATCA_KEY_ENCRYPTION_KEY);
  push(process.env.JWT_SECRET);
  return keys;
};

const getEncryptionKey = () => {
  const keys = encryptionKeyCandidates();
  if (keys.length) return keys[0];
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BANK_SYNC_ENCRYPTION_KEY or JWT_SECRET must be set in production');
  }
  return keyMaterial('maqder-bank-sync-dev-key');
};

export function encryptSecret(value) {
  if (!value) return null;
  const plain = String(value);
  if (plain.startsWith('enc:')) return plain;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(storedValue) {
  if (!storedValue) return null;
  const raw = String(storedValue);
  if (!raw.startsWith('enc:')) return raw;

  const parts = raw.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted secret format');

  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const encrypted = Buffer.from(parts[3], 'hex');
  const keys = encryptionKeyCandidates();
  if (!keys.length) keys.push(getEncryptionKey());

  let lastError = null;
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Unable to decrypt bank sync secret');
}

export function isEncryptedSecret(value) {
  return !!value && String(value).startsWith('enc:');
}

/** Persist connection metadata with secrets encrypted. */
export function sealBankSyncMetadata(metadata = {}) {
  const next = { ...(metadata || {}) };
  if (next.accessToken) next.accessToken = encryptSecret(next.accessToken);
  if (next.publicToken) next.publicToken = encryptSecret(next.publicToken);
  if (next.oauthState) next.oauthState = encryptSecret(next.oauthState);
  // linkToken is short-lived; keep plaintext for pending Link UX
  return next;
}

/** Decrypt secrets for server-side API calls. */
export function unsealBankSyncMetadata(metadata = {}) {
  const next = { ...(metadata || {}) };
  if (next.accessToken) next.accessToken = decryptSecret(next.accessToken);
  if (next.publicToken) next.publicToken = decryptSecret(next.publicToken);
  if (next.oauthState) next.oauthState = decryptSecret(next.oauthState);
  return next;
}

/** Strip secrets before returning connections to the browser. */
export function redactBankSyncMetadata(metadata = {}) {
  const next = { ...(metadata || {}) };
  const hasAccess = Boolean(next.accessToken);
  const hasPublic = Boolean(next.publicToken);
  delete next.accessToken;
  delete next.publicToken;
  delete next.oauthState;
  next.hasAccessToken = hasAccess;
  next.hasPublicToken = hasPublic;
  return next;
}

export function redactBankSyncConnections(connections = []) {
  return (Array.isArray(connections) ? connections : []).map((row) => ({
    ...row,
    metadata: redactBankSyncMetadata(row.metadata || {}),
  }));
}

export default {
  encryptSecret,
  decryptSecret,
  isEncryptedSecret,
  sealBankSyncMetadata,
  unsealBankSyncMetadata,
  redactBankSyncMetadata,
  redactBankSyncConnections,
};
