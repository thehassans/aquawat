import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true, trim: true },
  scopeType: {
    type: String,
    enum: ['warehouse', 'location', 'category', 'abc'],
    default: 'warehouse',
  },
  scopeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  abcClass: { type: String, enum: ['A', 'B', 'C'], default: null },
  frequency: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    default: 'monthly',
  },
  assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  blindCount: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  lastRunAt: { type: Date, default: null },
  nextRunAt: { type: Date, default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

schema.index({ tenantId: 1, active: 1, nextRunAt: 1 });

export default mongoose.models.InvCountPlan || mongoose.model('InvCountPlan', schema);
