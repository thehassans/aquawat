import mongoose from 'mongoose';

/**
 * Analytic / cost-center dimension for journal lines (Phase 6).
 * Distinct from ChartOfAccount — used for reporting by project/department.
 */
const analyticAccountSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, default: '', trim: true },
  type: {
    type: String,
    enum: ['general', 'department', 'project', 'cost_center'],
    default: 'general',
    index: true,
  },
  active: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

analyticAccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
analyticAccountSchema.index({ tenantId: 1, type: 1, active: 1 });

export default mongoose.models.AnalyticAccount
  || mongoose.model('AnalyticAccount', analyticAccountSchema);
