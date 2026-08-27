import mongoose from 'mongoose';

const serviceReminderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopVehicle', required: true },
  vehicleDisplay: { type: String }, // "Toyota Camry 2018 - 1234 ABC"
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  customerName: { type: String },
  customerPhone: { type: String },

  reminderType: {
    type: String,
    enum: ['oil_change', 'tire_rotation', 'brake_check', 'general_inspection', 'fahas_renewal', 'insurance_renewal', 'istimara_renewal', 'battery_check', 'coolant_flush', 'transmission_service', 'custom'],
    required: true,
  },
  customLabel: { type: String },

  // Recurrence rules
  intervalKm: { type: Number, default: 0 }, // e.g., 10000 km
  intervalDays: { type: Number, default: 0 }, // e.g., 180 days
  lastServiceKm: { type: Number, default: 0 },
  lastServiceDate: { type: Date },

  // Next due
  nextDueDate: { type: Date },
  nextDueKm: { type: Number },

  // Notification
  alertDaysBefore: { type: Number, default: 7 },
  alertKmBefore: { type: Number, default: 500 },
  lastAlertSentAt: { type: Date },
  alertSent: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['active', 'snoozed', 'completed', 'disabled'],
    default: 'active',
  },

  snoozedUntil: { type: Date },

  // Service package template
  isPackage: { type: Boolean, default: false },
  packageServices: [{ type: String }],

  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

serviceReminderSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });
serviceReminderSchema.index({ tenantId: 1, status: 1, nextDueDate: 1 });
serviceReminderSchema.index({ tenantId: 1, customerId: 1 });

export default mongoose.models.WorkshopServiceReminder || mongoose.model('WorkshopServiceReminder', serviceReminderSchema);
