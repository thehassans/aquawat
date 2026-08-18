import mongoose from 'mongoose';

const gymAttendanceSchema = new mongoose.Schema(
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
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymMember',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymSubscription',
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    checkOutTime: {
      type: Date,
    },
    accessPoint: {
      type: String,
      enum: ['front_turnstile', 'main_entrance', 'ladies_section', 'vip_lounge', 'kiosk_scanner', 'manual_desk'],
      default: 'kiosk_scanner',
    },
    accessMethod: {
      type: String,
      enum: ['qr_scan', 'barcode', 'rfid_card', 'phone_search', 'manual'],
      default: 'qr_scan',
    },
    accessStatus: {
      type: String,
      enum: ['granted', 'denied'],
      default: 'granted',
      index: true,
    },
    denialReason: {
      type: String,
      enum: ['none', 'expired_plan', 'frozen_subscription', 'offpeak_restriction', 'not_found', 'inactive_member', 'payment_overdue'],
      default: 'none',
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

gymAttendanceSchema.index({ tenantId: 1, checkInTime: -1 });
gymAttendanceSchema.index({ tenantId: 1, memberId: 1, checkInTime: -1 });

export const GymAttendance = mongoose.model('GymAttendance', gymAttendanceSchema);
export default GymAttendance;
