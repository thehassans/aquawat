import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  minQty: { ...decimalField, default: '0' },
  maxQty: { ...decimalField, default: '0' },
  qtyMultiple: { ...decimalField, default: '1' },
  trigger: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvRoute', default: null },
  preferredVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  leadDays: { type: Number, default: 0 },
  snoozedUntil: { type: Date, default: null },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, locationId: 1 }, { unique: true });
schema.index({ tenantId: 1, warehouseId: 1, trigger: 1, active: 1 });

export default mongoose.models.InvReorderRule || mongoose.model('InvReorderRule', schema);
