import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const sequenceSchema = new mongoose.Schema({
  ...tenantFields,
  code: { type: String, required: true },
  prefix: { type: String, default: '' },
  padding: { type: Number, default: 5 },
  nextNumber: { type: Number, default: 1 },
}, { timestamps: true });

sequenceSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export default mongoose.models.StockSequence || mongoose.model('StockSequence', sequenceSchema);
