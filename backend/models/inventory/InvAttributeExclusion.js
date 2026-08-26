import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/**
 * Exclusion: a template attribute value cannot co-exist with listed values.
 * Evolved model — value ids are InvAttributeValue (global), scoped by templateId.
 */
const schema = new mongoose.Schema({
  ...tenantFields,
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  /** The value that triggers the exclusion (e.g. Material = Silk) */
  attributeValueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvAttributeValue',
    required: true,
  },
  /** Values that cannot combine with attributeValueId (e.g. Size = XXL) */
  excludedValueIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvAttributeValue',
  }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, templateId: 1, attributeValueId: 1 }, { unique: true });

export default mongoose.models.InvAttributeExclusion
  || mongoose.model('InvAttributeExclusion', schema);
