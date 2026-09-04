/**
 * Unit checks for stock interim account defs + COGS credit account selection helpers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STOCK_ACCOUNT_DEFS, buildValuationJournalLines } from '../services/inventory/stockAccounting.js';

describe('stock interim CoA classification', () => {
  it('1310 and 1320 are assets in the 1xxx range', () => {
    const received = STOCK_ACCOUNT_DEFS.find((d) => d.code === '1310');
    const delivered = STOCK_ACCOUNT_DEFS.find((d) => d.code === '1320');
    assert.equal(received.type, 'asset');
    assert.equal(delivered.type, 'asset');
    assert.match(received.subtype, /asset/);
    assert.match(delivered.subtype, /asset/);
  });

  it('delivery valuation debits interim 1320 not COGS 5000', () => {
    const lines = buildValuationJournalLines({
      direction: 'out',
      amount: 80,
      inventory: { _id: 'inv', code: '1300' },
      stockOutput: { _id: 'out', code: '1320' },
    });
    assert.equal(lines[0].accountCode, '1320');
    assert.equal(lines[0].debit, 80);
    assert.equal(lines[1].accountCode, '1300');
    assert.equal(lines[1].credit, 80);
  });
});
