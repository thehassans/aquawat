import mongoose from 'mongoose';

const userActivityLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userEmail: {
    type: String,
    lowercase: true,
  },
  userRole: {
    type: String,
    default: 'user',
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'create',
      'update',
      'delete',
      'sign',
      'approve',
      'reject',
      'convert',
      'export',
      'download',
      'send_email',
      'send_whatsapp',
      'send_sms',
      'payment',
      'status_change',
      'settings_change',
    ],
  },
  module: {
    type: String,
    required: true,
  },
  resourceType: {
    type: String,
  },
  resourceId: {
    type: String,
  },
  resourceName: {
    type: String,
  },
  description: {
    type: String,
    required: true,
  },
  descriptionAr: {
    type: String,
  },
  status: {
    type: String,
    enum: ['success', 'warning', 'failed'],
    default: 'success',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

userActivityLogSchema.index({ tenantId: 1, createdAt: -1 });
userActivityLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
userActivityLogSchema.index({ tenantId: 1, module: 1, createdAt: -1 });
userActivityLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });

export default mongoose.model('UserActivityLog', userActivityLogSchema);
