import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const locationSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  completeName: { type: String, required: true },
  usage: {
    type: String,
    enum: ['view', 'internal', 'vendor', 'customer', 'inventory', 'production', 'transit'],
    required: true,
  },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse', default: null },
  storageCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockStorageCategory', default: null },
  removalStrategy: { type: String, enum: ['fifo', 'lifo', 'fefo', 'closest'], default: null },
  isScrapLocation: { type: Boolean, default: false },
  isReturnLocation: { type: Boolean, default: false },
  barcode: { type: String },
  cyclicInventoryFrequencyDays: { type: Number },
  lastInventoryDate: { type: Date },
  nextInventoryDate: { type: Date },
  active: { type: Boolean, default: true },
}, { timestamps: true });

locationSchema.index({ tenantId: 1, completeName: 1 });
locationSchema.index({ tenantId: 1, warehouseId: 1, usage: 1 });

export default mongoose.models.StockLocation || mongoose.model('StockLocation', locationSchema);
