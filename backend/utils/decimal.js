import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** @param {Decimal.Value|null|undefined} v @param {string} [fallback] */
export function D(v, fallback = '0') {
  if (v == null || v === '') return new Decimal(fallback);
  if (v instanceof Decimal) return v;
  return new Decimal(String(v));
}

/** @param {Decimal.Value} v */
export function decStr(v) {
  return D(v).toFixed();
}

/** @param {Decimal.Value} a @param {Decimal.Value} b */
export function decAdd(a, b) {
  return D(a).plus(D(b));
}

/** @param {Decimal.Value} a @param {Decimal.Value} b */
export function decSub(a, b) {
  return D(a).minus(D(b));
}

/** @param {Decimal.Value} a @param {Decimal.Value} b */
export function decMin(a, b) {
  const da = D(a);
  const db = D(b);
  return da.lte(db) ? da : db;
}

/** @param {Decimal.Value} a @param {Decimal.Value} b */
export function decMax(a, b) {
  const da = D(a);
  const db = D(b);
  return da.gte(db) ? da : db;
}

/** @param {Decimal.Value} v */
export function decIsPositive(v) {
  return D(v).gt(0);
}

/** @param {Decimal.Value} v */
export function decIsZero(v) {
  return D(v).isZero();
}

/** @param {Decimal.Value} v @param {Decimal.Value} rounding */
export function decRoundUp(v, rounding = '0.01') {
  const r = D(rounding);
  if (r.lte(0)) return D(v);
  const d = D(v);
  return d.div(r).ceil().mul(r);
}

/**
 * Convert qty from uom with factor to reference uom qty.
 * qty_ref = qty / factor
 * @param {Decimal.Value} qty
 * @param {Decimal.Value} factor — relative to reference (reference = 1)
 */
export function uomToReference(qty, factor) {
  const f = D(factor);
  if (f.lte(0)) throw new Error('UoM factor must be positive');
  return D(qty).div(f);
}

/**
 * Convert reference qty to target uom.
 * qty_target = qty_ref * factor
 */
export function referenceToUom(qtyRef, factor, rounding = '0.01') {
  const f = D(factor);
  if (f.lte(0)) throw new Error('UoM factor must be positive');
  return decRoundUp(D(qtyRef).mul(f), rounding);
}

export { Decimal };
