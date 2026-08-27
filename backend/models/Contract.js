import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  titleAr: { type: String },
  description: { type: String },
  dueDate: { type: Date },
  completionDate: { type: Date },
  amount: { type: Number, required: true, min: 0 },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'billed', 'cancelled'],
    default: 'pending'
  },
  notes: { type: String }
}, { timestamps: true });

const changeOrderSchema = new mongoose.Schema({
  coNumber: { type: String },
  description: { type: String, required: true },
  amount: { type: Number, required: true }, // positive = addition, negative = deduction
  requestedDate: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: { type: String }
}, { timestamps: true });

const contractSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  contractNumber: { type: String, required: true },
  title: { type: String, required: true },
  titleAr: { type: String },
  description: { type: String },

  // Parties
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  customerName: { type: String },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

  // Financial
  contractValue: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'SAR' },
  retentionPercent: { type: Number, default: 10, min: 0, max: 100 },
  retentionAmount: { type: Number, default: 0 },
  retentionReleased: { type: Boolean, default: false },
  retentionReleasedAt: { type: Date },
  retentionReleasedAmount: { type: Number, default: 0 },

  // Dates
  startDate: { type: Date },
  endDate: { type: Date },
  signedDate: { type: Date },

  status: {
    type: String,
    enum: ['draft', 'active', 'on_hold', 'completed', 'terminated'],
    default: 'draft'
  },

  milestones: [milestoneSchema],
  changeOrders: [changeOrderSchema],

  // Computed fields (updated on pre-save hook)
  totalChangeOrderValue: { type: Number, default: 0 },
  revisedContractValue: { type: Number, default: 0 },
  totalBilled: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },

  notes: { type: String },
  attachments: [{ name: String, url: String }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Recompute derived financial values before every save
contractSchema.pre('save', function(next) {
  const approvedCOs = (this.changeOrders || []).filter(co => co.status === 'approved');
  this.totalChangeOrderValue = approvedCOs.reduce((sum, co) => sum + (co.amount || 0), 0);
  this.revisedContractValue = (this.contractValue || 0) + this.totalChangeOrderValue;
  this.retentionAmount = (this.revisedContractValue * (this.retentionPercent || 0)) / 100;
  const billedMilestones = (this.milestones || []).filter(m => m.status === 'billed');
  this.totalBilled = billedMilestones.reduce((sum, m) => sum + (m.amount || 0), 0);
  next();
});

contractSchema.index({ tenantId: 1, contractNumber: 1 }, { unique: true });
contractSchema.index({ tenantId: 1, status: 1 });
contractSchema.index({ tenantId: 1, customer: 1 });
contractSchema.index({ tenantId: 1, project: 1 });

const Contract = mongoose.model('Contract', contractSchema);
export default Contract;
