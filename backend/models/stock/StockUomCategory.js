import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const uomCategorySchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  measureType: { type: String, enum: ['unit', 'weight', 'volume', 'length', 'time'], default: 'unit' },
}, { timestamps: true });

uomCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockUomCategory
  || mongoose.model('StockUomCategory', uomCategorySchema);
