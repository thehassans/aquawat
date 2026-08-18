import mongoose from 'mongoose';

const gymMeasurementSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymMember', required: true },
  measuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true, default: Date.now },
  weight: { type: Number },
  height: { type: Number },
  bodyFatPercent: { type: Number },
  muscleMassKg: { type: Number },
  bmi: { type: Number },
  bmr: { type: Number },
  visceralFat: { type: Number },
  chest: { type: Number },
  waist: { type: Number },
  hips: { type: Number },
  leftArm: { type: Number },
  rightArm: { type: Number },
  leftThigh: { type: Number },
  rightThigh: { type: Number },
  notes: { type: String },
  photoUrl: { type: String }
}, { timestamps: true });

gymMeasurementSchema.index({ tenantId: 1, memberId: 1, date: -1 });

export default mongoose.models.GymMeasurement || mongoose.model('GymMeasurement', gymMeasurementSchema);
