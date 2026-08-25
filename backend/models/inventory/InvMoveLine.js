import mongoose from 'mongoose';
import { tenantFields, decimalField, decimal128Field, setDecimalPair } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  moveId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvMove', required: true, index: true },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer', index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom', required: true },
  quantity: { ...decimalField, default: '0' },
  quantityNum: { ...decimal128Field },
  quantityInProductUom: { ...decimalField, default: '0' },
  quantityInProductUomNum: { ...decimal128Field },
  isPicked: { type: Boolean, default: false },
  sourceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  destLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLot', default: null },
  lotName: { type: String },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackage', default: null },
  resultPackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackage', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  state: {
    type: String,
    enum: ['draft', 'waiting', 'confirmed', 'partiallyAvailable', 'assigned', 'done', 'cancelled'],
    default: 'draft',
  },
  reference: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, moveId: 1, state: 1 });
schema.index({ tenantId: 1, transferId: 1 });
schema.index({ tenantId: 1, lotId: 1 });

schema.pre('validate', function syncMirrors(next) {
  setDecimalPair(this, 'quantity', this.quantity ?? '0');
  setDecimalPair(this, 'quantityInProductUom', this.quantityInProductUom ?? this.quantity ?? '0');
  next();
});

export default mongoose.models.InvMoveLine || mongoose.model('InvMoveLine', schema);
