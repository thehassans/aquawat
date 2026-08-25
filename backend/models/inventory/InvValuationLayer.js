import mongoose from 'mongoose';
import { tenantFields, decimalField, decimal128Field, setDecimalPair } from './common.js';
import { installNoDeleteGuard } from '../../services/inventory/appendOnly.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { ...decimalField, default: '0' },
  quantityNum: { ...decimal128Field },
  unitCost: { ...decimalField, default: '0' },
  unitCostNum: { ...decimal128Field },
  value: { ...decimalField, default: '0' },
  valueNum: { ...decimal128Field },
  remainingQty: { ...decimalField, default: '0' },
  remainingQtyNum: { ...decimal128Field },
  remainingValue: { ...decimalField, default: '0' },
  remainingValueNum: { ...decimal128Field },
  moveId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvMove', default: null },
  description: { type: String },
  landedCostId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLandedCost', default: null },
  legacyLandedCostId: { type: mongoose.Schema.Types.ObjectId, ref: 'LandedCost', default: null },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, createdAt: 1 });
schema.index({ tenantId: 1, moveId: 1 });
schema.index({ tenantId: 1, landedCostId: 1 });

schema.pre('validate', function syncMirrors(next) {
  setDecimalPair(this, 'quantity', this.quantity ?? '0');
  setDecimalPair(this, 'unitCost', this.unitCost ?? '0');
  setDecimalPair(this, 'value', this.value ?? '0');
  setDecimalPair(this, 'remainingQty', this.remainingQty ?? '0');
  setDecimalPair(this, 'remainingValue', this.remainingValue ?? '0');
  next();
});

installNoDeleteGuard(schema);

export default mongoose.models.InvValuationLayer || mongoose.model('InvValuationLayer', schema);
