import mongoose from 'mongoose';

const leadSetupSchema = new mongoose.Schema({
  businessType: { 
    type: String, 
    required: true,
    unique: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  bannerImage: { 
    type: String 
  }
}, { timestamps: true });

const LeadSetup = mongoose.model('LeadSetup', leadSetupSchema);

export default LeadSetup;
