import mongoose from 'mongoose';

const shipmentLineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  description: { type: String },
  quantity: { type: Number, required: true, min: 0 }
}, { _id: false });

const deliveryRecipientSchema = new mongoose.Schema({
  name: { type: String },
  nameAr: { type: String },
  company: { type: String },
  phone: { type: String },
  email: { type: String },
  referenceNumber: { type: String },
  instructions: { type: String },
  address: {
    street: { type: String },
    district: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'SA' },
    buildingNumber: { type: String },
    additionalNumber: { type: String },
  },
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  shipmentNumber: { type: String, required: true },
  type: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
  status: { type: String, enum: ['draft', 'in_transit', 'delivered', 'cancelled'], default: 'draft' },

  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  deliveryNoteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryNote' }],
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },

  carrier: { type: String },
  trackingNumber: { type: String },

  shippedAt: { type: Date },
  expectedDelivery: { type: Date },
  deliveredAt: { type: Date },
  deliveryRecipient: deliveryRecipientSchema,

  lineItems: { type: [shipmentLineItemSchema], default: [] },
  
  totalGrossWeight: { type: Number },
  totalNetWeight: { type: Number },
  boxCount: { type: Number },

  notes: { type: String },

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

shipmentSchema.index({ tenantId: 1, shipmentNumber: 1 }, { unique: true });
shipmentSchema.index({ tenantId: 1, status: 1 });
shipmentSchema.index({ tenantId: 1, shippedAt: -1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);
export default Shipment;
