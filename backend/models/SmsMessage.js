import mongoose from 'mongoose';

const smsMessageSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  to: { type: String, required: true, trim: true, index: true },
  body: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed', 'draft'],
    default: 'queued',
    index: true,
  },
  purpose: {
    type: String,
    enum: ['manual', 'invoice', 'quotation', 'campaign', 'test'],
    default: 'manual',
    index: true,
  },
  relatedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
  relatedQuotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },
  relatedCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', index: true },
  provider: { type: String, default: '' },
  providerMessageId: { type: String, default: '' },
  error: { type: String, default: '' },
  sentAt: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

smsMessageSchema.index({ tenantId: 1, createdAt: -1 });
smsMessageSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
smsMessageSchema.index({ tenantId: 1, relatedInvoiceId: 1, createdAt: -1 });

const SmsMessage = mongoose.model('SmsMessage', smsMessageSchema);
export default SmsMessage;
