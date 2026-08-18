import mongoose from 'mongoose';

const gymSubscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
    subscriptionNumber: {
      type: String,
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymMember',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymPlan',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    pricePaid: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'SAR',
      trim: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'mada', 'tabby', 'tamara', 'bkash', 'nagad', 'easypaisa', 'jazzcash', 'online'],
      default: 'card',
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    status: {
      type: String,
      enum: ['active', 'expiring_soon', 'expired', 'frozen', 'cancelled'],
      default: 'active',
      index: true,
    },
    // Freeze / Pause Tracking
    freezeStartDate: {
      type: Date,
    },
    freezeEndDate: {
      type: Date,
    },
    freezeDaysUsed: {
      type: Number,
      default: 0,
    },
    freezeReason: {
      type: String,
      default: '',
    },
    // Personal Training Credits
    remainingPtSessions: {
      type: Number,
      default: 0,
    },
    // Auto-renewal flag
    autoRenew: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

gymSubscriptionSchema.index({ tenantId: 1, subscriptionNumber: 1 }, { unique: true });
gymSubscriptionSchema.index({ tenantId: 1, memberId: 1, status: 1 });
gymSubscriptionSchema.index({ tenantId: 1, endDate: 1 });

export const GymSubscription = mongoose.model('GymSubscription', gymSubscriptionSchema);
export default GymSubscription;
