import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/** Config change audit — warehouse steps, category costing, settings flags. */
const schema = new mongoose.Schema({
  ...tenantFields,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  resourceType: {
    type: String,
    enum: ['settings', 'warehouse', 'productCategory', 'location', 'operationType', 'other'],
    required: true,
  },
  resourceId: { type: String },
  resourceName: { type: String },
  action: { type: String, default: 'update' },
  changes: [{
    field: String,
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
  }],
  note: { type: String },
}, { timestamps: true });

schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ tenantId: 1, resourceType: 1, resourceId: 1 });

export default mongoose.models.InvConfigAudit
  || mongoose.model('InvConfigAudit', schema);
