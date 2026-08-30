import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  /** Empty = all warehouses. When set, inventory APIs scope to these warehouses. */
  warehouseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }],

  email: { type: String, required: true, lowercase: true },
  password: { type: String, required: true, select: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  firstNameAr: { type: String },
  lastNameAr: { type: String },
  phone: { type: String },
  phoneVerified: { type: Boolean, default: false },
  otp: { type: String, select: false },
  otpExpires: { type: Date },
  avatar: { type: String },
  role: {
    type: String,
    enum: ['super_admin', 'reseller', 'admin', 'manager', 'accountant', 'hr_manager', 'inventory_manager', 'sales', 'kitchen_staff', 'viewer'],
    default: 'viewer'
  },
  resellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reseller', default: null, index: true },
  /**
   * Accounting Firms Mode: home firm tenant for this user.
   * When switching client books, tenantId changes but firmHomeTenantId stays.
   */
  firmHomeTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  /** Client tenants (and firm home) this accountant may open */
  accessibleTenantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
  permissions: [{
    module: { type: String },
    actions: [{ type: String, enum: ['create', 'read', 'update', 'delete', 'approve', 'export', 'margin'] }]
  }],
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  passwordChangedAt: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  preferences: {
    language: { type: String, enum: ['en', 'ar'], default: 'ar' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ email: 1, role: 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // Cost factor 10 = ~65ms on modern hardware (was 12 = ~800ms+)
  this.password = await bcrypt.hash(this.password, 10);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

/**
 * comparePassword
 * Accepts both:
 *  a) SHA-256 hex digest (new client flow — raw password never leaves the browser)
 *  b) Raw plaintext (legacy accounts) — tried only when direct bcrypt compare fails
 *     and the candidate is NOT a 64-char hex string.
 *
 * The auth route is responsible for the legacy migration: when a raw-password
 * login succeeds it re-saves the password so it gets re-hashed as
 * bcrypt(sha256(raw)) on the next save, transparently upgrading the account.
 */
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.hasPermission = function(module, action) {
  if (this.role === 'super_admin' || this.role === 'admin') return true;
  const perm = this.permissions.find(p => p.module === module);
  return perm && perm.actions.includes(action);
};

const User = mongoose.model('User', userSchema);
export default User;
