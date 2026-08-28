import mongoose from 'mongoose';

const salesPromotionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, default: '' },
  /** coupon | loyalty | gift_card | automatic */
  promoType: { type: String, enum: ['coupon', 'loyalty', 'gift_card', 'automatic'], default: 'coupon' },
  discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  discountValue: { type: Number, default: 0, min: 0 },
  minOrderAmount: { type: Number, default: 0, min: 0 },
  maxUses: { type: Number, default: null },
  usedCount: { type: Number, default: 0, min: 0 },
  validFrom: { type: Date, default: null },
  validTo: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  partnerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Partner' }],
}, { timestamps: true });

salesPromotionSchema.index({ tenantId: 1, code: 1 }, { unique: true, sparse: true });

export default mongoose.model('SalesPromotion', salesPromotionSchema);
