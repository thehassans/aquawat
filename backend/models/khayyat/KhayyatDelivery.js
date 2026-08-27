import mongoose from 'mongoose';

const deliveryItemSchema = new mongoose.Schema({
  stitchingId: { type: mongoose.Schema.Types.ObjectId, ref: 'KhayyatStitching' },
  receiptNumber: { type: String },
  thawbType: { type: String },
  fabricColor: { type: String },
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
}, { _id: true });

const khayyatDeliverySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  deliveryNumber: { type: String, required: true },

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String },

  // Linked stitching orders
  items: [deliveryItemSchema],

  // Scheduling
  scheduledDate: { type: Date, required: true },
  timeSlot: { type: String }, // "Morning", "Afternoon", "Evening", or "10:00-12:00"

  // Delivery method
  deliveryMethod: {
    type: String,
    enum: ['pickup', 'delivery', 'courier'],
    default: 'pickup',
  },
  driverName: { type: String },
  driverPhone: { type: String },

  // Status
  status: {
    type: String,
    enum: ['scheduled', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'failed', 'cancelled'],
    default: 'scheduled',
  },

  // Notifications
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: { type: Date },
  readyNotificationSent: { type: Boolean, default: false },
  readyNotificationSentAt: { type: Date },
  deliveryConfirmationSent: { type: Boolean, default: false },

  // Completion
  deliveredAt: { type: Date },
  deliveredTo: { type: String }, // Who received
  failedReason: { type: String },
  signatureUrl: { type: String }, // Digital signature or photo proof

  // Payment on delivery
  codAmount: { type: Number, default: 0 }, // Cash on delivery
  codCollected: { type: Boolean, default: false },

  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

khayyatDeliverySchema.index({ tenantId: 1, scheduledDate: 1, status: 1 });
khayyatDeliverySchema.index({ tenantId: 1, customerId: 1 });
khayyatDeliverySchema.index({ tenantId: 1, status: 1 });

export default mongoose.models.KhayyatDelivery || mongoose.model('KhayyatDelivery', khayyatDeliverySchema);
