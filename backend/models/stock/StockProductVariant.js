import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const productVariantSchema = new mongoose.Schema({
  ...tenantFields,
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductTemplate', required: true },
  defaultCode: { type: String },
  barcode: { type: String },
  attributeValueIds: [{ type: mongoose.Schema.Types.ObjectId }],
  extraPrice: { ...decimalField, default: '0' },
  legacyProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

productVariantSchema.index({ tenantId: 1, templateId: 1 });
productVariantSchema.index({ tenantId: 1, defaultCode: 1 });
productVariantSchema.index({ tenantId: 1, barcode: 1 });

export default mongoose.models.StockProductVariant
  || mongoose.model('StockProductVariant', productVariantSchema);
