import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/** Audit trail for inventory import/export (v4.1 §1.5). */
const schema = new mongoose.Schema({
  ...tenantFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  action: { type: String, enum: ['export', 'import'], required: true },
  model: { type: String, required: true },
  format: { type: String },
  rowCount: { type: Number, default: 0 },
  fields: [{ type: String }],
  filterJson: { type: String },
  dryRun: { type: Boolean, default: false },
  created: { type: Number },
  updated: { type: Number },
  errors: { type: Number },
  async: { type: Boolean, default: false },
  jobId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ tenantId: 1, model: 1, createdAt: -1 });

export default mongoose.models.InvIeAudit || mongoose.model('InvIeAudit', schema);
