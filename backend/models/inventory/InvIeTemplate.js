import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  model: { type: String, required: true },
  name: { type: String, required: true },
  fields: [{ type: String }],
  format: { type: String, enum: ['xlsx', 'csv'], default: 'xlsx' },
  importCompatible: { type: Boolean, default: false },
  updateMode: { type: Boolean, default: false },
  isShared: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ tenantId: 1, userId: 1, model: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, model: 1, isShared: 1 });

export default mongoose.models.InvIeTemplate || mongoose.model('InvIeTemplate', schema);
