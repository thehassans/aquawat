import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  
  type: { 
    type: String, 
    enum: ['invoice', 'payment', 'credit_note', 'debit_note'], 
    required: true 
  },
  
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // Refers to Invoice/Payment etc.
  
  amount: { type: Number, required: true }, // Positive for invoices/debits, Negative for payments/credits
  balanceAfter: { type: Number, required: true },
  
  date: { type: Date, default: Date.now },
  description: { type: String },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

transactionSchema.index({ tenantId: 1, customerId: 1, date: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
