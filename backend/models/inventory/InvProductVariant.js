import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/**
 * Variant dimension for quants/moves (`variantId`).
 * Stock is still keyed by productId + variantId — never writes quants directly.
 */
const schema = new mongoose.Schema({
  ...tenantFields,
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true },
  sku: { type: String, trim: true },
  barcode: { type: String, trim: true, index: true },
  attributeValueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvAttributeValue' }],
  /** Sorted value ObjectIds joined — unique per product combination */
  combinationKey: { type: String, required: true },
  /** Human sequence code e.g. P00007-001 */
  variantCode: { type: String, trim: true },
  /** Extra price override (else sum of template/global value extras) */
  extraPrice: { type: Number, default: 0 },
  standardPrice: { type: Number },
  weight: { type: Number },
  volume: { type: Number },
  imageUrl: { type: String },
  imageThumbUrl: { type: String },
  /** Set when this is the single default variant for a non-attributed product */
  isDefault: { type: Boolean, default: false },
  /** Legacy Product._id if this variant was backfilled from a flat product */
  legacyProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, combinationKey: 1 }, { unique: true });
schema.index({ tenantId: 1, productId: 1, active: 1 });
schema.index({ tenantId: 1, sku: 1 }, { sparse: true });
schema.index({ tenantId: 1, barcode: 1 }, { sparse: true });

export default mongoose.models.InvProductVariant
  || mongoose.model('InvProductVariant', schema);
