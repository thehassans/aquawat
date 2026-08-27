import mongoose from 'mongoose';

const estimateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  estimateNumber: { type: String, required: true, unique: true },

  jobCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopJobCard', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopVehicle', required: true },

  // Line Items
  laborItems: [{
    description: { type: String, required: true },
    hours: { type: Number, default: 0 },
    ratePerHour: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  }],

  partsItems: [{
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopInventoryItem' },
    partNumber: String,
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    isOem: { type: Boolean, default: true },
    total: { type: Number, default: 0 },
  }],

  // Financials
  laborTotal: { type: Number, default: 0 },
  partsTotal: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  vatRate: { type: Number, default: 15 },
  vatAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  // Customer Communication
  sentToCustomerAt: { type: Date },
  sentVia: { type: String, enum: ['sms', 'whatsapp', 'email'] },
  publicApprovalLink: { type: String },
  linkExpiry: { type: Date },

  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'rejected', 'expired', 'converted'],
    default: 'draft'
  },

  approvalNotes: { type: String },
  rejectedReason: { type: String },

  expiryDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

estimateSchema.index({ tenantId: 1, estimateNumber: 1 });
estimateSchema.index({ tenantId: 1, jobCardId: 1 });
estimateSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('WorkshopEstimate', estimateSchema);
