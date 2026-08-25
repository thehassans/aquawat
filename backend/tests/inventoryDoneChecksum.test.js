import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMoveDoneChecksum,
  computeMoveLineDoneChecksum,
  stampMoveDone,
  stampMoveLineDone,
} from '../services/inventory/doneChecksum.js';

test('move checksum is stable for same content', () => {
  const move = {
    productId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    demandQty: '10',
    doneQty: '10',
    sourceLocationId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    destLocationId: 'cccccccccccccccccccccccc',
    uomId: 'dddddddddddddddddddddddd',
    transferId: 'eeeeeeeeeeeeeeeeeeeeeeee',
  };
  assert.equal(computeMoveDoneChecksum(move), computeMoveDoneChecksum({ ...move }));
  assert.notEqual(
    computeMoveDoneChecksum(move),
    computeMoveDoneChecksum({ ...move, doneQty: '9' }),
  );
});

test('stampMoveDone sets state, doneAt, checksum', () => {
  const move = {
    productId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    demandQty: '5',
    doneQty: '5',
    sourceLocationId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    destLocationId: 'cccccccccccccccccccccccc',
    uomId: 'dddddddddddddddddddddddd',
  };
  stampMoveDone(move, { at: new Date('2026-01-01T00:00:00.000Z') });
  assert.equal(move.state, 'done');
  assert.ok(move.doneAt);
  assert.match(move.doneChecksum, /^[a-f0-9]{64}$/);
  assert.equal(move.doneChecksum, computeMoveDoneChecksum(move));
});

test('stampMoveLineDone checksum round-trip', () => {
  const line = {
    moveId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    productId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    quantity: '3',
    quantityInProductUom: '3',
    sourceLocationId: 'cccccccccccccccccccccccc',
    destLocationId: 'dddddddddddddddddddddddd',
    lotId: null,
  };
  stampMoveLineDone(line);
  assert.equal(line.state, 'done');
  assert.equal(line.doneChecksum, computeMoveLineDoneChecksum(line));
});
