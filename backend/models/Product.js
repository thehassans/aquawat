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
  /**
   * Human-readable immutable product code (P00001). Assigned by sequence — never from count().
   * Distinct from SKU (user-editable ref) and barcode (scan key).
   */
  productId: { type: String, trim: true },
  sku: { type: String, required: true },
  /** Stable id for import/export upserts (never use for display) */
  externalId: { type: String },
  barcode: { type: String },
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
  /** Inventory engine UoM (InvUom). When set, preferred over unitOfMeasure string. */
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom' },
  purchaseUomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom' },
  /** Promoted category document (optional; legacy `category` string remains) */
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductCategory' },
  /** Preferred inventory routes (InvRoute) for procurement */
  routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvRoute' }],
  trackInventory: { type: Boolean, default: true },
  tracking: { type: String, enum: ['none', 'lot', 'serial'], default: 'none' },
  useExpirationDate: { type: Boolean, default: false },
  expirationDays: { type: Number, default: 0 },
  useByDays: { type: Number, default: 0 },
  removalDays: { type: Number, default: 0 },
  alertDays: { type: Number, default: 0 },
  canBeSold: { type: Boolean, default: true },
  canBePurchased: { type: Boolean, default: true },
  canBeExpensed: { type: Boolean, default: false },
  canBeSoldOnPos: { type: Boolean, default: true },
  invoicingPolicy: { type: String, enum: ['ordered', 'delivered'], default: 'ordered' },
  isFavorite: { type: Boolean, default: false },
  internalNotes: { type: String },
  salesDescription: { type: String },
  purchaseDescription: { type: String },
  minSaleQty: { type: Number, default: 0 },
  saleMultiple: { type: Number, default: 1 },
  controlPolicy: { type: String, enum: ['ordered', 'received'], default: 'received' },
  daysToPurchase: { type: Number, default: 0 },
  hsCode: { type: String, trim: true },
  countryOfOrigin: { type: String, trim: true },
  volume: { type: Number },
  allowNegativeStock: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  incomeAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  expenseAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  stockValuationAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  stockInputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  stockOutputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },

  
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
  
  // Images (main + up to 8 extras; thumbUrl for list views)
  images: [{
    url: { type: String },
    thumbUrl: { type: String },
    isPrimary: { type: Boolean, default: false },
    alt: { type: String },
    sortOrder: { type: Number, default: 0 },
  }],

  /**
   * Attribute lines for this product template (variants tab).
   * createVariantMode: always | dynamic | never
   */
  attributeLines: [{
    attributeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductAttribute', required: true },
    valueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvAttributeValue' }],
    createVariantMode: {
      type: String,
      enum: ['always', 'dynamic', 'never'],
      default: 'always',
    },
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
productSchema.index({ tenantId: 1, productId: 1 }, { unique: true, sparse: true });
productSchema.index({ tenantId: 1, externalId: 1 }, { unique: true, sparse: true });
productSchema.index(
  { tenantId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: 'string', $gt: '' } },
  },
);
productSchema.index({ tenantId: 1, category: 1 });
productSchema.index({ tenantId: 1, productType: 1 });
productSchema.index({ tenantId: 1, status: 1 });
productSchema.index({ tenantId: 1, allowNegativeStock: 1 });
productSchema.index({ tenantId: 1, nameEn: 'text', nameAr: 'text', sku: 'text', barcode: 'text', productId: 'text' });

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
