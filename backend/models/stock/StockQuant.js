import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const quantSchema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLot', default: null },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPackage', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  quantity: { ...decimalField, default: '0' },
  reservedQuantity: { ...decimalField, default: '0' },
  inDate: { type: Date, default: Date.now },
  value: { ...decimalField, default: '0' },
  inventoryQuantity: { ...decimalField, default: null },
  inventoryQuantitySet: { type: Boolean, default: false },
  inventoryDiffQuantity: { ...decimalField, default: '0' },
  inventoryDate: { type: Date },
  lastCountDate: { type: Date },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inventoryReason: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

quantSchema.index(
  { tenantId: 1, productId: 1, locationId: 1, lotId: 1, packageId: 1, ownerId: 1 },
  { unique: true },
);
quantSchema.index({ tenantId: 1, productId: 1, locationId: 1 });

export default mongoose.models.StockQuant || mongoose.model('StockQuant', quantSchema);
