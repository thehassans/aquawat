import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  model: { type: String, required: true },
  name: { type: String, required: true },
  fields: [{ type: String }],
  importCompatible: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ tenantId: 1, userId: 1, model: 1, name: 1 }, { unique: true });

export default mongoose.models.InvIeTemplate || mongoose.model('InvIeTemplate', schema);
