import mongoose from 'mongoose';

const manpowerWorkerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Optional link to core HR
  
  workerNumber: { type: String, required: true },
  name: { type: String, required: true },
  nameAr: { type: String },
  nationality: { type: String },
  
  // IDs
  iqamaNumber: { type: String },
  iqamaExpiry: { type: Date },
  passportNumber: { type: String },
  passportExpiry: { type: Date },
  
  // Job Details
  trade: { 
    type: String, 
    enum: ['carpenter', 'plumber', 'mason', 'electrician', 'welder', 'helper', 'driver', 'operator', 'other'],
    required: true
  },
  
  // Rates
  dailyRate: { type: Number, default: 0 },
  hourlyRate: { type: Number, default: 0 },
  monthlyRate: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['available', 'assigned', 'on_leave', 'terminated'],
    default: 'available'
  },
  
  currentAssignment: { type: mongoose.Schema.Types.ObjectId, ref: 'ManpowerAssignment' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' }, // If assigned to a client
  
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

manpowerWorkerSchema.index({ tenantId: 1, workerNumber: 1 }, { unique: true });
manpowerWorkerSchema.index({ tenantId: 1, status: 1 });
manpowerWorkerSchema.index({ tenantId: 1, currentAssignment: 1 });
manpowerWorkerSchema.index({ tenantId: 1, trade: 1 });

const ManpowerWorker = mongoose.model('ManpowerWorker', manpowerWorkerSchema);
export default ManpowerWorker;
