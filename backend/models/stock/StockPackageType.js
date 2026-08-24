import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const packageTypeSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  height: { ...decimalField, default: '0' },
  width: { ...decimalField, default: '0' },
  packagingLength: { ...decimalField, default: '0' },
  baseWeight: { ...decimalField, default: '0' },
  maxWeight: { ...decimalField, default: '0' },
  barcode: { type: String },
}, { timestamps: true });

packageTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockPackageType
  || mongoose.model('StockPackageType', packageTypeSchema);
