import mongoose from 'mongoose';

const bakalaProductSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // Optional ref to global catalog
  name: { type: String, required: true },
  nameAr: { type: String },
  barcodes: [{ type: String }],
  primaryBarcode: { type: String, required: true },
  expiryDate: { type: Date },
  batchNumber: { type: String },
  batches: [{
    batchNumber: { type: String },
    expiryDate: { type: Date },
    quantity: { type: Number, default: 0 }
  }],
  category: { type: String },
  brand: { type: String },
  unit: { type: String, default: 'PCS' },
  stockQuantity: { type: Number, default: 0 },
  minimumStockAlertLevel: { type: Number, default: 10 },
  costPrice: { type: Number, default: 0 },
  retailPrice: { type: Number, required: true, default: 0 },
  taxRate: { type: Number, default: 15 },
  genericName: { type: String, default: '' },
  sfdaRegisterNumber: { type: String, default: '' },
  dosageForm: { type: String, default: '' },
  strength: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  requiresPrescription: { type: Boolean, default: false },
  isControlled: { type: Boolean, default: false },
  mixAndMatchPromo: {
    isActive: { type: Boolean, default: false },
    buyQty: { type: Number },
    getQtyFree: { type: Number },
    discountPercent: { type: Number },
    endDate: { type: Date }
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Ensure precision rounding on save
bakalaProductSchema.pre('save', function(next) {
  if (this.costPrice) this.costPrice = Math.round(this.costPrice * 100) / 100;
  if (this.retailPrice) this.retailPrice = Math.round(this.retailPrice * 100) / 100;
  next();
});

bakalaProductSchema.index({ tenantId: 1, primaryBarcode: 1 }, { unique: true });
bakalaProductSchema.index({ tenantId: 1, barcodes: 1 });
bakalaProductSchema.index({ tenantId: 1, expiryDate: 1 }); // For Balady compliance queries

export default mongoose.models.BakalaProduct || mongoose.model('BakalaProduct', bakalaProductSchema);
