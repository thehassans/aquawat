import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW_OPEN_STATES } from '../services/inventory/transferQuery.js';

test('overview open states include draft (new pickings are draft)', () => {
  assert.ok(OVERVIEW_OPEN_STATES.includes('draft'));
  assert.ok(OVERVIEW_OPEN_STATES.includes('assigned'));
  assert.ok(OVERVIEW_OPEN_STATES.includes('waiting'));
  assert.ok(OVERVIEW_OPEN_STATES.includes('confirmed'));
});
