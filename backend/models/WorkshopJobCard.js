import mongoose from 'mongoose';

const jobCardSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  jobCardNumber: { type: String, required: true, unique: true },

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopVehicle', required: true },

  // Reception & Check-In
  checkInDate: { type: Date, default: Date.now },
  expectedCompletion: { type: Date },
  customerComplaints: [{ type: String }],
  reportedSymptoms: [{ type: String }],

  // Pre-Inspection (Digital Checklist)
  preInspection: {
    fuelLevel: { type: String, enum: ['empty', 'quarter', 'half', 'three_quarter', 'full'] },
    existingScratches: [{ description: String, photoUrl: String, location: String }],
    personalBelongings: [{ item: String, quantity: Number }],
    spareWheel: { type: Boolean },
    jackKit: { type: Boolean },
    photos: [String],
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inspectedAt: { type: Date },
  },

  // Legal Verification (Absher)
  repairPermit: {
    required: { type: Boolean, default: false },
    permitNumber: { type: String },
    verifiedAt: { type: Date },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'not_required'] },
    absherResponse: { type: mongoose.Schema.Types.Mixed },
  },

  // Taqdeer Integration
  taqdeer: {
    estimationId: { type: String },
    importedAt: { type: Date },
    parts: [{ partNumber: String, description: String, quantity: Number, unitPrice: Number }],
    laborHours: { type: Number },
    totalEstimate: { type: Number },
  },

  // Estimation / Quote
  estimateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopEstimate' },

  // Mechanic Assignment
  assignedMechanics: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    taskDescription: String,
    estimatedHours: Number,
    actualHours: Number,
    startedAt: Date,
    completedAt: Date,
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'on_hold'], default: 'pending' }
  }],

  // Parts Requisition
  partsUsed: [{
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopInventoryItem' },
    partNumber: String,
    description: String,
    quantity: Number,
    unitCost: Number,
    unitPrice: Number,
    isFromStock: { type: Boolean, default: true },
    poReference: String,
  }],

  // Bay / Workshop Floor Management
  bayNumber: { type: String },

  // Status & State Machine
  status: {
    type: String,
    enum: [
      'checkin',
      'legal_verification',
      'estimation',
      'waiting_approval',
      'approved',
      'rejected',
      'in_progress',
      'waiting_parts',
      'quality_control',
      'ready_pickup',
      'invoiced',
      'delivered',
      'cancelled',
    ],
    default: 'checkin',
    index: true
  },

  // Financial Summary (denormalized for quick reads)
  laborTotal: { type: Number, default: 0 },
  partsTotal: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  vatRate: { type: Number, default: 15 },
  vatAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },

  // Invoice linkage
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

  // Customer Approval
  customerApproval: {
    approvedAt: Date,
    approvalMethod: { type: String, enum: ['sms_otp', 'whatsapp_link', 'digital_signature', 'verbal', 'written'] },
    otpCode: String,
    signatureUrl: String,
    approvedBy: String,
    ipAddress: String,
  },

  // Quality Control
  qcChecklist: [{
    item: String,
    passed: Boolean,
    notes: String,
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedAt: Date,
  }],

  // Absher Permit Closure
  repairPermitClosed: { type: Boolean, default: false },
  repairPermitClosedAt: { type: Date },
  absherClosureReference: { type: String },

  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

jobCardSchema.index({ tenantId: 1, status: 1 });
jobCardSchema.index({ tenantId: 1, vehicleId: 1 });
jobCardSchema.index({ tenantId: 1, customerId: 1 });
jobCardSchema.index({ tenantId: 1, jobCardNumber: 1 });
jobCardSchema.index({ tenantId: 1, bayNumber: 1 });

export default mongoose.model('WorkshopJobCard', jobCardSchema);
