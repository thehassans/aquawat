import mongoose from 'mongoose';

const crmLeadSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  company: { type: String, trim: true, default: '' },
  source: {
    type: String,
    enum: ['website', 'referral', 'social_media', 'email_campaign', 'whatsapp', 'phone', 'walk_in', 'other'],
    default: 'other',
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'converted', 'lost'],
    default: 'new',
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  estimatedValue: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  nextFollowUpDate: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

crmLeadSchema.index({ tenantId: 1, status: 1 });
crmLeadSchema.index({ tenantId: 1, assignedTo: 1 });
crmLeadSchema.index({ tenantId: 1, name: 'text', email: 'text', phone: 'text', company: 'text' });

export default mongoose.model('CRMLead', crmLeadSchema);
