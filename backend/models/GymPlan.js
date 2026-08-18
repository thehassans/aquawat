import mongoose from 'mongoose';

const gymPlanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    planCode: {
      type: String,
      required: true,
      trim: true,
    },
    nameEn: {
      type: String,
      required: true,
      trim: true,
    },
    nameAr: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    // Duration in days or months
    durationDays: {
      type: Number,
      default: 30,
    },
    durationMonths: {
      type: Number,
      default: 1,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'SAR',
      trim: true,
    },
    taxRate: {
      type: Number,
      default: 15,
    },
    accessType: {
      type: String,
      enum: ['all_day', 'morning_offpeak', 'evening_peak', 'ladies_only', 'vip_all_access', 'weekend_only'],
      default: 'all_day',
    },
    allowedFreezeDays: {
      type: Number,
      default: 7, // Allowed pause/freeze days per subscription cycle
    },
    branchAccess: {
      type: String,
      enum: ['single_branch', 'all_branches', 'vip_network'],
      default: 'single_branch',
    },
    includedPtSessions: {
      type: Number,
      default: 0, // Number of complimentary 1-on-1 PT sessions
    },
    includedClasses: {
      type: Number,
      default: -1, // -1 means unlimited group classes
    },
    includedLocker: {
      type: Boolean,
      default: false,
    },
    features: [
      {
        type: String,
        trim: true,
      }
    ],
    sortOrder: {
      type: Number,
      default: 0,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

gymPlanSchema.index({ tenantId: 1, planCode: 1 }, { unique: true });
gymPlanSchema.index({ tenantId: 1, isActive: 1 });

export const GymPlan = mongoose.model('GymPlan', gymPlanSchema);
export default GymPlan;
