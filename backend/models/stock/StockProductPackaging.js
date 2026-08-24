import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const productPackagingSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  qty: { ...decimalField, default: '1' },
  barcode: { type: String },
  packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPackageType', default: null },
  purchaseOk: { type: Boolean, default: true },
  salesOk: { type: Boolean, default: true },
}, { timestamps: true });

productPackagingSchema.index({ tenantId: 1, productId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockProductPackaging
  || mongoose.model('StockProductPackaging', productPackagingSchema);
