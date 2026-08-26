import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const TYPES = ['accessory', 'upsell', 'cross_sell', 'optional', 'substitute'];

const schema = new mongoose.Schema({
  ...tenantFields,
  sourceProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  relatedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  type: {
    type: String,
    enum: TYPES,
    required: true,
  },
  sequence: { type: Number, default: 10 },
  note: { type: String, trim: true },
  noteAr: { type: String, trim: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index(
  { tenantId: 1, sourceProductId: 1, relatedProductId: 1, type: 1 },
  { unique: true },
);
schema.index({ tenantId: 1, relatedProductId: 1, type: 1 });

export const PRODUCT_RELATION_TYPES = TYPES;

export default mongoose.models.InvProductRelation
  || mongoose.model('InvProductRelation', schema);
