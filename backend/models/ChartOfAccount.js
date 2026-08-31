import mongoose from 'mongoose';

const chartOfAccountSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, trim: true, default: '' },
  type: {
    type: String,
    enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    required: true,
    index: true,
  },
  subtype: {
    type: String,
    enum: [
      'cash', 'bank', 'receivable', 'inventory', 'fixed_asset', 'accum_depreciation', 'other_asset',
      'payable', 'tax', 'other_liability',
      'capital', 'retained_earnings', 'other_equity',
      'sales', 'other_income',
      'cogs', 'operating', 'payroll', 'other_expense',
    ],
    default: 'other_asset',
  },
  parentCode: { type: String, default: '' },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isPostable: { type: Boolean, default: true },
  currency: { type: String, default: 'SAR' },
  description: { type: String, default: '' },
  /** Metadata tags for cash-flow / report classification (see accountTags tenant vocab). */
  tags: [{ type: String, trim: true }],
  balance: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

chartOfAccountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
chartOfAccountSchema.index({ tenantId: 1, type: 1, isActive: 1 });

const ChartOfAccount = mongoose.model('ChartOfAccount', chartOfAccountSchema);
export default ChartOfAccount;
