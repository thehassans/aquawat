import mongoose from 'mongoose';
import { D, decStr } from '../../utils/decimal.js';

/** Shared tenant-scoped fields for inventory engine models */
export const tenantFields = {
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
};

export const decimalField = {
  type: String,
  default: '0',
  validate: {
    validator(v) {
      if (v == null || v === '') return true;
      try {
        D(v);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Must be a valid decimal string',
  },
};

/** Decimal128 mirror — aggregation/sort only; never use for business arithmetic */
export const decimal128Field = {
  type: mongoose.Schema.Types.Decimal128,
  default: () => mongoose.Types.Decimal128.fromString('0'),
};

/**
 * Write canonical string + Decimal128 mirror together.
 * @param {Record<string, unknown>} target
 * @param {string} field e.g. 'quantity'
 * @param {import('decimal.js').Value} value
 */
export function setDecimalPair(target, field, value) {
  const s = decStr(value);
  target[field] = s;
  target[`${field}Num`] = mongoose.Types.Decimal128.fromString(s);
  return s;
}

/** @param {string|mongoose.Types.Decimal128|null|undefined} v */
export function decimal128ToString(v) {
  if (v == null) return '0';
  if (typeof v === 'string') return decStr(v);
  return decStr(v.toString());
}

export function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(String(id));
}
