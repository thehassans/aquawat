import mongoose from 'mongoose';

const sessionLogSchema = new mongoose.Schema({
  date: { type: Date },
  durationMinutes: { type: Number },
  notes: { type: String },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymTrainer' }
});

const gymPTPackageSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymTrainer', required: true },
  packageName: { type: String, required: true },
  totalSessions: { type: Number, required: true },
  usedSessions: { type: Number, default: 0 },
  remainingSessions: { type: Number, required: true },
  pricePerSession: { type: Number },
  totalPrice: { type: Number, required: true },
  currency: { type: String },
  taxRate: { type: Number },
  sessionLog: [sessionLogSchema],
  status: { type: String, enum: ['active', 'exhausted', 'expired', 'cancelled'], default: 'active' },
  expiryDate: { type: Date },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'card', 'transfer', 'mada', 'apple_pay', 'bkash', 'jazzcash', 'other'],
    default: 'cash'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

gymPTPackageSchema.pre('save', function (next) {
  if (this.totalPrice !== undefined) {
    this.totalPrice = Math.round(this.totalPrice * 100) / 100;
  }
  if (this.pricePerSession !== undefined) {
    this.pricePerSession = Math.round(this.pricePerSession * 100) / 100;
  }
  next();
});

gymPTPackageSchema.index({ tenantId: 1, memberId: 1, status: 1 });

export default mongoose.models.GymPTPackage || mongoose.model('GymPTPackage', gymPTPackageSchema);
