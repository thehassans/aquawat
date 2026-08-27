import mongoose from 'mongoose';

const grnLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId },
  productName: { type: String },
  barcode: { type: String },
  productType: { type: String, enum: ['goods', 'service'], default: 'goods' },
  uom: { type: String, default: '' },
  quantityOrdered: { type: Number, default: 0 },
  quantityReceived: { type: Number, required: true, min: 0 },
  quantityReturned: { type: Number, default: 0, min: 0 },
  costPrice: { type: Number },
  expiryDate: { type: Date },
  batchNumber: { type: String },
  isDelayed: { type: Boolean, default: false },
  delayedUntil: { type: Date },
  delayReason: { type: String },
  notes: { type: String }
}, { _id: true });

const grnSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', index: true },
  grnNumber: { type: String, required: true },
  referenceNumber: { type: String },
  dateReceived: { type: Date, default: Date.now },
  expectedDate: { type: Date },
  status: {
    type: String,
    enum: ['draft', 'received', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  stockPostedAt: { type: Date },
  /** Inventory engine transfer created on confirm (when engineEnabled) */
  inventoryTransferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer' },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  lines: { type: [grnLineSchema], default: [] }
}, { timestamps: true });

grnSchema.index({ tenantId: 1, grnNumber: 1 }, { unique: true });
grnSchema.index({ tenantId: 1, status: 1 });
grnSchema.index({ tenantId: 1, warehouseId: 1 });

export default mongoose.models.GRN || mongoose.model('GRN', grnSchema);
