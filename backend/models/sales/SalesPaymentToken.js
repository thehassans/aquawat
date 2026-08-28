import mongoose from 'mongoose';

const salesPaymentTokenSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPaymentProvider', required: true },
  methodId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPaymentMethod', default: null },
  externalToken: { type: String, required: true, trim: true },
  last4: { type: String, default: '' },
  brand: { type: String, default: '' },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

salesPaymentTokenSchema.index({ tenantId: 1, partnerId: 1, providerId: 1 });

export default mongoose.model('SalesPaymentToken', salesPaymentTokenSchema);
