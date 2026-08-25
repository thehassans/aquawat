import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true },
  /** When true, values participate in variant cartesian generation */
  createVariant: { type: Boolean, default: true },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, active: 1, sequence: 1 });

export default mongoose.models.InvProductAttribute
  || mongoose.model('InvProductAttribute', schema);
