import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvOperationType', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductCategory', default: null },
  testType: {
    type: String,
    enum: ['passFail', 'measure', 'instructions'],
    default: 'passFail',
  },
  instructions: { type: String },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, operationTypeId: 1, active: 1 });

export default mongoose.models.InvQualityPoint || mongoose.model('InvQualityPoint', schema);
