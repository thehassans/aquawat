import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

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
  push(process.env.ZATCA_KEY_ENCRYPTION_KEY);
  push(process.env.ZATCA_KEY_ENCRYPTION_KEY_PREVIOUS);
  push(process.env.JWT_SECRET);
  return keys;
};

const getEncryptionKey = () => {
  const keys = encryptionKeyCandidates();
  if (keys.length) return keys[0];
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ZATCA_KEY_ENCRYPTION_KEY or JWT_SECRET must be set in production');
  }
  return keyMaterial('maqder-dev-key-change-in-production');
};

export function encryptPrivateKey(pemString) {
  if (!pemString) return null;
  if (pemString.startsWith('enc:')) return pemString;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(pemString, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPrivateKey(storedValue) {
  if (!storedValue) return null;
  if (!storedValue.startsWith('enc:')) return storedValue;

  const parts = storedValue.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted key format');
  }

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
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Unable to decrypt ZATCA key');
}

export function isKeyEncrypted(storedValue) {
  return !!storedValue && storedValue.startsWith('enc:');
}

export function encryptZatcaConfig(zatcaConfig) {
  if (!zatcaConfig) return zatcaConfig;
  const result = { ...zatcaConfig };
  if (result.privateKey && !isKeyEncrypted(result.privateKey)) {
    result.privateKey = encryptPrivateKey(result.privateKey);
  }
  return result;
}

export function decryptZatcaConfig(zatcaConfig) {
  if (!zatcaConfig) return zatcaConfig;
  const result = { ...zatcaConfig };
  if (result.privateKey && isKeyEncrypted(result.privateKey)) {
    result.privateKey = decryptPrivateKey(result.privateKey);
  }
  return result;
}

export function createZatcaBackupBundle(tenant) {
  const zatca = tenant.zatca?.toObject?.() || tenant.zatca || {};
  const decrypted = decryptZatcaConfig(zatca);

  const bundle = {
    version: 1,
    tenantId: tenant._id?.toString(),
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    exportedAt: new Date().toISOString(),
    zatca: {
      phase: decrypted.phase,
      isOnboarded: decrypted.isOnboarded,
      complianceCsid: decrypted.complianceCsid,
      productionCsid: decrypted.productionCsid,
      privateKey: decrypted.privateKey,
      certificateSerialNumber: decrypted.certificateSerialNumber,
      lastInvoiceHash: decrypted.lastInvoiceHash,
      invoiceCounter: decrypted.invoiceCounter,
      deviceSerialNumber: decrypted.deviceSerialNumber,
      onboardedAt: decrypted.onboardedAt,
      environment: decrypted.environment,
    },
    business: {
      legalNameEn: tenant.business?.legalNameEn,
      legalNameAr: tenant.business?.legalNameAr,
      vatNumber: tenant.business?.vatNumber,
      crNumber: tenant.business?.crNumber,
    },
  };

  const bundleStr = JSON.stringify(bundle, null, 2);
  const encryptedBundle = encryptPrivateKey(bundleStr);
  return {
    bundle: encryptedBundle,
    checksum: crypto.createHash('sha256').update(bundleStr).digest('hex'),
  };
}

export function restoreZatcaBackupBundle(encryptedBundle, expectedChecksum) {
  const bundleStr = decryptPrivateKey(encryptedBundle);
  const checksum = crypto.createHash('sha256').update(bundleStr).digest('hex');

  if (expectedChecksum && checksum !== expectedChecksum) {
    throw new Error('Backup bundle checksum mismatch - data may be corrupted');
  }

  const bundle = JSON.parse(bundleStr);
  return bundle;
}
