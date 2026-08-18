import mongoose from 'mongoose';

const gymClassAttendeeSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymMember',
      required: true,
    },
    bookedAt: {
      type: Date,
      default: Date.now,
    },
    attended: {
      type: Boolean,
      default: false,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const gymClassSchema = new mongoose.Schema(
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
    titleEn: {
      type: String,
      required: true,
      trim: true,
    },
    titleAr: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['crossfit', 'yoga', 'spinning', 'boxing', 'hiit', 'pilates', 'bodypump', 'zumba', 'swimming', 'aerobics', 'other'],
      default: 'hiit',
    },
    intensityLevel: {
      type: String,
      enum: ['all_levels', 'beginner', 'intermediate', 'advanced'],
      default: 'all_levels',
    },
    instructorName: {
      type: String,
      required: true,
      trim: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    room: {
      type: String,
      default: 'Main Studio',
    },
    capacity: {
      type: Number,
      default: 20,
    },
    startTime: {
      type: String, // e.g. "09:00" or "18:30"
      required: true,
    },
    endTime: {
      type: String, // e.g. "10:00" or "19:30"
      required: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
    },
    daysOfWeek: [
      {
        type: Number, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
      }
    ],
    price: {
      type: Number,
      default: 0, // 0 if free for members with includedClasses
    },
    currency: {
      type: String,
      default: 'SAR',
    },
    attendees: [gymClassAttendeeSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    color: {
      type: String,
      default: '#10B981', // Hex color code for calendar display
    },
  },
  {
    timestamps: true,
  }
);

gymClassSchema.index({ tenantId: 1, isActive: 1 });

export const GymClass = mongoose.model('GymClass', gymClassSchema);
export default GymClass;
