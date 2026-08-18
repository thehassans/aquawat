import mongoose from 'mongoose';

const gymLockerSchema = new mongoose.Schema(
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
    lockerNumber: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      enum: ['mens_area', 'womens_area', 'vip_lounge', 'main_hallway', 'swimming_pool'],
      default: 'main_hallway',
    },
    size: {
      type: String,
      enum: ['standard', 'large', 'vip_executive'],
      default: 'standard',
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'reserved'],
      default: 'available',
      index: true,
    },
    currentMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymMember',
    },
    rentalStartDate: {
      type: Date,
    },
    rentalEndDate: {
      type: Date,
      index: true,
    },
    keyPinCode: {
      type: String,
      default: '',
    },
    rentalFee: {
      type: Number,
      default: 0,
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'SAR',
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

gymLockerSchema.index({ tenantId: 1, lockerNumber: 1 }, { unique: true });
gymLockerSchema.index({ tenantId: 1, status: 1 });

export const GymLocker = mongoose.model('GymLocker', gymLockerSchema);
export default GymLocker;
