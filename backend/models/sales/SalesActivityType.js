import mongoose from 'mongoose';

const salesActivityTypeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  icon: { type: String, default: 'phone', trim: true },
  /** call | email | meeting | task | custom */
  kind: { type: String, enum: ['call', 'email', 'meeting', 'task', 'custom'], default: 'call' },
  defaultDurationMinutes: { type: Number, default: 30, min: 5, max: 480 },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

salesActivityTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.model('SalesActivityType', salesActivityTypeSchema);
