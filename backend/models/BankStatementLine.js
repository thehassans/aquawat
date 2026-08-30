import mongoose from 'mongoose';

/**
 * Individual bank statement line. When matched, shares reconcileId with JournalItem(s).
 * amount: positive = money in (credit on bank statement / debit in GL cash nature),
 *         negative = money out.
 */
const bankStatementLineSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  statementId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankStatement', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
  date: { type: Date, required: true, index: true },
  label: { type: String, default: '', trim: true },
  reference: { type: String, default: '', trim: true },
  amount: { type: Number, required: true },
  /** Shared match key with JournalItem.reconcileId */
  reconcileId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  matchedAt: { type: Date, default: null },
  matchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lineIndex: { type: Number, default: 0 },
}, { timestamps: true });

bankStatementLineSchema.index({ tenantId: 1, statementId: 1, lineIndex: 1 });
bankStatementLineSchema.index({ tenantId: 1, accountId: 1, reconcileId: 1, date: -1 });

export default mongoose.models.BankStatementLine
  || mongoose.model('BankStatementLine', bankStatementLineSchema);
