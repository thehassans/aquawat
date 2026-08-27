import mongoose from 'mongoose';

const timesheetEntrySchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManpowerWorker', required: true },
  workerName: { type: String, required: true },
  trade: { type: String },

  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManpowerAssignment' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  projectName: { type: String },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
  clientName: { type: String },

  date: { type: Date, required: true },

  regularHours: { type: Number, default: 0, min: 0 },
  overtimeHours: { type: Number, default: 0, min: 0 },
  totalHours: { type: Number, default: 0 },

  isBillable: { type: Boolean, default: true },

  // Cost tracking
  hourlyRate: { type: Number, default: 0 },
  overtimeRate: { type: Number, default: 0 },
  regularCost: { type: Number, default: 0 },
  overtimeCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },

  // Attendance
  checkInTime: { type: String }, // "07:00"
  checkOutTime: { type: String }, // "16:00"
  attendanceStatus: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'leave', 'holiday'],
    default: 'present',
  },

  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

timesheetEntrySchema.index({ tenantId: 1, date: -1 });
timesheetEntrySchema.index({ tenantId: 1, workerId: 1, date: -1 });
timesheetEntrySchema.index({ tenantId: 1, projectId: 1, date: -1 });
timesheetEntrySchema.index({ tenantId: 1, assignmentId: 1 });

timesheetEntrySchema.pre('save', function(next) {
  this.totalHours = (this.regularHours || 0) + (this.overtimeHours || 0);
  this.regularCost = Math.round((this.regularHours || 0) * (this.hourlyRate || 0) * 100) / 100;
  this.overtimeCost = Math.round((this.overtimeHours || 0) * (this.overtimeRate || (this.hourlyRate || 0) * 1.5) * 100) / 100;
  this.totalCost = this.regularCost + this.overtimeCost;
  next();
});

export default mongoose.models.ManpowerTimesheet || mongoose.model('ManpowerTimesheet', timesheetEntrySchema);
