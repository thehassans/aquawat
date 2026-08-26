import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPartnersToTransfers } from '../services/inventory/partnerResolve.js';

test('attachPartnersToTransfers leaves rows without partnerId alone', async () => {
  const rows = [
    { _id: 't1', partnerId: null, operationTypeId: { code: 'outgoing' } },
  ];
  const out = await attachPartnersToTransfers('000000000000000000000001', rows);
  assert.equal(out[0].partner, null);
  assert.equal(out[0].partnerId, null);
});
