import mongoose from 'mongoose';

const gymAttendanceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  checkInTime: { type: Date, required: true, default: Date.now },
  checkOutTime: { type: Date },
  method: { type: String, enum: ['qr_scan', 'rfid', 'manual', 'kiosk', 'phone_lookup'], default: 'manual' },
  accessResult: { 
    type: String, 
    enum: ['granted', 'denied_expired', 'denied_frozen', 'denied_inactive', 'denied_blacklisted', 'denied_no_subscription'], 
    default: 'granted' 
  },
  durationMinutes: { type: Number },
  notes: { type: String }
}, { timestamps: true });

gymAttendanceSchema.index({ tenantId: 1, checkInTime: -1 });
gymAttendanceSchema.index({ tenantId: 1, memberId: 1, checkInTime: -1 });

export default mongoose.models.GymAttendance || mongoose.model('GymAttendance', gymAttendanceSchema);
