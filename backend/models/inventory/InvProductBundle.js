import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

/**
 * Minimal kit/set — one level deep, no nesting.
 * kit: no own stock; availability = min(component avail / qty)
 * set: has own stock; assembly via internal transfer (later)
 */
const lineSchema = new mongoose.Schema({
  componentProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  componentVariantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InvProductVariant',
    default: null,
  },
  qty: { ...decimalField, default: '1' },
  sequence: { type: Number, default: 10 },
}, { _id: false });

const schema = new mongoose.Schema({
  ...tenantFields,
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  type: {
    type: String,
    enum: ['kit', 'set'],
    required: true,
    default: 'kit',
  },
  lines: { type: [lineSchema], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1 }, { unique: true });

export default mongoose.models.InvProductBundle
  || mongoose.model('InvProductBundle', schema);
