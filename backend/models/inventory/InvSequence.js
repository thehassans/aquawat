import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  code: { type: String, required: true },
  prefix: { type: String, required: true },
  padding: { type: Number, default: 5 },
  nextNumber: { type: Number, default: 1 },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, code: 1 }, { unique: true });

export default mongoose.models.InvSequence || mongoose.model('InvSequence', schema);
