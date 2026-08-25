import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const stockMessageSchema = new mongoose.Schema({
  ...tenantFields,
  resModel: { type: String, required: true, default: 'StockPicking' },
  resId: { type: mongoose.Schema.Types.ObjectId, required: true },
  messageType: {
    type: String,
    enum: ['comment', 'note', 'notification'],
    default: 'comment',
  },
  body: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorName: { type: String, default: '' },
}, { timestamps: true });

stockMessageSchema.index({ tenantId: 1, resModel: 1, resId: 1, createdAt: -1 });

export default mongoose.models.StockMessage
  || mongoose.model('StockMessage', stockMessageSchema);
