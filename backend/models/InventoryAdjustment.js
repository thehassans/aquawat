import mongoose from 'mongoose';

const inventoryAdjustmentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  adjustmentNumber: { type: String, required: true },
  dateAdjusted: { type: Date, default: Date.now },
  adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, required: true }, // e.g. 'Shrinkage', 'Damage', 'Found'
  notes: { type: String },
  lines: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    barcode: { type: String },
    systemQuantity: { type: Number },
    actualQuantity: { type: Number, required: true },
    difference: { type: Number, required: true }, // actualQuantity - systemQuantity
    unitCost: { type: Number }
  }]
}, { timestamps: true });

inventoryAdjustmentSchema.index({ tenantId: 1, adjustmentNumber: 1 }, { unique: true });

export default mongoose.models.InventoryAdjustment || mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema);
