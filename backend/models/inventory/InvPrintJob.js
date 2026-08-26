import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/** Lightweight print job history / queue (v4.1 §2.3). */
const schema = new mongoose.Schema({
  ...tenantFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  layout: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'done', 'failed'],
    default: 'pending',
  },
  lang: { type: String, default: 'ar' },
  error: { type: String },
  /** Optional ids used for the job */
  transferIds: [{ type: mongoose.Schema.Types.ObjectId }],
  productIds: [{ type: mongoose.Schema.Types.ObjectId }],
  locationIds: [{ type: mongoose.Schema.Types.ObjectId }],
  filename: { type: String },
  bytes: { type: Number, default: 0 },
  expiresAt: { type: Date },
}, { timestamps: true });

schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.InvPrintJob || mongoose.model('InvPrintJob', schema);
