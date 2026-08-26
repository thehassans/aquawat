import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  model: { type: String, required: true },
  format: { type: String, enum: ['csv', 'xlsx'], default: 'csv' },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed'],
    default: 'pending',
  },
  rowCount: { type: Number, default: 0 },
  filename: { type: String },
  error: { type: String },
  /** Stored as UTF-8 CSV text or base64 xlsx when small enough */
  payload: { type: String },
  payloadEncoding: { type: String, enum: ['utf8', 'base64'], default: 'utf8' },
  /** Auto-purge after 7 days */
  expiresAt: { type: Date },
  fields: [{ type: String }],
  filterJson: { type: String },
}, { timestamps: true });

schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ tenantId: 1, status: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.InvExportJob || mongoose.model('InvExportJob', schema);
