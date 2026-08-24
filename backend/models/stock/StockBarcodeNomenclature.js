import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const barcodeRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sequence: { type: Number, default: 10 },
  type: {
    type: String,
    enum: ['product', 'lot', 'package', 'location', 'weight', 'price', 'discount', 'client'],
    default: 'product',
  },
  encoding: { type: String, default: 'any' },
  pattern: { type: String, required: true },
}, { _id: true });

const nomenclatureSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  upcEanConv: { type: Boolean, default: true },
  rules: [barcodeRuleSchema],
  active: { type: Boolean, default: true },
}, { timestamps: true });

nomenclatureSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockBarcodeNomenclature
  || mongoose.model('StockBarcodeNomenclature', nomenclatureSchema);
