import mongoose from 'mongoose';

/**
 * BoutiqueRental Schema
 * Tracks a dress rental reservation through its full lifecycle.
 * State Machine:
 *   draft -> reserved -> picked_up (rented) -> returned -> inspected -> closed
 *   (with branches for late_return, damaged, and cancelled)
 */

const rentalLineItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoutiqueProduct', required: true },
  productName: { type: String, required: true },
  productNameAr: { type: String },
  sku: { type: String, required: true },
  size: { type: String },
  color: { type: String },
  quantity: { type: Number, default: 1 },

  // Pricing snapshot at booking time
  dailyRate: { type: Number, default: 0 },
  rentalDays: { type: Number, required: true },
  rentalSubtotal: { type: Number, required: true },   // days * dailyRate

  // Extras
  depositAmount: { type: Number, default: 0 },        // security deposit per line
  lateFee: { type: Number, default: 0 },
  damageFee: { type: Number, default: 0 },
  cleaningFee: { type: Number, default: 0 },

  lineTotal: { type: Number, required: true },      // rentalSubtotal + fees
}, { _id: false });

const paymentSnapshotSchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'transfer', 'tabby', 'tamara'], default: 'cash' },
  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  reference: { type: String },                        // transaction reference
}, { _id: false });

const inspectionResultSchema = new mongoose.Schema({
  inspectedAt: { type: Date, default: Date.now },
  inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  condition: { type: String, enum: ['excellent', 'good', 'minor_damage', 'major_damage', 'lost'], default: 'good' },
  notes: { type: String },
  photos: [{ type: String }],                         // damage photo URLs
  cleaningRequired: { type: Boolean, default: false },
  repairRequired: { type: Boolean, default: false },
  damageFeeApplied: { type: Number, default: 0 },
}, { _id: false });

const boutiqueRentalSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  // Human-readable rental number
  rentalNumber: { type: String, required: true, index: true },

  // --- Customer ---
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  customerName: { type: String, required: true },
  customerNameAr: { type: String },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  customerIdType: { type: String, enum: ['iqama', 'id', 'vat'], default: 'iqama' },
  customerIdNumber: { type: String },                 // Saudi ID / Iqama for contract

  // --- Transaction type ---
  transactionType: { type: String, enum: ['rental', 'sale'], default: 'rental', index: true },

  // --- Rental dates ---
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  // Actual timestamps for audit
  pickedUpAt: { type: Date },
  returnedAt: { type: Date },

  // --- Items ---
  lineItems: { type: [rentalLineItemSchema], required: true },

  // --- Totals ---
  rentalSubtotal: { type: Number, required: true, default: 0 },   // Sum of line rentalSubtotals
  totalDeposit: { type: Number, default: 0 },                   // Sum of line depositAmounts
  discount: { type: Number, default: 0 },                        // Applied discount
  totalLateFee: { type: Number, default: 0 },
  totalDamageFee: { type: Number, default: 0 },
  totalCleaningFee: { type: Number, default: 0 },
  vatApplicable: { type: Boolean, default: true },               // Whether 15% VAT was applied
  totalTax: { type: Number, default: 0 },                        // VAT 15%
  grandTotal: { type: Number, required: true, default: 0 },       // rentalSubtotal + fees + tax

  // --- Payments ---
  paymentMethod: { type: String, enum: ['cash', 'card', 'online'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'paid' },
  payments: { type: [paymentSnapshotSchema], default: [] },
  amountPaid: { type: Number, default: 0 },
  amountRefunded: { type: Number, default: 0 },               // Deposit refunds (full or partial)

  // --- Invoice linkage ---
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  invoiceNumber: { type: String },

  // --- State machine ---
  status: {
    type: String,
    enum: [
      'draft',
      'reserved',
      'picked_up',           // dress has left the store
      'late_return',         // past endDate, not yet returned
      'returned',            // dress physically back, pending inspection
      'inspected',
      'closed',              // inspection done, deposit settled
      'cancelled',
      'disputed'
    ],
    default: 'draft',
    index: true
  },

  // --- Inspection ---
  inspection: { type: inspectionResultSchema },

  // --- Deposit settlement ---
  depositStatus: {
    type: String,
    enum: ['pending', 'held', 'partially_refunded', 'fully_refunded', 'forfeited'],
    default: 'pending'
  },

  // --- Reminders sent ---
  reminder24hSent: { type: Boolean, default: false },
  reminderOverdueSent: { type: Boolean, default: false },

  // --- Notes & audit ---
  staffNotes: { type: String },
  contractSignedUrl: { type: String },                // Digital signature / contract scan
  updateHistory: [{
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromStatus: { type: String },
    toStatus: { type: String },
    note: { type: String }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

// Critical indexes for availability queries and lookups
boutiqueRentalSchema.index({ tenantId: 1, status: 1, startDate: 1, endDate: 1 });
boutiqueRentalSchema.index({ tenantId: 1, customerPhone: 1, createdAt: -1 });
boutiqueRentalSchema.index({ tenantId: 1, rentalNumber: 1 }, { unique: true });
boutiqueRentalSchema.index({ tenantId: 1, 'lineItems.productId': 1, status: 1 });

const BoutiqueRental = mongoose.model('BoutiqueRental', boutiqueRentalSchema);
export default BoutiqueRental;
