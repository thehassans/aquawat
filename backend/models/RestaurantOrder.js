import mongoose from 'mongoose';

const orderLineSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantMenuItem' },
  name: { type: String, required: true },
  nameAr: { type: String },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxRate: { type: Number, default: 15 },
  lineSubtotal: { type: Number, default: 0 },
  lineTax: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 }
}, { _id: false });

const restaurantOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

  orderNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'paid', 'cancelled'],
    default: 'open',
    index: true
  },

  kitchenStatus: {
    type: String,
    enum: ['new', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'new',
    index: true
  },
  kitchenPrintedAt: { type: Date },
  kitchenStatusUpdatedAt: { type: Date },

  tableNumber: { type: String },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantTable' },
  orderType: { type: String, enum: ['dine_in', 'takeaway', 'delivery'], default: 'dine_in' },

  customerName: { type: String },
  customerPhone: { type: String },
  deliveryAddress: { type: String },

  currency: { type: String, default: 'SAR' },
  lineItems: [orderLineSchema],
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  discountValue: { type: Number, default: 0 },
  discountReason: { type: String, default: '' },
  totalTax: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'apple_pay', 'stc_pay', 'visa', 'mada', 'mastercard', 'tabby', 'tamara', 'other'], default: 'cash' },
  posPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PosPayment' },
  providerTransactionId: { type: String, default: '' },

  notes: { type: String },

  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
  invoiceNumber: { type: String },
  invoicedAt: { type: Date },

  updateHistory: [{
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changes: { type: String },
    reason: { type: String }
  }],

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

restaurantOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
restaurantOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
restaurantOrderSchema.index({ tenantId: 1, kitchenStatus: 1, createdAt: -1 });

const RestaurantOrder = mongoose.model('RestaurantOrder', restaurantOrderSchema);
export default RestaurantOrder;
