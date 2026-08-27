import mongoose from 'mongoose';

const measurementFieldsSchema = new mongoose.Schema({
  length: { type: Number, default: null },
  shoulderWidth: { type: Number, default: null },
  chest: { type: Number, default: null },
  waist: { type: Number, default: null },
  hips: { type: Number, default: null },
  sleeveLength: { type: Number, default: null },
  bicep: { type: Number, default: null },
  forearm: { type: Number, default: null },
  neck: { type: Number, default: null },
  wrist: { type: Number, default: null },
  cuffWidth: { type: Number, default: null },
  expansion: { type: Number, default: null },
  armhole: { type: Number, default: null },
  bottom: { type: Number, default: null },
}, { _id: false });

const measurementHistoryEntrySchema = new mongoose.Schema({
  recordedAt: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  measurements: { type: measurementFieldsSchema, default: () => ({}) },
  notes: { type: String },
  sourceStitchingId: { type: mongoose.Schema.Types.ObjectId, ref: 'KhayyatStitching' },
}, { _id: true });

const khayyatMeasurementProfileSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },

  // Profile can be for the customer or a relation (son, father, etc.)
  profileName: { type: String, default: 'Self' }, // e.g., "Self", "Son - Ahmed", "Father"
  relationType: { type: String, default: 'self' }, // self, son, father, brother, etc.

  // Current measurements (latest)
  measurements: { type: measurementFieldsSchema, default: () => ({}) },

  // Measurement history for tracking changes over time
  history: [measurementHistoryEntrySchema],

  // Preferred style defaults
  defaultThawbType: {
    type: String,
    enum: ['saudi', 'qatari', 'emirati', 'kuwaiti', 'omani', 'bahraini', 'noum'],
    default: 'saudi',
  },
  defaultFabricColor: {
    type: String,
    enum: ['white', 'cream', 'offwhite', 'beige', 'grey', 'black', 'navy', 'brown', null],
    default: 'white',
  },

  // Notes
  notes: { type: String },
  measurementImage: { type: String }, // URL to uploaded measurement photo

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

khayyatMeasurementProfileSchema.index({ tenantId: 1, customerId: 1, profileName: 1 }, { unique: true });

export default mongoose.models.KhayyatMeasurementProfile || mongoose.model('KhayyatMeasurementProfile', khayyatMeasurementProfileSchema);
