import mongoose from 'mongoose';

const costLineSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['customs_duty', 'freight', 'insurance', 'port_handling', 'clearance_fees', 'other'],
    required: true
  },
  description: { type: String },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'SAR' },
  exchangeRate: { type: Number, default: 1 },
  amountSAR: { type: Number }
}, { _id: false });

const allocationLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },
  productCode: { type: String },
  quantity: { type: Number, default: 0 },
  unitCostBeforeLanded: { type: Number, default: 0 },
  weight: { type: Number, default: 0 }, // kg
  lineValue: { type: Number, default: 0 }, // value of this product line on PO
  allocatedCost: { type: Number, default: 0 },
  unitLandedCost: { type: Number, default: 0 },
  totalLandedUnitCost: { type: Number, default: 0 }
}, { _id: false });

const landedCostSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  lcNumber: { type: String, required: true },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },

  vendor: { type: String },
  invoiceDate: { type: Date, default: Date.now },
  referenceNumber: { type: String },

  costLines: [costLineSchema],
  totalCost: { type: Number, default: 0 },

  allocationMethod: {
    type: String,
    enum: ['by_value', 'by_weight', 'by_quantity', 'equal'],
    default: 'by_value'
  },
  allocations: [allocationLineSchema],

  status: {
    type: String,
    enum: ['draft', 'calculated', 'posted'],
    default: 'draft'
  },
  postedAt: { type: Date },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Recompute totalCost from costLines before save
landedCostSchema.pre('save', function(next) {
  this.totalCost = (this.costLines || []).reduce((sum, line) => {
    const amountSAR = line.amountSAR != null ? line.amountSAR : (line.amount * (line.exchangeRate || 1));
    line.amountSAR = amountSAR;
    return sum + amountSAR;
  }, 0);
  next();
});

landedCostSchema.index({ tenantId: 1, lcNumber: 1 }, { unique: true });
landedCostSchema.index({ tenantId: 1, status: 1 });
landedCostSchema.index({ tenantId: 1, purchaseOrder: 1 });
landedCostSchema.index({ tenantId: 1, shipment: 1 });

const LandedCost = mongoose.model('LandedCost', landedCostSchema);
export default LandedCost;
