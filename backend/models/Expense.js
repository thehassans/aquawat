import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: { type: String },
  url: { type: String },
  mimeType: { type: String },
  size: { type: Number }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },

  expenseNumber: { type: String, required: true },
  expenseDate: { type: Date, required: true, index: true },

  category: { type: String, default: 'other' },
  categoryAr: { type: String },

  description: { type: String },
  descriptionAr: { type: String },

  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  /** Optional inventory product (canBeExpensed) — drives expense GL account */
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  payeeName: { type: String },

  currency: { type: String, default: 'SAR' },

  amount: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, default: 0, min: 0 },

  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'paid', 'cancelled'],
    default: 'draft',
    index: true
  },

  paymentMethod: { type: String, enum: ['bank_transfer', 'cash', 'cheque', 'card', 'other'], default: 'bank_transfer' },
  paymentDate: { type: Date },
  paymentReference: { type: String },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },

  attachments: { type: [attachmentSchema], default: [] },

  notes: { type: String },

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

expenseSchema.index({ tenantId: 1, expenseNumber: 1 }, { unique: true });
expenseSchema.index({ tenantId: 1, status: 1 });
expenseSchema.index({ tenantId: 1, expenseDate: -1 });
expenseSchema.index({ tenantId: 1, category: 1 });
expenseSchema.index({ tenantId: 1, projectId: 1, expenseDate: -1 });

expenseSchema.pre('save', function(next) {
  const amount = Number(this.amount) || 0;
  const taxAmount = Number(this.taxAmount) || 0;
  this.totalAmount = Math.round((amount + taxAmount) * 100) / 100;
  next();
});

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
