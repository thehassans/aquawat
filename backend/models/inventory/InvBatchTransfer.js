import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvOperationType', default: null },
  scheduledDate: { type: Date, default: Date.now },
  state: {
    type: String,
    enum: ['draft', 'inProgress', 'done', 'cancelled'],
    default: 'draft',
  },
  pickingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer' }],
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, state: 1 });

export default mongoose.models.InvBatchTransfer || mongoose.model('InvBatchTransfer', schema);
