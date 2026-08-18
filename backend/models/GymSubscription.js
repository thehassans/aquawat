import mongoose from 'mongoose';

const freezeHistorySchema = new mongoose.Schema({
  freezeStart: { type: Date },
  freezeEnd: { type: Date },
  reason: { type: String },
  daysUsed: { type: Number }
});

const gymSubscriptionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymPlan', required: true },
  subscriptionNumber: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'frozen', 'cancelled'], default: 'active', index: true },
  freezeHistory: [freezeHistorySchema],
  totalFreezeDaysUsed: { type: Number, default: 0 },
  remainingFreezeDays: { type: Number, default: 0 },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'transfer', 'mada', 'apple_pay', 'stc_pay', 'bkash', 'jazzcash', 'easypaisa', 'other'],
    default: 'cash'
  },
  amountPaid: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  currency: { type: String },
  taxRate: { type: Number },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  renewedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymSubscription' },
  autoRenew: { type: Boolean, default: false },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

gymSubscriptionSchema.pre('save', function (next) {
  if (this.amountPaid !== undefined) {
    this.amountPaid = Math.round(this.amountPaid * 100) / 100;
  }
  if (this.discount !== undefined) {
    this.discount = Math.round(this.discount * 100) / 100;
  }
  next();
});

gymSubscriptionSchema.index({ tenantId: 1, memberId: 1, status: 1 });
gymSubscriptionSchema.index({ tenantId: 1, endDate: 1 });
gymSubscriptionSchema.index({ tenantId: 1, subscriptionNumber: 1 }, { unique: true });

export default mongoose.models.GymSubscription || mongoose.model('GymSubscription', gymSubscriptionSchema);
