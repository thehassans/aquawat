import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  height: { type: Number },
  width: { type: Number },
  length: { type: Number },
  baseWeight: { ...decimalField, default: '0' },
  maxWeight: { ...decimalField },
  barcode: { type: String },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, barcode: 1 });

export default mongoose.models.InvPackageType || mongoose.model('InvPackageType', schema);
