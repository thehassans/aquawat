import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/** HTTP Idempotency-Key responses for stock mutating endpoints. */
const schema = new mongoose.Schema({
  ...tenantFields,
  key: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number, required: true },
  body: { type: mongoose.Schema.Types.Mixed },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ tenantId: 1, key: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.InvIdempotencyKey
  || mongoose.model('InvIdempotencyKey', schema);
