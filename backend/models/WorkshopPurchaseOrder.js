import mongoose from 'mongoose';

const workshopPOSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  poNumber: { type: String, required: true, unique: true },

  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  jobCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopJobCard' },

  items: [{
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopInventoryItem' },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
  }],

  subtotal: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  vatRate: { type: Number, default: 15 },
  vatAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['draft', 'sent', 'partial', 'received', 'cancelled'],
    default: 'draft'
  },

  expectedDelivery: { type: Date },
  receivedAt: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

workshopPOSchema.index({ tenantId: 1, poNumber: 1 });
workshopPOSchema.index({ tenantId: 1, jobCardId: 1 });
workshopPOSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('WorkshopPurchaseOrder', workshopPOSchema);
