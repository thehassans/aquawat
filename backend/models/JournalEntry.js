import mongoose from 'mongoose';

const journalLineSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
  accountCode: { type: String, required: true },
  accountName: { type: String, default: '' },
  description: { type: String, default: '' },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
  taxIds: [{ type: mongoose.Schema.Types.ObjectId }],
  analyticAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalyticAccount', default: null },
  /** Open-item due date for AR/AP tranches (payment terms). */
  dueDate: { type: Date, default: null },
  trancheSequence: { type: Number, default: null },
}, { _id: true });

const journalEntrySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  entryNumber: { type: String, required: true },
  entryDate: { type: Date, required: true, index: true },
  postingDate: { type: Date },
  type: {
    type: String,
    enum: ['manual', 'invoice', 'payment', 'expense', 'voucher', 'adjustment', 'opening', 'closing', 'stock', 'reversal'],
    default: 'manual',
    index: true,
  },
  status: {
    type: String,
    /** void = draft cancelled; reversed = posted entry closed by a formal reversal move */
    enum: ['draft', 'posted', 'void', 'reversed'],
    default: 'draft',
    index: true,
  },
  memo: { type: String, default: '' },
  memoAr: { type: String, default: '' },
  reference: { type: String, default: '' },
  currency: { type: String, default: 'SAR' },
  lines: { type: [journalLineSchema], default: [] },
  totalDebit: { type: Number, default: 0 },
  totalCredit: { type: Number, default: 0 },
  sourceModel: { type: String, default: '' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
  sourceNumber: { type: String, default: '' },
  /** Optional journal book (series) this entry belongs to */
  journalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal', default: null, index: true },
  /** This move reverses that posted move */
  reversalOfId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null, index: true },
  /** Posted move that reversed this one */
  reversedById: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voidedAt: { type: Date },
  voidReason: { type: String, default: '' },
}, { timestamps: true });

journalEntrySchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
journalEntrySchema.index({ tenantId: 1, entryDate: -1 });
journalEntrySchema.index({ tenantId: 1, status: 1, entryDate: -1 });
journalEntrySchema.index({ tenantId: 1, sourceModel: 1, sourceId: 1 });

journalEntrySchema.pre('validate', function(next) {
  const lines = Array.isArray(this.lines) ? this.lines : [];
  this.totalDebit = Number(lines.reduce((s, l) => s + Number(l.debit || 0), 0).toFixed(2));
  this.totalCredit = Number(lines.reduce((s, l) => s + Number(l.credit || 0), 0).toFixed(2));
  next();
});

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);
export default JournalEntry;
