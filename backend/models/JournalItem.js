import mongoose from 'mongoose';

/**
 * First-class journal item (account.move.line).
 * Dual-written from JournalEntry.lines on post; queryable for partner ledger,
 * reconciliation, tax, and analytic reporting.
 */
const journalItemSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  moveId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', required: true, index: true },
  journalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal', default: null, index: true },
  entryNumber: { type: String, default: '', index: true },
  entryDate: { type: Date, required: true, index: true },
  postingDate: { type: Date, default: null, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true, index: true },
  accountCode: { type: String, default: '' },
  accountName: { type: String, default: '' },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null, index: true },
  /** Placeholder for Phase 4 tax engine */
  taxIds: [{ type: mongoose.Schema.Types.ObjectId }],
  /** Analytic / cost center (Phase 6) */
  analyticAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnalyticAccount', default: null, index: true },
  /** Future bank reconciliation match */
  reconcileId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  description: { type: String, default: '' },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'SAR' },
  /** draft | posted | cancelled (when parent move voided/reversed) */
  state: {
    type: String,
    enum: ['draft', 'posted', 'cancelled'],
    default: 'draft',
    index: true,
  },
  sourceModel: { type: String, default: '' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
  lineIndex: { type: Number, default: 0 },
}, { timestamps: true });

journalItemSchema.index({ tenantId: 1, moveId: 1, lineIndex: 1 });
journalItemSchema.index({ tenantId: 1, accountId: 1, entryDate: -1 });
journalItemSchema.index({ tenantId: 1, partnerId: 1, entryDate: -1 });
journalItemSchema.index({ tenantId: 1, state: 1, entryDate: -1 });

const JournalItem = mongoose.models.JournalItem
  || mongoose.model('JournalItem', journalItemSchema);

export default JournalItem;
