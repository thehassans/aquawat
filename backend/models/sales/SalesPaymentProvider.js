import mongoose from 'mongoose';

const salesPaymentProviderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: {
    type: String,
    enum: ['moyasar', 'stripe', 'tabby', 'tamara', 'apple_pay', 'stc_pay', 'manual', 'custom'],
    default: 'manual',
  },
  isActive: { type: Boolean, default: true },
  isTestMode: { type: Boolean, default: true },
  webhookSecret: { type: String, default: '' },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

salesPaymentProviderSchema.index({ tenantId: 1, code: 1 });

export default mongoose.model('SalesPaymentProvider', salesPaymentProviderSchema);
