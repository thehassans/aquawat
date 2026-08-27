import mongoose from 'mongoose';

const workshopInventorySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String },
  description: { type: String },

  category: { type: String, index: true },
  subCategory: { type: String },

  compatibleMakes: [String],
  compatibleModels: [String],
  compatibleYears: [{ from: Number, to: Number }],
  oemPartNumbers: [String],
  aftermarketPartNumbers: [String],

  quantityOnHand: { type: Number, default: 0 },
  quantityReserved: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 5 },
  reorderQuantity: { type: Number, default: 10 },

  costPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  markupPercent: { type: Number, default: 20 },

  primarySupplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  supplierPartNumber: { type: String },
  leadTimeDays: { type: Number, default: 1 },

  warehouseLocation: { type: String },
  binNumber: { type: String },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

workshopInventorySchema.index({ tenantId: 1, sku: 1 });
workshopInventorySchema.index({ tenantId: 1, category: 1 });
workshopInventorySchema.index({ tenantId: 1, compatibleMakes: 1 });

export default mongoose.model('WorkshopInventoryItem', workshopInventorySchema);
