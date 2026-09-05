import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceNumber: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
}, { _id: true });

/**
 * Unified AR/AP payment document (C4).
 * Invoice "Register payment", payments page, and receipt vouchers should all create this.
 */
const accountPaymentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  number: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  /** inbound = customer receipt; outbound = vendor payment */
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true,
    index: true,
  },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null, index: true },
  partnerName: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  allocatedAmount: { type: Number, default: 0, min: 0 },
  unallocatedAmount: { type: Number, default: 0, min: 0 },
  method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'card', 'other', 'khata'],
    default: 'bank_transfer',
  },
  journalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal', default: null },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  reconciliationStatus: {
    type: String,
    enum: ['unreconciled', 'partial', 'reconciled'],
    default: 'unreconciled',
  },
  reference: { type: String, default: '' },
  memo: { type: String, default: '' },
  currency: { type: String, default: 'SAR' },
  status: {
    type: String,
    enum: ['draft', 'posted', 'cancelled'],
    default: 'posted',
    index: true,
  },
  allocations: { type: [allocationSchema], default: [] },
  attachments: [{
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    type: { type: String, default: '' },
  }],
  /** Where this payment originated */
  source: {
    type: String,
    enum: ['invoice', 'payments_page', 'voucher', 'backfill', 'batch', 'purchase_order', 'other'],
    default: 'other',
  },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

accountPaymentSchema.index({ tenantId: 1, number: 1 }, { unique: true });
accountPaymentSchema.index({ tenantId: 1, direction: 1, date: -1 });
accountPaymentSchema.index({ tenantId: 1, partnerId: 1, date: -1 });
accountPaymentSchema.index({ tenantId: 1, journalEntryId: 1 }, { sparse: true });
accountPaymentSchema.index({ tenantId: 1, 'allocations.invoiceId': 1 });

export default mongoose.models.AccountPayment
  || mongoose.model('AccountPayment', accountPaymentSchema);
