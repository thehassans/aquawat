import mongoose from 'mongoose';

/**
 * Tax master — links a rate to a GL account (VAT output / input).
 * Journal lines that post tax stamp taxIds with these ObjectIds.
 */
const taxSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, default: '', trim: true },
  /** Percentage, e.g. 15 for 15% */
  rate: { type: Number, required: true, min: 0, max: 100 },
  type: {
    type: String,
    enum: ['sales', 'purchase'],
    required: true,
    index: true,
  },
  /** GL account for tax payable (sales) or recoverable (purchase) */
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
  active: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

taxSchema.index({ tenantId: 1, code: 1 }, { unique: true });
taxSchema.index({ tenantId: 1, type: 1, active: 1 });

export default mongoose.models.Tax || mongoose.model('Tax', taxSchema);
