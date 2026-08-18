import mongoose from 'mongoose';

const gymMeasurementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymMember',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    weightKg: {
      type: Number,
      required: true,
    },
    heightCm: {
      type: Number,
      required: true,
    },
    bodyFatPercentage: {
      type: Number, // e.g. 18.5%
    },
    skeletalMuscleMassKg: {
      type: Number, // e.g. 34.2 kg
    },
    bmi: {
      type: Number, // e.g. 23.4
    },
    bmrKcal: {
      type: Number, // Basal Metabolic Rate e.g. 1750 kcal
    },
    visceralFatLevel: {
      type: Number, // e.g. 6
    },
    bodyWaterPercentage: {
      type: Number, // e.g. 58.2%
    },
    // Circumference measurements in cm
    chestCm: { type: Number },
    waistCm: { type: Number },
    hipsCm: { type: Number },
    armsCm: { type: Number },
    thighsCm: { type: Number },
    shouldersCm: { type: Number },
    calvesCm: { type: Number },
    assessedBy: {
      type: String, // Coach or Staff name
      default: 'Staff Trainer',
    },
    notes: {
      type: String,
      default: '',
    },
    targetWeightKg: {
      type: Number,
    },
    targetBodyFatPercentage: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

gymMeasurementSchema.index({ tenantId: 1, memberId: 1, date: -1 });

export const GymMeasurement = mongoose.model('GymMeasurement', gymMeasurementSchema);
export default GymMeasurement;
