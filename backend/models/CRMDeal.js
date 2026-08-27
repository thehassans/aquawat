import mongoose from 'mongoose';

const crmDealSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMLead', default: null },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  stage: {
    type: String,
    enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    default: 'prospecting',
  },
  value: { type: Number, default: 0 },
  probability: { type: Number, default: 10, min: 0, max: 100 },
  expectedCloseDate: { type: Date, default: null },
  actualCloseDate: { type: Date, default: null },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lostReason: { type: String, default: '' },
  tags: [{ type: String, trim: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

crmDealSchema.index({ tenantId: 1, stage: 1 });
crmDealSchema.index({ tenantId: 1, assignedTo: 1 });

export default mongoose.model('CRMDeal', crmDealSchema);
