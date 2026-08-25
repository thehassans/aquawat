import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const templateAttributeLineSchema = new mongoose.Schema({
  ...tenantFields,
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductTemplate', required: true },
  attributeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductAttribute', required: true },
  valueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockProductAttributeValue' }],
}, { timestamps: true });

templateAttributeLineSchema.index({ tenantId: 1, templateId: 1, attributeId: 1 }, { unique: true });

export default mongoose.models.StockProductTemplateAttributeLine
  || mongoose.model('StockProductTemplateAttributeLine', templateAttributeLineSchema);
