import mongoose from 'mongoose';

const gymClassBookingSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymClass', required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true },
  bookingDate: { type: Date, required: true },
  status: { type: String, enum: ['confirmed', 'waitlisted', 'attended', 'no_show', 'cancelled'], default: 'confirmed' },
  waitlistPosition: { type: Number, default: 0 },
  bookedAt: { type: Date, default: Date.now },
  cancelledAt: { type: Date }
}, { timestamps: true });

gymClassBookingSchema.index({ tenantId: 1, classId: 1, bookingDate: 1 });
gymClassBookingSchema.index({ tenantId: 1, memberId: 1, bookingDate: 1 });

export default mongoose.models.GymClassBooking || mongoose.model('GymClassBooking', gymClassBookingSchema);
