import mongoose from 'mongoose';

const dnItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  description: { type: String },
  unitCode: { type: String, default: 'PCE' },
  poItemId: { type: mongoose.Schema.Types.ObjectId },
  quotationItemId: { type: mongoose.Schema.Types.ObjectId },
  quantityDelivered: { type: Number, required: true, min: 0 },
  quantityInvoiced: { type: Number, default: 0, min: 0 }
}, { _id: true });

const deliveryNoteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dnNumber: { type: String, required: true },
  
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  customerName: { type: String },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },
  shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', index: true },
  sourceDocType: { 
    type: String, 
    enum: ['purchase_order', 'quotation', 'manual', 'invoice'], 
    default: 'purchase_order' 
  },
  
  status: { 
    type: String, 
    enum: ['pending_invoice', 'partially_invoiced', 'fully_invoiced', 'delivered', 'cancelled'], 
    default: 'pending_invoice' 
  },
  
  lineItems: [dnItemSchema],
  
  deliveryDate: { type: Date, default: Date.now },
  driverName: { type: String },
  driverPhone: { type: String },
  vehicleNumber: { type: String },
  carrier: { type: String },
  trackingNumber: { type: String },
  recipientName: { type: String },
  recipientSignature: { type: String },
  notes: { type: String },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

deliveryNoteSchema.index({ tenantId: 1, dnNumber: 1 }, { unique: true });
deliveryNoteSchema.index({ tenantId: 1, customerId: 1 });
deliveryNoteSchema.index({ tenantId: 1, quotationId: 1 });
deliveryNoteSchema.index({ tenantId: 1, purchaseOrderId: 1 });
deliveryNoteSchema.index({ tenantId: 1, status: 1 });

const DeliveryNote = mongoose.model('DeliveryNote', deliveryNoteSchema);
export default DeliveryNote;
