import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  trigger: { type: String, enum: ['manual', 'cron'], default: 'manual' },
  rulesEvaluated: { type: Number, default: 0 },
  procurementsCreated: { type: Number, default: 0 },
  reservationsRetried: { type: Number, default: 0 },
  cacheAssertChecked: { type: Number, default: 0 },
  cacheAssertMismatches: { type: Number, default: 0 },
  rateLimited: { type: Boolean, default: false },
  errorLog: [{ message: String, code: String, at: Date }],
  status: { type: String, enum: ['running', 'done', 'failed', 'skipped'], default: 'running' },
  /** Re-entrancy lock token */
  lockKey: { type: String },
}, { timestamps: true });

schema.index({ tenantId: 1, startedAt: -1 });
schema.index({ tenantId: 1, status: 1, lockKey: 1 });

export default mongoose.models.InvSchedulerRun || mongoose.model('InvSchedulerRun', schema);
