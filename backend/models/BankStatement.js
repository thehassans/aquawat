import mongoose from 'mongoose';

/**
 * Bank statement header for a cash/bank CoA account.
 */
const bankStatementSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
  name: { type: String, required: true, trim: true },
  statementDate: { type: Date, required: true },
  periodFrom: { type: Date, default: null },
  periodTo: { type: Date, default: null },
  currency: { type: String, default: 'SAR' },
  openingBalance: { type: Number, default: 0 },
  closingBalance: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'open', 'reconciled'],
    default: 'open',
    index: true,
  },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

bankStatementSchema.index({ tenantId: 1, accountId: 1, statementDate: -1 });

export default mongoose.models.BankStatement || mongoose.model('BankStatement', bankStatementSchema);
