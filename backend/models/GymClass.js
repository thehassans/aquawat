import mongoose from 'mongoose';

const gymClassSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String },
  descriptionEn: { type: String },
  descriptionAr: { type: String },
  classType: { 
    type: String, 
    enum: ['crossfit', 'spinning', 'yoga', 'pilates', 'boxing', 'hiit', 'zumba', 'body_pump', 'martial_arts', 'swimming', 'dance', 'stretching', 'functional', 'cardio', 'strength', 'rehabilitation', 'custom'],
    default: 'custom'
  },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymTrainer' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  maxCapacity: { type: Number, default: 20 },
  room: { type: String },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'all_levels'], default: 'all_levels' },
  isActive: { type: Boolean, default: true },
  color: { type: String, default: '#3b82f6' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

gymClassSchema.index({ tenantId: 1, dayOfWeek: 1, isActive: 1 });

export default mongoose.models.GymClass || mongoose.model('GymClass', gymClassSchema);
