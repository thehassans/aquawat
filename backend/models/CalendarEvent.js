import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      enum: ['meeting', 'task', 'note', 'reminder', 'call', 'event', 'invoice_due'],
      default: 'meeting',
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String, // e.g. "09:30"
      default: '',
    },
    endTime: {
      type: String, // e.g. "10:30"
      default: '',
    },
    color: {
      type: String,
      default: '#3B82F6', // Hex or tailwind identifier
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    meetingLink: {
      type: String,
      default: '',
      trim: true,
    },
    attendees: [
      {
        name: { type: String, trim: true },
        email: { type: String, trim: true },
        phone: { type: String, trim: true },
        contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMContact' },
      },
    ],
    relatedContact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMContact',
    },
    relatedCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    notes: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    remindBeforeMinutes: {
      type: Number,
      default: 15,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient date-range queries per tenant
calendarEventSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });
calendarEventSchema.index({ tenantId: 1, type: 1 });
calendarEventSchema.index({ tenantId: 1, isCompleted: 1 });

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);
export default CalendarEvent;
