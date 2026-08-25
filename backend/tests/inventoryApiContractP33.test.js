import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INV_ERROR_CODES,
  invError,
  InventoryValidationError,
  InventoryConflictError,
  toErrorBody,
} from '../services/inventory/errors.js';
import { listEnvelope, sendInvError } from '../services/inventory/apiContract.js';
import { withWriteConflictRetry } from '../services/inventory/advisoryLock.js';
import { posConsumeBody, validateTransferBody } from '../middleware/invValidate.js';

test('catalog covers brief minimum error codes', () => {
  const required = [
    'NO_RULE_FOUND',
    'INSUFFICIENT_STOCK',
    'NEGATIVE_STOCK_BLOCKED',
    'LOT_REQUIRED',
    'DUPLICATE_SERIAL',
    'PICKING_ALREADY_DONE',
    'IMMUTABLE_RECORD',
    'LOCATION_HAS_STOCK',
    'TYPE_LOCKED_BY_HISTORY',
    'CAPACITY_EXCEEDED',
    'WRITE_CONFLICT',
    'TENANT_SCOPE_VIOLATION',
  ];
  for (const code of required) {
    assert.ok(INV_ERROR_CODES[code], code);
    assert.ok(INV_ERROR_CODES[code].messageAr, `${code} messageAr`);
  }
});

test('toErrorBody nests bilingual error', () => {
  const err = invError('WRITE_CONFLICT');
  const body = toErrorBody(err);
  assert.equal(body.code, 'WRITE_CONFLICT');
  assert.match(body.message, /refresh/i);
  assert.ok(body.messageAr);
});

test('InventoryConflictError defaults to WRITE_CONFLICT', () => {
  const err = new InventoryConflictError('locked');
  assert.equal(err.code, 'WRITE_CONFLICT');
  assert.equal(err.status, 409);
});

test('InventoryValidationError keeps custom code', () => {
  const err = new InventoryValidationError('x', 'IMMUTABLE_RECORD');
  assert.equal(err.code, 'IMMUTABLE_RECORD');
  assert.equal(err.status, 409);
});

test('listEnvelope shape', () => {
  const env = listEnvelope([{ id: 1 }], { total: 1, page: 1, pageSize: 20, appliedFilters: { q: 'a' } });
  assert.deepEqual(env.data, [{ id: 1 }]);
  assert.equal(env._meta.total, 1);
  assert.equal(env._meta.appliedFilters.q, 'a');
});

test('zod rejects empty pos lines', () => {
  const bad = posConsumeBody.safeParse({
    warehouseId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    lines: [],
  });
  assert.equal(bad.success, false);
});

test('zod accepts validate transfer body', () => {
  assert.equal(validateTransferBody.safeParse({ immediate: true }).success, true);
  assert.equal(validateTransferBody.safeParse({ createBackorder: false }).success, true);
});

test('write-conflict retry succeeds on second attempt', async () => {
  let n = 0;
  const result = await withWriteConflictRetry(async () => {
    n += 1;
    if (n === 1) {
      const err = new Error('WriteConflict');
      err.code = 112;
      throw err;
    }
    return 'ok';
  }, { retries: 1 });
  assert.equal(result, 'ok');
  assert.equal(n, 2);
});

test('sendInvError writes nested error object', () => {
  const chunks = [];
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { chunks.push(body); return body; },
  };
  sendInvError(res, new InventoryValidationError('bad lot', 'LOT_REQUIRED'));
  assert.equal(res.statusCode, 400);
  assert.equal(chunks[0].error.code, 'LOT_REQUIRED');
  assert.ok(chunks[0].error.messageAr);
});
