import mongoose from 'mongoose';
import { tenantFields, decimalField, decimal128Field, setDecimalPair } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom', required: true },
  quantity: { ...decimalField, default: '0' },
  quantityNum: { ...decimal128Field },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLot', default: null },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackage', default: null },
  sourceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  scrapLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer', default: null },
  moveId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvMove', default: null },
  reasonTag: { type: String },
  note: { type: String },
  state: { type: String, enum: ['draft', 'done'], default: 'draft' },
  date: { type: Date, default: Date.now },
  responsibleId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, state: 1, date: -1 });
schema.index({ tenantId: 1, productId: 1 });

schema.pre('validate', function syncMirrors(next) {
  setDecimalPair(this, 'quantity', this.quantity ?? '0');
  next();
});

export default mongoose.models.InvScrap || mongoose.model('InvScrap', schema);
