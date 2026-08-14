import mongoose from 'mongoose';

const orderLineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcommerceProduct' },
  productTitle: { type: String, required: true },
  productImage: { type: String, default: '' },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantLabel: { type: String, default: '' },
  sku: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  taxRate: { type: Number, default: 15 },
  taxAmount: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true },
}, { _id: true });

const orderCustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  // Shipping address
  addressLine1: { type: String, default: '' },
  addressLine2: { type: String, default: '' },
  city: { type: String, default: '' },
  region: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  country: { type: String, default: 'Saudi Arabia' },
  notes: { type: String, default: '' },
}, { _id: false });

const orderPaymentSchema = new mongoose.Schema({
  method: { type: String, enum: ['cod', 'moyasar', 'tap', 'paytabs', 'stripe', 'tabby', 'tamara', 'manual'], default: 'cod' },
  provider: { type: String, default: '' },
  providerTransactionId: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'], default: 'pending' },
  paidAt: { type: Date, default: null },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' },
}, { _id: false });

const orderShippingSchema = new mongoose.Schema({
  method: { type: String, enum: ['flat_rate', 'smsa', 'aramex', 'naqel', 'imile', 'jnt', 'spl', 'fedex', 'dhl', 'ups', 'tnt', 'pickup', 'manual'], default: 'flat_rate' },
  courier: { type: String, default: '' },
  trackingNumber: { type: String, default: '' },
  cost: { type: Number, default: 0 },
  status: { type: String, enum: ['unfulfilled', 'fulfilled', 'in_transit', 'delivered', 'returned'], default: 'unfulfilled' },
  fulfilledAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
}, { _id: false });

const ecommerceOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  orderNumber: { type: String, required: true, unique: false },
  // State machine: pending → confirmed → processing → shipped → delivered → completed
  //                  ↓ cancelled              ↓ returned
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'returned'],
    default: 'pending',
    index: true,
  },
  // Customer
  customer: { type: orderCustomerSchema, required: true },
  // Line items
  lineItems: { type: [orderLineItemSchema], required: true, validate: v => v.length > 0 },
  // Totals
  subtotal: { type: Number, required: true, default: 0 },
  discount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'SAR' },
  // Payment
  payment: { type: orderPaymentSchema, default: () => ({}) },
  // Shipping / Fulfillment
  shipping: { type: orderShippingSchema, default: () => ({}) },
  // Metadata
  source: { type: String, enum: ['storefront', 'admin', 'api', 'woocommerce'], default: 'storefront' },
  customerIp: { type: String, default: '' },
  notes: { type: String, default: '' },
  tags: [{ type: String }],
  // Timeline
  statusHistory: [{
    status: { type: String, required: true },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  }],
  // External integrations
  integration: {
    wordpressOrderId: { type: Number, default: null },
    source: { type: String, default: '' },
  },
  // Relations
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-generate order number: ORD-YYYYMMDD-XXXX
ecommerceOrderSchema.pre('validate', async function(next) {
  if (this.orderNumber) return next();
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const count = await mongoose.models.EcommerceOrder.countDocuments({ tenantId: this.tenantId });
  const seq = String(count + 1).padStart(4, '0');
  this.orderNumber = `ORD-${dateStr}-${seq}`;
  next();
});

// Record status changes in history
ecommerceOrderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.$__.skipHistory) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
    });
  }
  next();
});

ecommerceOrderSchema.index({ tenantId: 1, status: 1 });
ecommerceOrderSchema.index({ tenantId: 1, orderNumber: 1 });
ecommerceOrderSchema.index({ tenantId: 1, 'customer.name': 'text', 'customer.email': 'text', 'customer.phone': 'text' });
ecommerceOrderSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.models.EcommerceOrder || mongoose.model('EcommerceOrder', ecommerceOrderSchema);
