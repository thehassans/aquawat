import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const uomSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUomCategory', required: true },
  uomType: { type: String, enum: ['reference', 'bigger', 'smaller'], default: 'reference' },
  factor: { ...decimalField, default: '1' },
  rounding: { ...decimalField, default: '0.01' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

uomSchema.index({ tenantId: 1, categoryId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockUom || mongoose.model('StockUom', uomSchema);
