import mongoose from 'mongoose';

/**
 * FurnitureOrder Schema
 * Tracks a furniture sale transaction through its lifecycle.
 */

const lineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'FurnitureProduct', required: true },
  productName: { type: String, required: true },
  productNameAr: { type: String },
  sku: { type: String, required: true },
  quantity: { type: Number, default: 1 },

  // Pricing at sale time
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true },      // quantity * unitPrice
}, { _id: false });

const paymentSnapshotSchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'transfer', 'tabby', 'tamara'], default: 'cash' },
  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  reference: { type: String },                        // transaction reference
}, { _id: false });

const furnitureOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  // Human-readable order number
  orderNumber: { type: String, required: true, index: true },

  // --- Customer ---
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  customerName: { type: String, required: true },
  customerNameAr: { type: String },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  customerIdType: { type: String, enum: ['iqama', 'id', 'vat'], default: 'iqama' },
  customerIdNumber: { type: String },                 // Saudi ID / Iqama / VAT

  // --- Transaction type ---
  transactionType: { type: String, default: 'sale' },

  // --- Items ---
  lineItems: { type: [lineItemSchema], required: true },

  // --- Totals ---
  subtotal: { type: Number, required: true, default: 0 },   // Sum of lineTotals
  discount: { type: Number, default: 0 },                        // Applied discount
  vatApplicable: { type: Boolean, default: true },               // Whether 15% VAT was applied
  totalTax: { type: Number, default: 0 },                        // VAT 15%
  grandTotal: { type: Number, required: true, default: 0 },       // subtotal - discount + tax

  // --- Payments ---
  paymentMethod: { type: String, enum: ['cash', 'card', 'online'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'paid' },
  payments: { type: [paymentSnapshotSchema], default: [] },
  amountPaid: { type: Number, default: 0 },

  // --- Invoice linkage ---
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  invoiceNumber: { type: String },

  // --- Notes & audit ---
  staffNotes: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

furnitureOrderSchema.index({ tenantId: 1, customerPhone: 1, createdAt: -1 });
furnitureOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
furnitureOrderSchema.index({ tenantId: 1, 'lineItems.productId': 1 });

const FurnitureOrder = mongoose.model('FurnitureOrder', furnitureOrderSchema);
export default FurnitureOrder;
