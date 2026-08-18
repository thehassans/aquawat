import mongoose from 'mongoose';

const gymLockerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  lockerNumber: { type: String, required: true },
  zone: { type: String, enum: ['men', 'women', 'vip', 'unisex'], default: 'unisex' },
  size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
  status: { type: String, enum: ['available', 'occupied', 'maintenance'], default: 'available' },
  assignedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember' },
  assignedFrom: { type: Date },
  assignedUntil: { type: Date },
  depositAmount: { type: Number, default: 0 },
  rentalFee: { type: Number, default: 0 },
  keyCode: { type: String },
  pinCode: { type: String },
  notes: { type: String }
}, { timestamps: true });

gymLockerSchema.pre('save', function (next) {
  if (this.depositAmount !== undefined) {
    this.depositAmount = Math.round(this.depositAmount * 100) / 100;
  }
  if (this.rentalFee !== undefined) {
    this.rentalFee = Math.round(this.rentalFee * 100) / 100;
  }
  next();
});

gymLockerSchema.index({ tenantId: 1, lockerNumber: 1 }, { unique: true });
gymLockerSchema.index({ tenantId: 1, status: 1 });

export default mongoose.models.GymLocker || mongoose.model('GymLocker', gymLockerSchema);
