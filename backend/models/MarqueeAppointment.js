import mongoose from 'mongoose';

const marqueeAppointmentSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  bookingNumber: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  titleAr: {
    type: String,
    trim: true,
  },
  eventType: {
    type: String,
    enum: ['wedding', 'reception', 'valima', 'mehndi', 'corporate', 'birthday', 'engagement', 'exhibition', 'qawwali_dinner', 'other'],
    default: 'wedding',
  },
  eventDate: {
    type: Date,
    required: true,
    index: true,
  },
  eventShift: {
    type: String,
    enum: ['lunch', 'dinner', 'morning', 'afternoon', 'night', 'full_day'],
    default: 'dinner',
  },
  eventStartTime: {
    type: String,
    default: '19:00',
  },
  eventEndTime: {
    type: String,
    default: '23:30',
  },
  hallName: {
    type: String,
    default: 'Grand Ballroom',
    trim: true,
  },
  guestCount: {
    type: Number,
    required: true,
    min: 1,
    default: 100,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
  },
  clientName: {
    type: String,
    required: true,
    trim: true,
  },
  clientPhone: {
    type: String,
    required: true,
    trim: true,
  },
  clientEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarqueePackage',
  },
  packageName: {
    type: String,
    trim: true,
  },
  ratePerHead: {
    type: Number,
    default: 0,
  },
  hallBaseRent: {
    type: Number,
    default: 0,
  },
  selectedItems: [{
    itemName: String,
    itemNameAr: String,
    category: String,
    quantityPerHead: Number,
    portionSize: String,
  }],
  subtotal: {
    type: Number,
    default: 0,
  },
  taxRate: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  advancePaid: {
    type: Number,
    default: 0,
  },
  remainingAmount: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'SAR',
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
  },
  quotationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
  },
  status: {
    type: String,
    enum: ['inquiry', 'tentative', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'confirmed',
    index: true,
  },
  stageTheme: { type: String, trim: true },
  colorTheme: { type: String, trim: true },
  specialRequests: { type: String, trim: true },
  notes: { type: String, trim: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

marqueeAppointmentSchema.index({ tenantId: 1, eventDate: 1, eventShift: 1, hallName: 1 });
marqueeAppointmentSchema.index({ tenantId: 1, bookingNumber: 1 }, { unique: true });
marqueeAppointmentSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('MarqueeAppointment', marqueeAppointmentSchema);
