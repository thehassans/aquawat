import mongoose from 'mongoose';

const crmActivitySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  type: {
    type: String,
    enum: ['call', 'meeting', 'email', 'note', 'task', 'whatsapp', 'sms'],
    required: true,
  },
  subject: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // Polymorphic linkage
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMLead', default: null },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMDeal', default: null },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['pending', 'done', 'cancelled'], default: 'pending' },
  dueDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

crmActivitySchema.index({ tenantId: 1, type: 1 });
crmActivitySchema.index({ tenantId: 1, leadId: 1 });
crmActivitySchema.index({ tenantId: 1, dealId: 1 });
crmActivitySchema.index({ tenantId: 1, dueDate: 1 });

export default mongoose.model('CRMActivity', crmActivitySchema);
