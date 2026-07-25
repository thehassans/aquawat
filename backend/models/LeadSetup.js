import mongoose from 'mongoose';

const leadSetupSchema = new mongoose.Schema({
  businessType: { 
    type: String, 
    required: true,
  },
  message: { 
    type: String, 
    required: true 
  },
  bannerImage: { 
    type: String 
  },
  resellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null
  }
}, { timestamps: true });

leadSetupSchema.index({ businessType: 1, resellerId: 1, tenantId: 1 }, { unique: true });

const LeadSetup = mongoose.model('LeadSetup', leadSetupSchema);

export default LeadSetup;
