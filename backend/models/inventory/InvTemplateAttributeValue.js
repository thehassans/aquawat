import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/**
 * Per-template attribute value extras (price on THIS product, not global value).
 * Variants may eventually reference these; pricing today still falls back to
 * InvAttributeValue.extraPrice when no template row exists.
 */
const schema = new mongoose.Schema({
  ...tenantFields,
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  attributeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvProductAttribute',
    required: true,
  },
  attributeValueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvAttributeValue',
    required: true,
  },
  priceExtra: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index(
  { tenantId: 1, templateId: 1, attributeValueId: 1 },
  { unique: true },
);

export default mongoose.models.InvTemplateAttributeValue
  || mongoose.model('InvTemplateAttributeValue', schema);
