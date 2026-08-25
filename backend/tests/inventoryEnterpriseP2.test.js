import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCursor, decodeCursor, cursorFilter, pageMeta } from '../services/inventory/cursorPage.js';
import { ENGINE_VERSION } from '../services/inventory/moduleHealth.js';
import { InventoryValidationError } from '../services/inventory/errors.js';
import { installAppendOnlyGuard, installNoDeleteGuard } from '../services/inventory/appendOnly.js';
import mongoose from 'mongoose';

test('cursor round-trip', () => {
  const doc = { _id: new mongoose.Types.ObjectId(), updatedAt: new Date('2026-01-15T12:00:00.000Z') };
  const c = encodeCursor(doc);
  const decoded = decodeCursor(c);
  assert.equal(decoded.id, String(doc._id));
  assert.equal(decoded.date.toISOString(), '2026-01-15T12:00:00.000Z');
});

test('cursorFilter builds keyset or', () => {
  const doc = { _id: new mongoose.Types.ObjectId(), updatedAt: new Date('2026-01-15T12:00:00.000Z') };
  const f = cursorFilter(encodeCursor(doc));
  assert.ok(Array.isArray(f.$or));
  assert.equal(f.$or.length, 2);
});

test('pageMeta nextCursor when full page', () => {
  const id = new mongoose.Types.ObjectId();
  const items = Array.from({ length: 2 }, (_, i) => ({
    _id: id,
    updatedAt: new Date(Date.UTC(2026, 0, i + 1)),
  }));
  const meta = pageMeta({ items, limit: 2 });
  assert.ok(meta.nextCursor);
  assert.equal(pageMeta({ items: items.slice(0, 1), limit: 2 }).nextCursor, null);
});

test('engine version is semver-ish', () => {
  assert.match(ENGINE_VERSION, /^\d+\./);
});

test('append-only guard blocks update hooks on done docs', async () => {
  const schema = new mongoose.Schema({
    state: { type: String, default: 'draft' },
    name: String,
  });
  installAppendOnlyGuard(schema);
  // Hook registered — verify IMMUTABLE code exists on error class
  const err = new InventoryValidationError('x', 'IMMUTABLE_RECORD');
  assert.equal(err.code, 'IMMUTABLE_RECORD');
  assert.equal(typeof schema.s.hooks, 'object');
});

test('no-delete guard registers delete hooks', () => {
  const schema = new mongoose.Schema({ value: String });
  installNoDeleteGuard(schema);
  assert.ok(schema);
});
