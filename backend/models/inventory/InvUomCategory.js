import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  measureType: {
    type: String,
    enum: ['unit', 'weight', 'volume', 'length', 'time', 'workingTime'],
    default: 'unit',
  },
  isSystem: { type: Boolean, default: false },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.InvUomCategory || mongoose.model('InvUomCategory', schema);
