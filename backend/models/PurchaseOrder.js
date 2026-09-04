import mongoose from 'mongoose';

const purchaseOrderLineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', required: false },
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
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom', default: null },
  packagingId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductPackaging', default: null },
  packagingQty: { type: Number, default: 1, min: 0 },

  lineSubtotal: { type: Number, default: 0 },
  lineTax: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },

  /** Sales: route hint for confirm orchestration (mts | mto | dropship) */
  procurementRoute: {
    type: String,
    enum: ['mts', 'mto', 'dropship', ''],
    default: '',
  },
  /** True when unit price was typed by a user with margin_override */
  priceManuallyOverridden: { type: Boolean, default: false },
}, { _id: true });

const receivingEventSchema = new mongoose.Schema({
  receivedAt: { type: Date, default: Date.now },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', default: null },
    quantity: { type: Number, required: true, min: 0 }
  }]
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  poNumber: { type: String, required: true },
  flow: { type: String, enum: ['sell', 'purchase'], default: 'purchase', index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', index: true },

  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', index: true },

  status: {
    type: String,
    enum: [
      'draft',
      'sent',
      'pending_approval',
      'approved',
      'partially_received',
      'received',
      'refunded',
      'billed',
      'partially_delivered',
      'delivered',
      'closed',
      'cancelled',
    ],
    default: 'draft',
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
  sourceQuotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },

  lineItems: { type: [purchaseOrderLineItemSchema], default: [] },

  /** Per-line discount percent (Phase 2) */
  // lineItems already support via extending schema below in line item

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
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    voucherNumber: { type: String, default: '' },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  notes: { type: String },

  /** Sales CRM — teams, tags, lifecycle gates */
  salesTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesTeam', default: null, index: true },
  salespersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SalesTag' }],
  pricelistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pricelist', default: null },
  incoterm: { type: String, default: '', trim: true },
  deliveryMethodId: { type: String, default: '' },
  shippingCost: { type: Number, default: 0, min: 0 },
  onlineSignatureUrl: { type: String, default: '' },
  signedAt: { type: Date, default: null },
  signedBy: { type: String, default: '' },
  signatureData: { type: String, default: '' },
  paymentConfirmedAt: { type: Date, default: null },
  isLocked: { type: Boolean, default: false },
  quotationTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotationTemplate', default: null },

  /** Credit / margin holds */
  approvalReason: { type: String, default: '' },
  approvalCode: { type: String, default: '' },
  creditExposureAtHold: { type: Number, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date }
}, { timestamps: true });

purchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, status: 1 });
purchaseOrderSchema.index({ tenantId: 1, orderDate: -1 });
purchaseOrderSchema.index({ tenantId: 1, flow: 1, customerId: 1, status: 1 });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, status: 1, orderDate: -1 });

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
