import mongoose from 'mongoose';

/**
 * Platform SaaS package payments (super-admin recorded / renewals).
 * Source of truth for tenant subscription payment history.
 */
const tenantPaymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    amount: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'SAR' },
    method: { type: String, default: 'bank_transfer' },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    plan: { type: String, default: 'starter' },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    cycles: { type: Number, default: 1, min: 1, max: 36 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['recorded', 'voided'],
      default: 'recorded',
      index: true,
    },
  },
  { timestamps: true },
);

tenantPaymentSchema.index({ tenantId: 1, recordedAt: -1 });
tenantPaymentSchema.index({ recordedAt: -1 });
tenantPaymentSchema.index({ plan: 1, billingCycle: 1 });

export default mongoose.model('TenantPayment', tenantPaymentSchema);
