import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schedulerRunSchema = new mongoose.Schema({
  ...tenantFields,
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  trigger: { type: String, enum: ['manual', 'cron'], default: 'manual' },
  orderpointsChecked: { type: Number, default: 0 },
  procurementsCreated: { type: Number, default: 0 },
  reservationsRetried: { type: Number, default: 0 },
  errorLog: [{ message: String, code: String, at: Date }],
  status: { type: String, enum: ['running', 'done', 'failed'], default: 'running' },
}, { timestamps: true });

schedulerRunSchema.index({ tenantId: 1, startedAt: -1 });

export default mongoose.models.StockSchedulerRun || mongoose.model('StockSchedulerRun', schedulerRunSchema);
