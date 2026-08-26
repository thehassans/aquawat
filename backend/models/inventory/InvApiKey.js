import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true, trim: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true, select: false },
  scopes: [{ type: String, enum: ['read', 'write', 'admin'] }],
  rateLimitPerMin: { type: Number, default: 120 },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, keyPrefix: 1 }, { unique: true });

export default mongoose.models.InvApiKey || mongoose.model('InvApiKey', schema);
