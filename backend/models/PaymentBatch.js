import mongoose from 'mongoose';

const paymentBatchLineSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceNumber: { type: String, default: '' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
  vendorName: { type: String, default: '' },
  iban: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'SAR' },
  reference: { type: String, default: '' },
}, { _id: true });

/**
 * Vendor payment batch for bank-file export (CSV / future SARIE bank formats).
 * Lifecycle: draft → exported → confirmed (matched to bank statement).
 */
const paymentBatchSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  number: { type: String, required: true },
  status: {
    type: String,
    enum: ['draft', 'exported', 'confirmed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  /** Export format key — 'csv' now; bank-specific later (alrajhi, snb, …) */
  format: {
    type: String,
    enum: ['csv', 'alrajhi', 'snb', 'riyad', 'alinma', 'sepa'],
    default: 'csv',
  },
  executionDate: { type: Date, default: Date.now },
  currency: { type: String, default: 'SAR' },
  totalAmount: { type: Number, default: 0 },
  lineCount: { type: Number, default: 0 },
  lines: { type: [paymentBatchLineSchema], default: [] },
  exportFilename: { type: String, default: '' },
  exportedAt: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

paymentBatchSchema.index({ tenantId: 1, number: 1 }, { unique: true });
paymentBatchSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
paymentBatchSchema.index({ tenantId: 1, 'lines.invoiceId': 1 });

export default mongoose.models.PaymentBatch
  || mongoose.model('PaymentBatch', paymentBatchSchema);
