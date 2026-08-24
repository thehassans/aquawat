import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const costLineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', default: null },
  price: { ...decimalField, default: '0' },
  splitMethod: {
    type: String,
    enum: ['equal', 'by_quantity', 'by_current_cost_price', 'by_weight', 'by_volume'],
    default: 'by_quantity',
  },
}, { _id: true });

const valuationAdjustmentSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant' },
  additionalCost: { ...decimalField, default: '0' },
  quantity: { ...decimalField, default: '0' },
  unitCostAdditional: { ...decimalField, default: '0' },
  valuationLayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockValuationLayer' },
}, { _id: true });

const stockLandedCostSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  date: { type: Date, default: Date.now },
  state: { type: String, enum: ['draft', 'done', 'cancel'], default: 'draft' },
  pickingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockPicking' }],
  costLines: [costLineSchema],
  valuationAdjustmentLines: [valuationAdjustmentSchema],
  vendorBillRef: { type: String },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
}, { timestamps: true });

stockLandedCostSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockLandedCost || mongoose.model('StockLandedCost', stockLandedCostSchema);
