import mongoose from 'mongoose';

const crmContactSchema = new mongoose.Schema({
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
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social_media', 'email_campaign', 'whatsapp', 'phone', 'walk_in', 'other'],
    default: 'other'
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CRMLead'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

crmContactSchema.index({ tenantId: 1, name: 1 });
crmContactSchema.index({ tenantId: 1, email: 1 });
crmContactSchema.index({ tenantId: 1, phone: 1 });

const CRMContact = mongoose.model('CRMContact', crmContactSchema);
export default CRMContact;
