import mongoose from 'mongoose';
import { tenantFields, decimalField, decimal128Field, setDecimalPair } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLot', default: null },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackage', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  quantity: { ...decimalField, default: '0' },
  quantityNum: { ...decimal128Field },
  reservedQuantity: { ...decimalField, default: '0' },
  reservedQuantityNum: { ...decimal128Field },
  inDate: { type: Date, default: Date.now },
  countedQuantity: { type: String, default: null },
  isCountSet: { type: Boolean, default: false },
  countDifference: { ...decimalField, default: '0' },
  /** On-hand qty at the moment counted was set — used for stale-line detection */
  countSnapshotQty: { type: String, default: null },
  countScheduledDate: { type: Date },
  lastCountDate: { type: Date },
  countUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  countReason: { type: String },
  /** Damage | Theft/Loss | Expiry | Found | Supplier shortage | Data entry error */
  reasonCode: { type: String },
  /** Over threshold — waiting for manager approval before apply */
  varianceApprovalRequired: { type: Boolean, default: false },
  varianceApprovedAt: { type: Date },
  varianceApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  value: { ...decimalField, default: '0' },
  valueNum: { ...decimal128Field },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index(
  {
    tenantId: 1,
    productId: 1,
    variantId: 1,
    locationId: 1,
    lotId: 1,
    packageId: 1,
    ownerId: 1,
  },
  { unique: true },
);
schema.index({ tenantId: 1, productId: 1, locationId: 1 });
schema.index({ tenantId: 1, locationId: 1, productId: 1 });
schema.index({ tenantId: 1, productId: 1, inDate: 1 });
schema.index({ tenantId: 1, locationId: 1 });
schema.index({ tenantId: 1, isCountSet: 1 });

schema.pre('validate', function syncMirrors(next) {
  setDecimalPair(this, 'quantity', this.quantity ?? '0');
  setDecimalPair(this, 'reservedQuantity', this.reservedQuantity ?? '0');
  setDecimalPair(this, 'value', this.value ?? '0');
  next();
});

schema.virtual('availableQuantity').get(function availableQuantity() {
  const q = Number(this.quantity) || 0;
  const r = Number(this.reservedQuantity) || 0;
  return String(q - r);
});

export default mongoose.models.InvQuant || mongoose.model('InvQuant', schema);
