import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  qty: { ...decimalField, default: '1' },
  barcode: { type: String },
  packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackageType', default: null },
  purchaseOk: { type: Boolean, default: true },
  salesOk: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, barcode: 1 });

export default mongoose.models.InvProductPackaging || mongoose.model('InvProductPackaging', schema);
