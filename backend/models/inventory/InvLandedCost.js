import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const costLineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { ...decimalField, default: '0' },
  splitMethod: {
    type: String,
    enum: ['equal', 'byQuantity', 'byValue', 'byWeight', 'byVolume'],
    default: 'byQuantity',
  },
}, { _id: true });

const valuationAdjustmentSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', default: null },
  additionalCost: { ...decimalField, default: '0' },
  quantity: { ...decimalField, default: '0' },
  unitCostAdditional: { ...decimalField, default: '0' },
  valuationLayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvValuationLayer' },
}, { _id: true });

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  date: { type: Date, default: Date.now },
  state: { type: String, enum: ['draft', 'done', 'cancelled'], default: 'draft' },
  transferIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer' }],
  costLines: [costLineSchema],
  valuationAdjustmentLines: [valuationAdjustmentSchema],
  vendorBillRef: { type: String },
  legacyLandedCostId: { type: mongoose.Schema.Types.ObjectId, ref: 'LandedCost', default: null },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, state: 1 });

export default mongoose.models.InvLandedCost || mongoose.model('InvLandedCost', schema);
