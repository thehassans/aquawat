import mongoose from 'mongoose';

const priceRuleSchema = new mongoose.Schema({
  minQuantity: { type: Number, default: 0, min: 0 },
  maxQuantity: { type: Number, default: null },
  fixedPrice: { type: Number, default: null },
  discountPercent: { type: Number, default: null, min: 0, max: 100 },
  /** formula | fixed | discount */
  ruleType: { type: String, enum: ['fixed', 'discount', 'formula'], default: 'fixed' },
  /** e.g. "cost * 1.2" — evaluated server-side */
  formula: { type: String, default: '' },
  validFrom: { type: Date, default: null },
  validTo: { type: Date, default: null },
}, { _id: true });

const pricelistItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', default: null },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom', default: null },
  minQuantity: { type: Number, default: 1, min: 0 },
  fixedPrice: { type: Number, default: null, min: 0 },
  rules: { type: [priceRuleSchema], default: [] },
}, { _id: true });

const pricelistSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  currency: { type: String, default: 'SAR' },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  validFrom: { type: Date, default: null },
  validTo: { type: Date, default: null },
  items: { type: [pricelistItemSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

pricelistSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.model('Pricelist', pricelistSchema);
