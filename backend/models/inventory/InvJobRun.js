import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  jobType: {
    type: String,
    enum: [
      'integrity',
      'scheduler',
      'export',
      'import',
      'cache_reconcile',
      'expiry_alerts',
      'other',
    ],
    required: true,
    index: true,
  },
  trigger: { type: String, enum: ['manual', 'cron', 'api', 'system'], default: 'manual' },
  status: {
    type: String,
    enum: ['queued', 'running', 'ok', 'failed', 'partial'],
    default: 'running',
  },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },
  durationMs: { type: Number },
  counts: { type: mongoose.Schema.Types.Mixed, default: {} },
  errors: [{
    code: String,
    message: String,
    messageAr: String,
    ref: mongoose.Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  }],
  result: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ tenantId: 1, startedAt: -1 });
schema.index({ tenantId: 1, jobType: 1, startedAt: -1 });
schema.index({ tenantId: 1, status: 1 });

export default mongoose.models.InvJobRun || mongoose.model('InvJobRun', schema);
