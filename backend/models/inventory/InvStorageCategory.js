import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  maxWeight: { ...decimalField, default: null },
  allowNewProduct: { type: String, enum: ['mixed', 'sameProduct', 'empty'], default: 'mixed' },
  capacityByProduct: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    qty: { ...decimalField, default: '0' },
  }],
  capacityByPackageType: [{
    packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackageType' },
    qty: { ...decimalField, default: '0' },
  }],
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.InvStorageCategory || mongoose.model('InvStorageCategory', schema);
