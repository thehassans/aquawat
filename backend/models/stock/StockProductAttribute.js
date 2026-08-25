import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const productAttributeSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  displayType: { type: String, enum: ['radio', 'select', 'color'], default: 'radio' },
  createVariant: { type: String, enum: ['always', 'dynamic', 'no_variant'], default: 'always' },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

productAttributeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockProductAttribute
  || mongoose.model('StockProductAttribute', productAttributeSchema);
