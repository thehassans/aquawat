import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const valuationLayerSchema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  quantity: { ...decimalField, default: '0' },
  unitCost: { ...decimalField, default: '0' },
  value: { ...decimalField, default: '0' },
  remainingQty: { ...decimalField, default: '0' },
  remainingValue: { ...decimalField, default: '0' },
  stockMoveId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMove', default: null },
  description: { type: String },
  stockLandedCostId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLandedCost', default: null },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
}, { timestamps: true });

valuationLayerSchema.index({ tenantId: 1, productId: 1, createdAt: 1 });
valuationLayerSchema.index({ tenantId: 1, stockMoveId: 1 });

export default mongoose.models.StockValuationLayer
  || mongoose.model('StockValuationLayer', valuationLayerSchema);
