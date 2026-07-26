import mongoose from 'mongoose';

const crmCampaignSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['email', 'whatsapp'],
    default: 'email'
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'running', 'completed', 'failed'],
    default: 'draft'
  },
  audience: {
    type: String,
    enum: ['all_leads', 'all_contacts', 'specific_status', 'custom_list'],
    default: 'all_leads'
  },
  targetStatus: {
    type: String // e.g. 'new', 'contacted' if audience is 'specific_status'
  },
  subject: {
    type: String, // only for email
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  scheduledAt: {
    type: Date
  },
  stats: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

crmCampaignSchema.index({ tenantId: 1, status: 1 });
crmCampaignSchema.index({ tenantId: 1, scheduledAt: 1 });

const CRMCampaign = mongoose.model('CRMCampaign', crmCampaignSchema);
export default CRMCampaign;
