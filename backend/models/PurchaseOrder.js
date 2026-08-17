import mongoose from 'mongoose';

const purchaseOrderLineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  manualName: { type: String, default: '' },
  uom: { type: String, default: '' },
  description: { type: String },

  productType: { type: String, enum: ['goods', 'service'], default: 'goods' },

  quantityOrdered: { type: Number, required: true, min: 0 },
  quantityReceived: { type: Number, default: 0, min: 0 },
  quantityReturned: { type: Number, default: 0, min: 0 },
  quantityDelivered: { type: Number, default: 0, min: 0 },
  quantityInvoiced: { type: Number, default: 0, min: 0 },

  unitCost: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, default: 15, min: 0 },

  lineSubtotal: { type: Number, default: 0 },
  lineTax: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 }
}, { _id: false });

const receivingEventSchema = new mongoose.Schema({
  receivedAt: { type: Date, default: Date.now },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 0 }
  }]
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  poNumber: { type: String, required: true },
  flow: { type: String, enum: ['sell', 'purchase'], default: 'purchase', index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },

  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', index: true },

  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'partially_received', 'received', 'billed', 'partially_delivered', 'delivered', 'closed', 'cancelled'],
    default: 'draft'
  },

  orderDate: { type: Date, default: Date.now },
  expectedDate: { type: Date },

  currency: { type: String, default: 'SAR' },

  attachments: [{
    name: { type: String },
    url: { type: String },
    key: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
  }],

  billedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

  lineItems: { type: [purchaseOrderLineItemSchema], default: [] },

  subtotal: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  receiving: { type: [receivingEventSchema], default: [] },

  paidAmount: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  payments: [{
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    method: { type: String, default: 'transfer' },
    reference: { type: String, default: '' },
    receiptUrl: { type: String, default: '' },
    receiptName: { type: String, default: '' },
    notes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  notes: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date }
}, { timestamps: true });

purchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, status: 1 });
purchaseOrderSchema.index({ tenantId: 1, orderDate: -1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
