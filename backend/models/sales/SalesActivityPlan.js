import mongoose from 'mongoose';

const planStepSchema = new mongoose.Schema({
  activityTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesActivityType', required: true },
  delayDays: { type: Number, default: 0, min: 0 },
  summary: { type: String, default: '' },
  summaryAr: { type: String, default: '' },
}, { _id: true });

const salesActivityPlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  /** quotation | sales_order | partner */
  appliesTo: { type: String, enum: ['quotation', 'sales_order', 'partner'], default: 'quotation' },
  steps: { type: [planStepSchema], default: [] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

salesActivityPlanSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.model('SalesActivityPlan', salesActivityPlanSchema);
