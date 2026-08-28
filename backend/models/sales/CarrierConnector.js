import mongoose from 'mongoose';

const carrierConnectorSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  provider: {
    type: String,
    enum: ['ups', 'dhl', 'fedex', 'usps', 'bpost', 'easypost', 'sendcloud', 'internal'],
    required: true,
  },
  isActive: { type: Boolean, default: false },
  isTestMode: { type: Boolean, default: true },
  credentials: { type: mongoose.Schema.Types.Mixed, default: {} },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

carrierConnectorSchema.index({ tenantId: 1, provider: 1 }, { unique: true });

export default mongoose.model('CarrierConnector', carrierConnectorSchema);
