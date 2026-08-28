import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const portalUserSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  name: { type: String, trim: true, default: '' },
  /** invitation | free_signup | admin_created */
  accessSource: { type: String, enum: ['invitation', 'free_signup', 'admin_created'], default: 'invitation' },
  inviteToken: { type: String, default: null, index: true },
  inviteExpiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

portalUserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

portalUserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

portalUserSchema.methods.matchPassword = function matchPassword(entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('PortalUser', portalUserSchema);
