import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const procurementGroupSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  moveType: { type: String, enum: ['direct', 'one'], default: 'direct' },
}, { timestamps: true });

procurementGroupSchema.index({ tenantId: 1, name: 1 });

export default mongoose.models.StockProcurementGroup
  || mongoose.model('StockProcurementGroup', procurementGroupSchema);
