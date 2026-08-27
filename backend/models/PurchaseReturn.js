import mongoose from 'mongoose';

const purchaseReturnLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId },
  productName: { type: String },
  barcode: { type: String },
  productType: { type: String, enum: ['goods', 'service'], default: 'goods' },
  quantityReturned: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
  reason: { type: String },
  notes: { type: String },
  grnLineIndex: { type: Number }
}, { _id: true });

const purchaseReturnSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', index: true },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
  grnId: { type: mongoose.Schema.Types.ObjectId, ref: 'GRN', index: true },
  returnNumber: { type: String, required: true },
  referenceNumber: { type: String },
  dateReturned: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['draft', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  reason: { type: String },
  returnAmount: { type: Number, default: 0 },
  stockPostedAt: { type: Date },
  inventoryTransferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer' },
  cancelledAt: { type: Date },
  lines: { type: [purchaseReturnLineSchema], default: [] }
}, { timestamps: true });

purchaseReturnSchema.index({ tenantId: 1, returnNumber: 1 }, { unique: true });
purchaseReturnSchema.index({ tenantId: 1, status: 1 });

export default mongoose.models.PurchaseReturn || mongoose.model('PurchaseReturn', purchaseReturnSchema);
