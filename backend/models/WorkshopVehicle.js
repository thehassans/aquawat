import mongoose from 'mongoose';

const workshopVehicleSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },

  // Saudi Registration (Istimara)
  plateNumber: { type: String, required: true, index: true },
  plateArabicLetters: { type: String },
  plateNumeric: { type: String },
  istimaraNumber: { type: String },
  istimaraExpiry: { type: Date },

  // Vehicle Identity
  vin: { type: String, index: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number },
  color: { type: String },
  bodyType: { type: String, enum: ['sedan', 'suv', 'truck', 'van', 'bus', 'coupe', 'hatchback', 'other'] },
  fuelType: { type: String, enum: ['petrol', 'diesel', 'hybrid', 'electric'] },

  // Odometer history (array for audit trail)
  odometerReadings: [{
    reading: Number,
    date: Date,
    source: { type: String, enum: ['checkin', 'jobcard', 'inspection'] }
  }],
  currentOdometer: { type: Number, default: 0 },

  // Insurance & Accident History
  insurancePolicyNumber: { type: String },
  insuranceExpiry: { type: Date },
  accidentHistory: [{
    date: Date,
    description: String,
    taqdeerReference: String,
    repairPermitNumber: String,
    isRepaired: { type: Boolean, default: false }
  }],

  // Mojaz Sync Cache
  mojazVehicleData: { type: mongoose.Schema.Types.Mixed },
  mojazLastSync: { type: Date },

  isActive: { type: Boolean, default: true },
  notes: { type: String },
}, { timestamps: true });

workshopVehicleSchema.index({ tenantId: 1, plateNumber: 1 });
workshopVehicleSchema.index({ tenantId: 1, vin: 1 });
workshopVehicleSchema.index({ tenantId: 1, customerId: 1 });

export default mongoose.model('WorkshopVehicle', workshopVehicleSchema);
