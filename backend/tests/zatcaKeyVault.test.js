import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptPrivateKey, encryptPrivateKey } from '../utils/zatcaKeyVault.js';

test('decrypt falls back to JWT_SECRET after ZATCA_KEY_ENCRYPTION_KEY rotation', () => {
  const prevZatca = process.env.ZATCA_KEY_ENCRYPTION_KEY;
  const prevJwt = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'legacy-jwt-secret-for-zatca-fallback-tests';
  delete process.env.ZATCA_KEY_ENCRYPTION_KEY;

  const stored = encryptPrivateKey('-----BEGIN PRIVATE KEY-----\nLEGACY\n-----END PRIVATE KEY-----');
  process.env.ZATCA_KEY_ENCRYPTION_KEY = 'new-dedicated-zatca-key-material-32ch';

  const pem = decryptPrivateKey(stored);
  assert.match(pem, /LEGACY/);

  if (prevZatca === undefined) delete process.env.ZATCA_KEY_ENCRYPTION_KEY;
  else process.env.ZATCA_KEY_ENCRYPTION_KEY = prevZatca;
  if (prevJwt === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = prevJwt;
});
