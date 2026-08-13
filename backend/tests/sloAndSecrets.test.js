import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { applySecretFiles } from '../utils/secretFiles.js';
import {
  recordRequest,
  sloSnapshot,
  sloBreached,
  resetSloSamples,
  percentile,
} from '../utils/sloMetrics.js';

test('applySecretFiles copies JWT_SECRET_FILE when JWT_SECRET is empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maqder-secret-'));
  const file = path.join(dir, 'jwt');
  fs.writeFileSync(file, 'a-unique-production-jwt-secret-value-ok\n');
  const env = { JWT_SECRET_FILE: file };
  const loaded = applySecretFiles(env);
  assert.deepEqual(loaded, ['JWT_SECRET']);
  assert.equal(env.JWT_SECRET, 'a-unique-production-jwt-secret-value-ok');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applySecretFiles does not overwrite an existing env value', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maqder-secret-'));
  const file = path.join(dir, 'jwt');
  fs.writeFileSync(file, 'from-file');
  const env = { JWT_SECRET: 'already-set-value-from-env-ok-ok', JWT_SECRET_FILE: file };
  applySecretFiles(env);
  assert.equal(env.JWT_SECRET, 'already-set-value-from-env-ok-ok');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('percentile 95 of 20 samples', () => {
  const sorted = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(sorted, 0.95), 19);
});

test('sloBreached requires min samples then flags p95 and error rate', () => {
  resetSloSamples();
  for (let i = 0; i < 25; i += 1) recordRequest(100, 200);
  assert.equal(sloBreached(sloSnapshot(), { p95Ms: 2000, errorRate: 0.05, minSamples: 20 }), null);

  resetSloSamples();
  for (let i = 0; i < 25; i += 1) recordRequest(5000, 200);
  assert.equal(sloBreached(sloSnapshot(), { p95Ms: 2000, minSamples: 20 }), 'p95');

  resetSloSamples();
  for (let i = 0; i < 20; i += 1) recordRequest(50, i < 4 ? 500 : 200);
  assert.equal(sloBreached(sloSnapshot(), { p95Ms: 2000, errorRate: 0.05, minSamples: 20 }), 'error_rate');
  resetSloSamples();
});
