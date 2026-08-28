import mongoose from 'mongoose';

const salesPaymentTransactionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPaymentProvider', required: true },
  methodId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPaymentMethod', default: null },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  externalId: { type: String, default: '', index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'SAR' },
  status: {
    type: String,
    enum: ['pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
  },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

salesPaymentTransactionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export default mongoose.model('SalesPaymentTransaction', salesPaymentTransactionSchema);
