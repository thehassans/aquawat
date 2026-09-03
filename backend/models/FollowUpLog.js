import mongoose from 'mongoose';

const followUpLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', index: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  invoiceNumber: { type: String, default: '' },
  level: { type: Number, default: 1 },
  levelName: { type: String, default: '' },
  channel: {
    type: String,
    enum: ['whatsapp', 'email', 'sms', 'call', 'copy'],
    default: 'whatsapp',
  },
  sentAt: { type: Date, default: Date.now, index: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messageBody: { type: String, default: '' },
  messageEn: { type: String, default: '' },
  messageAr: { type: String, default: '' },
  status: {
    type: String,
    enum: ['preview', 'sent', 'failed', 'delivered', 'read', 'copied', 'wa_link'],
    default: 'sent',
  },
  response: { type: String, default: '' },
  waLink: { type: String, default: '' },
  phone: { type: String, default: '' },
  ageDays: { type: Number, default: 0 },
  residual: { type: Number, default: 0 },
  dryRun: { type: Boolean, default: false },
}, { timestamps: true });

followUpLogSchema.index({ tenantId: 1, invoiceId: 1, sentAt: -1 });
followUpLogSchema.index({ tenantId: 1, customerId: 1, sentAt: -1 });
followUpLogSchema.index({ tenantId: 1, sentAt: -1 });

const FollowUpLog = mongoose.model('FollowUpLog', followUpLogSchema);
export default FollowUpLog;
