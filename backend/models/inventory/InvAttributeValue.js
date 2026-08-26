import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  attributeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvProductAttribute',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true },
  /** Extra price added to template selling price for this value (global fallback) */
  extraPrice: { type: Number, default: 0 },
  htmlColor: { type: String, trim: true },
  imageUrl: { type: String },
  /** Free-text at order time (engraving) — createVariantMode should be never */
  isCustom: { type: Boolean, default: false },
  sequence: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, attributeId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, attributeId: 1, active: 1, sequence: 1 });

export default mongoose.models.InvAttributeValue
  || mongoose.model('InvAttributeValue', schema);
