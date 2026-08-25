import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  pointId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvQualityPoint', required: true },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  state: {
    type: String,
    enum: ['none', 'pass', 'fail'],
    default: 'none',
  },
  measureValue: { type: String },
  note: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, transferId: 1, state: 1 });

export default mongoose.models.InvQualityCheck || mongoose.model('InvQualityCheck', schema);
