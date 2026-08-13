import mongoose from 'mongoose';

const govIntegrationLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  service: {
    type: String,
    enum: ['zatca', 'elm', 'qiwa', 'gosi', 'mudad', 'balady', 'saber', 'etimad', 'nbr', 'fbr'],
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    trim: true,
  },
  reference: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending', 'info'],
    default: 'info',
  },
  message: {
    type: String,
    default: '',
    trim: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

govIntegrationLogSchema.index({ tenantId: 1, service: 1, timestamp: -1 });

export default mongoose.model('GovIntegrationLog', govIntegrationLogSchema);
