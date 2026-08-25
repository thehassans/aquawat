import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  moveType: { type: String, enum: ['direct', 'grouped'], default: 'direct' },
  originModel: { type: String },
  originDocId: { type: mongoose.Schema.Types.ObjectId },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 });
schema.index({ tenantId: 1, originModel: 1, originDocId: 1 });

export default mongoose.models.InvProcurementGroup || mongoose.model('InvProcurementGroup', schema);
