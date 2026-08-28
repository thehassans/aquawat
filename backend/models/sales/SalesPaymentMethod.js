import mongoose from 'mongoose';

const salesPaymentMethodSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPaymentProvider', required: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  /** card | bank | wallet | bnpl | cash */
  type: { type: String, enum: ['card', 'bank', 'wallet', 'bnpl', 'cash'], default: 'card' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

salesPaymentMethodSchema.index({ tenantId: 1, providerId: 1, name: 1 }, { unique: true });

export default mongoose.model('SalesPaymentMethod', salesPaymentMethodSchema);
