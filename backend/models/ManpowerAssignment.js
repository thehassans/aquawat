import mongoose from 'mongoose';

const assignedWorkerSchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManpowerWorker', required: true },
  workerName: { type: String },
  workerTrade: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  dailyRate: { type: Number, required: true },
  hourlyRate: { type: Number, default: 0 },
  hoursPerDay: { type: Number, default: 8 },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' }
}, { _id: false });

const manpowerAssignmentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  assignmentNumber: { type: String, required: true },
  
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  clientName: { type: String },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  
  site: { type: String },
  
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  
  workers: [assignedWorkerSchema],
  
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  totalBilled: { type: Number, default: 0 },
  invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],
  
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

manpowerAssignmentSchema.index({ tenantId: 1, assignmentNumber: 1 }, { unique: true });
manpowerAssignmentSchema.index({ tenantId: 1, clientId: 1 });
manpowerAssignmentSchema.index({ tenantId: 1, status: 1 });
manpowerAssignmentSchema.index({ tenantId: 1, startDate: -1 });

const ManpowerAssignment = mongoose.model('ManpowerAssignment', manpowerAssignmentSchema);
export default ManpowerAssignment;
