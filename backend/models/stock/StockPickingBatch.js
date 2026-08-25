import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const pickingBatchSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockOperationType', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  scheduledDate: { type: Date, default: Date.now },
  state: {
    type: String,
    enum: ['draft', 'in_progress', 'done', 'cancel'],
    default: 'draft',
  },
  pickingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockPicking' }],
  notes: { type: String },
}, { timestamps: true });

pickingBatchSchema.index({ tenantId: 1, name: 1 }, { unique: true });
pickingBatchSchema.index({ tenantId: 1, state: 1 });

export default mongoose.models.StockPickingBatch
  || mongoose.model('StockPickingBatch', pickingBatchSchema);
