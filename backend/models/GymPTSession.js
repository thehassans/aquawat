import mongoose from 'mongoose';

const gymPTSessionSchema = new mongoose.Schema(
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
    trainerName: {
      type: String,
      required: true,
      trim: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    sessionDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    sessionTime: {
      type: String, // e.g. "17:00"
      required: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
    },
    workoutFocus: {
      type: String,
      enum: ['chest_triceps', 'back_biceps', 'legs_glutes', 'shoulders_abs', 'hiit_cardio', 'strength_powerlifting', 'rehab_mobility', 'full_body'],
      default: 'full_body',
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
      index: true,
    },
    trainerNotes: {
      type: String,
      default: '',
    },
    trainerCommission: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'SAR',
    },
  },
  {
    timestamps: true,
  }
);

gymPTSessionSchema.index({ tenantId: 1, sessionDate: -1 });
gymPTSessionSchema.index({ tenantId: 1, memberId: 1, sessionDate: -1 });

export const GymPTSession = mongoose.model('GymPTSession', gymPTSessionSchema);
export default GymPTSession;
