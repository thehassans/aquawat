import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  url: { type: String, default: '' },
  type: { type: String, default: '' },
  size: { type: Number, default: 0 },
  contentId: { type: String, default: '' },
  contentBase64: { type: String, default: '' },
}, { _id: false });

const emailMessageSchema = new mongoose.Schema({
  ownerType: { type: String, enum: ['tenant', 'super_admin'], default: 'tenant', index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  relatedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
  messageId: { type: String, default: '', index: true },
  threadId: { type: String, default: '', index: true },
  to: { type: [String], default: [] },
  cc: { type: [String], default: [] },
  bcc: { type: [String], default: [] },
  from: { type: String, required: true, index: true },
  subject: { type: String, default: '', trim: true },
  bodyHtml: { type: String, default: '' },
  bodyText: { type: String, default: '' },
  previewText: { type: String, default: '' },
  isRead: { type: Boolean, default: false, index: true },
  type: { type: String, enum: ['inbox', 'sent', 'draft'], default: 'inbox', index: true },
  direction: { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
  status: { type: String, enum: ['received', 'queued', 'sent', 'failed', 'draft'], default: 'received', index: true },
  attachments: { type: [attachmentSchema], default: [] },
  delivery: {
    provider: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
    error: { type: String, default: '' },
    sentAt: { type: Date },
    receivedAt: { type: Date },
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

emailMessageSchema.index({ tenantId: 1, createdAt: -1 });

emailMessageSchema.pre('validate', function(next) {
  if (this.ownerType === 'tenant' && !this.tenantId) {
    this.invalidate('tenantId', 'Path `tenantId` is required when ownerType is `tenant`.');
  }

  if (!this.previewText) {
    const plainText = String(this.bodyText || this.bodyHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    this.previewText = plainText.slice(0, 220);
  }

  if (!this.bodyText && this.bodyHtml) {
    this.bodyText = String(this.bodyHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (this.type === 'sent') {
    this.direction = 'outgoing';
    if (this.status === 'received') this.status = 'sent';
  }

  if (this.type === 'draft') {
    this.status = 'draft';
  }

  next();
});

emailMessageSchema.index({ ownerType: 1, type: 1, createdAt: -1 });
emailMessageSchema.index({ ownerType: 1, isRead: 1, createdAt: -1 });
emailMessageSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
emailMessageSchema.index({ tenantId: 1, isRead: 1, createdAt: -1 });
emailMessageSchema.index({ tenantId: 1, relatedInvoiceId: 1, createdAt: -1 });
emailMessageSchema.index({ tenantId: 1, messageId: 1 }, { sparse: true });

const EmailMessage = mongoose.model('EmailMessage', emailMessageSchema);
export default EmailMessage;
