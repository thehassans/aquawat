import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', default: null },
  completePath: { type: String, required: true },
  usage: {
    type: String,
    enum: [
      'view', 'internal', 'vendor', 'customer',
      'inventoryLoss', 'scrap', 'production', 'transit',
    ],
    required: true,
  },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  storageCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvStorageCategory', default: null },
  removalStrategy: {
    type: String,
    enum: ['fifo', 'lifo', 'fefo', 'closest'],
    default: undefined,
  },
  isScrapLocation: { type: Boolean, default: false },
  isReturnLocation: { type: Boolean, default: false },
  barcode: { type: String },
  cyclicCountFrequencyDays: { type: Number },
  lastCountDate: { type: Date },
  nextCountDate: { type: Date },
  stockInputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  stockOutputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  stockValuationAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, completePath: 1 }, { unique: true });
schema.index({ tenantId: 1, warehouseId: 1, usage: 1 });
schema.index({ tenantId: 1, parentId: 1 });
schema.index({ tenantId: 1, usage: 1, active: 1 });
schema.index({ tenantId: 1, barcode: 1 });

export default mongoose.models.InvLocation || mongoose.model('InvLocation', schema);
