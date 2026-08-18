import mongoose from 'mongoose';

const gymMemberSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  memberNumber: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  firstNameAr: { type: String },
  lastNameAr: { type: String },
  email: { type: String },
  phone: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  dateOfBirth: { type: Date },
  nationalId: { type: String },
  photoUrl: { type: String },
  emergencyContactName: { type: String },
  emergencyContactPhone: { type: String },
  healthNotes: { type: String },
  bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''] },
  status: { type: String, enum: ['active', 'inactive', 'blacklisted'], default: 'active', index: true },
  qrCode: { type: String },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  source: { type: String, enum: ['walk_in', 'referral', 'social_media', 'website', 'corporate', 'other'], default: 'walk_in' },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember' },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

gymMemberSchema.index({ tenantId: 1, memberNumber: 1 }, { unique: true });
gymMemberSchema.index({ tenantId: 1, phone: 1 });
gymMemberSchema.index({ tenantId: 1, qrCode: 1 });
gymMemberSchema.index({ tenantId: 1, nationalId: 1 }, { sparse: true });

export default mongoose.models.GymMember || mongoose.model('GymMember', gymMemberSchema);
