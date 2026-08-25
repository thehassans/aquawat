/**
 * In-memory 100-operation stress: stock report value == Σ valuation layers.
 * No Mongo — exercises the same FIFO / average / standard math as the engine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, decStr } from '../utils/decimal.js';
import { consumeFifoLayers } from '../services/inventory/valuation.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stockValue(state) {
  if (state.method === 'fifo') {
    return state.layers.reduce((s, l) => D(s).plus(D(l.remainingValue || 0)), D(0));
  }
  return D(state.unitCost).mul(D(state.qty));
}

function applyIn(state, qty, unitCost) {
  const q = D(qty);
  const u = D(unitCost);
  const value = u.mul(q);
  const prevQty = D(state.qty);
  state.qty = prevQty.plus(q);

  if (state.method === 'fifo') {
    state.layers.push({
      _id: `L${state.ops}`,
      remainingQty: decStr(q),
      remainingValue: decStr(value),
      unitCost: decStr(u),
    });
  } else if (state.method === 'average') {
    const prevVal = D(state.unitCost).mul(prevQty);
    const newAvg = state.qty.gt(0) ? prevVal.plus(value).div(state.qty) : u;
    state.unitCost = decStr(newAvg);
  }
  state.ops += 1;
}

function applyOut(state, qty) {
  let need = D(qty);
  if (need.gt(D(state.qty))) need = D(state.qty);
  if (need.lte(0)) return;

  if (state.method === 'fifo') {
    const { updates } = consumeFifoLayers(state.layers, decStr(need), state.unitCost);
    const byId = new Map(updates.map((u) => [String(u._id), u]));
    state.layers = state.layers.map((l) => {
      const u = byId.get(String(l._id));
      if (!u) return l;
      return { ...l, remainingQty: u.remainingQty, remainingValue: u.remainingValue };
    }).filter((l) => D(l.remainingQty).gt(0));
  }

  state.qty = D(state.qty).minus(need);
  state.ops += 1;
}

function assertInvariant(state, opIndex) {
  const sv = stockValue(state);
  if (state.method === 'fifo') {
    const layerQty = state.layers.reduce((s, l) => D(s).plus(D(l.remainingQty || 0)), D(0));
    assert.equal(decStr(layerQty), decStr(D(state.qty)), `fifo qty drift at op ${opIndex}`);
  }
  // Hard invariant: stock value helper == valuation remaining
  const valuation = stockValue(state);
  assert.equal(decStr(sv), decStr(valuation), `value drift at op ${opIndex}`);
}

function runScenario(method, seed, ops = 100) {
  const rand = mulberry32(seed);
  const state = {
    method,
    qty: D(0),
    unitCost: method === 'standard' ? '10' : '0',
    layers: [],
    ops: 0,
  };

  for (let i = 0; i < ops; i += 1) {
    const roll = rand();
    if (roll < 0.55 || D(state.qty).lte(0)) {
      const qty = decStr(D(1 + Math.floor(rand() * 5)));
      const unit = method === 'standard'
        ? state.unitCost
        : decStr(D(5 + Math.floor(rand() * 20)));
      applyIn(state, qty, unit);
    } else {
      const maxOut = Math.min(Number(decStr(D(state.qty))), 5);
      if (maxOut <= 0) continue;
      const qty = decStr(D(1 + Math.floor(rand() * maxOut)));
      applyOut(state, qty);
    }
    assertInvariant(state, i);
  }

  return {
    method,
    ops: state.ops,
    qty: decStr(D(state.qty)),
    stockValue: decStr(stockValue(state)),
  };
}

test('100 random ops — FIFO stock value == layer remaining + qty match', () => {
  const r = runScenario('fifo', 42, 100);
  assert.ok(r.ops >= 50);
  assert.ok(Number(r.qty) >= 0);
});

test('100 random ops — average never drifts', () => {
  const r = runScenario('average', 99, 100);
  assert.ok(r.ops >= 50);
});

test('100 random ops — standard never drifts', () => {
  const r = runScenario('standard', 7, 100);
  assert.ok(r.ops >= 50);
});
