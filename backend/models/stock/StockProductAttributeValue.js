import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const productAttributeValueSchema = new mongoose.Schema({
  ...tenantFields,
  attributeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductAttribute', required: true },
  name: { type: String, required: true },
  sequence: { type: Number, default: 10 },
  htmlColor: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true });

productAttributeValueSchema.index({ tenantId: 1, attributeId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockProductAttributeValue
  || mongoose.model('StockProductAttributeValue', productAttributeValueSchema);
