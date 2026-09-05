import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIban,
  isValidIbanChecksum,
  isValidSaudiIban,
  validateIban,
} from '../utils/iban.js';

test('normalizeIban strips spaces and uppercases', () => {
  assert.equal(normalizeIban('sa03 8000 0000 6080 1016 7519'), 'SA0380000000608010167519');
});

test('mod-97 accepts a known valid Saudi IBAN', () => {
  // Public sample-style SA IBAN with valid checksum structure
  const iban = 'SA0380000000608010167519';
  assert.equal(iban.length, 24);
  assert.equal(isValidIbanChecksum(iban), true);
  assert.equal(isValidSaudiIban(iban), true);
});

test('mod-97 rejects bad checksum', () => {
  const bad = 'SA0380000000608010167510';
  assert.equal(isValidIbanChecksum(bad), false);
  assert.equal(isValidSaudiIban(bad), false);
});

test('Saudi IBAN must be 24 chars', () => {
  const short = 'SA03800000006080101675';
  assert.equal(isValidSaudiIban(short), false);
  const result = validateIban(short);
  assert.equal(result.ok, false);
  assert.match(result.error, /24/);
});

test('empty IBAN is ok when optional', () => {
  assert.deepEqual(validateIban(''), { ok: true, iban: '' });
  assert.equal(validateIban('', { required: true }).ok, false);
});

test('validateIban returns normalized value', () => {
  const result = validateIban('sa03 8000 0000 6080 1016 7519');
  assert.equal(result.ok, true);
  assert.equal(result.iban, 'SA0380000000608010167519');
});
