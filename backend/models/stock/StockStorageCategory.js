import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const storageCategorySchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  maxWeight: { ...decimalField, default: null },
  allowNewProduct: { type: String, enum: ['mixed', 'same', 'empty'], default: 'mixed' },
  capacityByProduct: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant' },
    qty: { ...decimalField, default: '0' },
  }],
  capacityByPackageType: [{
    packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPackageType' },
    qty: { ...decimalField, default: '0' },
  }],
}, { timestamps: true });

storageCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockStorageCategory
  || mongoose.model('StockStorageCategory', storageCategorySchema);
