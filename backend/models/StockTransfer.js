import mongoose from 'mongoose';

const transferLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  sku: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number }
});

const stockTransferSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  transferNumber: { type: String, required: true },
  sourceWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  destinationWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  status: { type: String, enum: ['Draft', 'In Transit', 'Completed', 'Cancelled'], default: 'Draft' },
  transferDate: { type: Date, default: Date.now },
  expectedArrivalDate: { type: Date },
  shippedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  lines: [transferLineSchema]
}, { timestamps: true });

stockTransferSchema.index({ tenantId: 1, transferNumber: 1 }, { unique: true });
stockTransferSchema.index({ tenantId: 1, status: 1 });

export default mongoose.models.StockTransfer || mongoose.model('StockTransfer', stockTransferSchema);
