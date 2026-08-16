import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  quantity: { type: Number, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  minQuantity: { type: Number, default: 0 },
  maxQuantity: { type: Number },
  reorderPoint: { type: Number, default: 10 },
  lastStockUpdate: { type: Date, default: Date.now },
  location: {
    aisle: { type: String },
    rack: { type: String },
    shelf: { type: String },
    bin: { type: String }
  }
});

const landedCostSchema = new mongoose.Schema({
  purchasePrice: { type: Number, required: true },
  customsDuty: { type: Number, default: 0 },
  freight: { type: Number, default: 0 },
  insurance: { type: Number, default: 0 },
  otherCosts: { type: Number, default: 0 },
  quantity: { type: Number, required: true },
  totalLandedCost: { type: Number },
  unitLandedCost: { type: Number },
  date: { type: Date, default: Date.now },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  notes: { type: String }
});

const bomComponentSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0 },
  notes: { type: String }
}, { _id: false });

const productSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  // Basic Info
  sku: { type: String, required: true },
  barcode: { type: String, index: true },
  qrCode: { type: String },
  nameEn: { type: String, required: true },
  nameAr: { type: String },
  descriptionEn: { type: String },
  descriptionAr: { type: String },
  
  // Categorization
  productType: { type: String, enum: ['goods', 'service'], default: 'goods', index: true },
  category: { type: String },
  subcategory: { type: String },
  brand: { type: String },
  manufacturer: { type: String },
  tags: [{ type: String }],
  
  // Pricing
  costPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, required: true },
  wholesalePrice: { type: Number },
  currency: { type: String, default: 'SAR' },
  
  // Tax
  taxCategory: { type: String, enum: ['S', 'Z', 'E', 'O'], default: 'S' },
  taxRate: { type: Number, default: 15 },
  
  // Units
  unitOfMeasure: { type: String, default: 'PCE' },
  unitOfMeasureAr: { type: String, default: 'قطعة' },
  unitsPerPack: { type: Number, default: 1 },
  
  // Physical Attributes
  weight: { type: Number },
  weightUnit: { type: String, enum: ['kg', 'g', 'lb', 'oz'], default: 'kg' },
  dimensions: {
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
    unit: { type: String, enum: ['cm', 'in', 'm'], default: 'cm' }
  },
  
  // Stock Management (Multi-Warehouse)
  stocks: [stockSchema],
  totalStock: { type: Number, default: 0 },
  
  // Landed Cost History
  landedCostHistory: [landedCostSchema],
  averageLandedCost: { type: Number, default: 0 },
  
  // Images
  images: [{
    url: { type: String },
    isPrimary: { type: Boolean, default: false },
    alt: { type: String }
  }],
  
  // Supplier Info
  suppliers: [{
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    supplierSku: { type: String },
    cost: { type: Number },
    leadTimeDays: { type: Number },
    isPreferred: { type: Boolean, default: false }
  }],

  // BOM (optional)
  isManufactured: { type: Boolean, default: false },
  bomComponents: { type: [bomComponentSchema], default: [] },
  
  // Inventory Control
  allowNegativeStock: { type: Boolean, default: false },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'out_of_stock'],
    default: 'active'
  },
  isActive: { type: Boolean, default: true },
  
  // AI/Analytics
  predictedDemand: {
    nextMonth: { type: Number },
    nextQuarter: { type: Number },
    confidence: { type: Number },
    lastCalculated: { type: Date }
  },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index({ tenantId: 1, barcode: 1 });
productSchema.index({ tenantId: 1, category: 1 });
productSchema.index({ tenantId: 1, productType: 1 });
productSchema.index({ tenantId: 1, status: 1 });
productSchema.index({ tenantId: 1, allowNegativeStock: 1 });
productSchema.index({ tenantId: 1, nameEn: 'text', nameAr: 'text', sku: 'text', barcode: 'text' });

productSchema.pre('save', function(next) {
  const stocks = Array.isArray(this.stocks) ? this.stocks : [];
  this.totalStock = stocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  next();
});

// Virtual for available stock. Populate/select often omits `stocks`, so never assume it is an array.
productSchema.virtual('availableStock').get(function() {
  const stocks = Array.isArray(this.stocks) ? this.stocks : [];
  return stocks.reduce((total, stock) => {
    return total + (Number(stock?.quantity) || 0) - (Number(stock?.reservedQuantity) || 0);
  }, 0);
});

// Method to calculate landed cost
productSchema.methods.calculateLandedCost = function(costs) {
  const { purchasePrice, customsDuty = 0, freight = 0, insurance = 0, otherCosts = 0, quantity } = costs;
  const totalCost = (purchasePrice * quantity) + customsDuty + freight + insurance + otherCosts;
  const unitCost = totalCost / quantity;
  
  this.landedCostHistory.push({
    ...costs,
    totalLandedCost: totalCost,
    unitLandedCost: unitCost
  });
  
  // Recalculate average landed cost (weighted average)
  const totalQuantity = this.landedCostHistory.reduce((sum, lc) => sum + lc.quantity, 0);
  const totalValue = this.landedCostHistory.reduce((sum, lc) => sum + lc.totalLandedCost, 0);
  this.averageLandedCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;
  this.costPrice = this.averageLandedCost;
  
  return unitCost;
};

// Method to update stock for a warehouse
productSchema.methods.updateStock = function(warehouseId, quantityChange, isReserved = false) {
  const stockIndex = this.stocks.findIndex(s => s.warehouseId.toString() === warehouseId.toString());
  
  if (stockIndex === -1) {
    this.stocks.push({
      warehouseId,
      quantity: isReserved ? 0 : quantityChange,
      reservedQuantity: isReserved ? quantityChange : 0
    });
  } else {
    if (isReserved) {
      this.stocks[stockIndex].reservedQuantity += quantityChange;
    } else {
      this.stocks[stockIndex].quantity += quantityChange;
    }
    this.stocks[stockIndex].lastStockUpdate = new Date();
  }
  
  // Recalculate total stock
  this.totalStock = this.stocks.reduce((sum, s) => sum + s.quantity, 0);
  
  return this.stocks[stockIndex === -1 ? this.stocks.length - 1 : stockIndex];
};

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);
export default Product;
