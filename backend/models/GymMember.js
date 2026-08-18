import mongoose from 'mongoose';

const gymMemberSchema = new mongoose.Schema(
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
    memberNumber: {
      type: String,
      required: true,
      index: true,
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male',
    },
    dob: {
      type: Date,
    },
    // Multi-country identity support (Saudi Iqama / National ID, Bangladesh NID, Pakistan CNIC, Global Passport)
    identityType: {
      type: String,
      enum: ['national_id', 'iqama', 'nid', 'cnic', 'passport', 'other'],
      default: 'national_id',
    },
    identityNumber: {
      type: String,
      trim: true,
      default: '',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    barcode: {
      type: String,
      index: true,
    },
    rfidCardNumber: {
      type: String,
      trim: true,
      index: true,
    },
    emergencyContact: {
      name: { type: String, default: '' },
      relationship: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    medicalConditions: {
      type: String,
      default: '',
    },
    fitnessGoal: {
      type: String,
      enum: ['weight_loss', 'muscle_gain', 'endurance', 'strength', 'flexibility', 'general_fitness', 'rehab'],
      default: 'general_fitness',
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'ar', 'bn', 'ur'],
      default: 'en',
    },
    assignedTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    activeSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymSubscription',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'frozen', 'inactive'],
      default: 'active',
      index: true,
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

gymMemberSchema.index({ tenantId: 1, memberNumber: 1 }, { unique: true });
gymMemberSchema.index({ tenantId: 1, phone: 1 });
gymMemberSchema.index({ tenantId: 1, status: 1 });

export const GymMember = mongoose.model('GymMember', gymMemberSchema);
export default GymMember;
