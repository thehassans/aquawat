import mongoose from 'mongoose';

/**
 * Accounting journal book (series), not a posted entry.
 * Categories point stockJournalId here; JournalEntry rows may reference journalId.
 */
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, default: '', trim: true },
  type: {
    type: String,
    enum: ['stock', 'sales', 'purchase', 'cash', 'bank', 'miscellaneous'],
    default: 'miscellaneous',
    index: true,
  },
  /** Prefix for JournalEntry.entryNumber (defaults to code). */
  sequencePrefix: { type: String, default: '', trim: true, uppercase: true },
  /** Suggested opposite accounts when creating entries in this book (UX defaults). */
  defaultDebitAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  defaultCreditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  active: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ tenantId: 1, code: 1 }, { unique: true });
schema.index({ tenantId: 1, type: 1, active: 1 });

export default mongoose.models.Journal || mongoose.model('Journal', schema);
