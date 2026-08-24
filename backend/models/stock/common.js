import mongoose from 'mongoose';

/** Shared tenant-scoped fields for stock engine models */
export const tenantFields = {
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
};

export const decimalField = {
  type: String,
  default: '0',
  validate: {
    validator(v) {
      if (v == null || v === '') return true;
      const n = Number(v);
      return Number.isFinite(n);
    },
    message: 'Must be a valid decimal string',
  },
};
