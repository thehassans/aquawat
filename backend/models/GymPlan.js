import mongoose from 'mongoose';

const gymPlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String },
  descriptionEn: { type: String },
  descriptionAr: { type: String },
  durationDays: { type: Number, enum: [1, 7, 30, 90, 180, 365], required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'SAR' },
  taxRate: { type: Number, default: 15 },
  planType: { 
    type: String, 
    enum: ['day_pass', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'vip', 'student', 'corporate', 'family', 'off_peak', 'custom'],
    default: 'monthly'
  },
  maxFreezeDays: { type: Number, default: 0 },
  includesClasses: { type: Boolean, default: false },
  includesLocker: { type: Boolean, default: false },
  includesPool: { type: Boolean, default: false },
  includesPTSessions: { type: Number, default: 0 },
  branchAccess: { type: String, enum: ['single', 'all'], default: 'single' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

gymPlanSchema.pre('save', function (next) {
  if (this.price !== undefined) {
    this.price = Math.round(this.price * 100) / 100;
  }
  next();
});

gymPlanSchema.index({ tenantId: 1, isActive: 1 });

export default mongoose.models.GymPlan || mongoose.model('GymPlan', gymPlanSchema);
