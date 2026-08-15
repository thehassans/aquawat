import mongoose from 'mongoose';

const khayyatMeasurementSchema = new mongoose.Schema({
  length: { type: Number, default: null },
  shoulderWidth: { type: Number, default: null },
  chest: { type: Number, default: null },
  waist: { type: Number, default: null },
  hips: { type: Number, default: null },
  sleeveLength: { type: Number, default: null },
  bicep: { type: Number, default: null },
  forearm: { type: Number, default: null },
  neck: { type: Number, default: null },
  wrist: { type: Number, default: null },
  cuffWidth: { type: Number, default: null },
  expansion: { type: Number, default: null },
  armhole: { type: Number, default: null },
  bottom: { type: Number, default: null }
}, { _id: false });

const customerSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['individual', 'business'],
    default: 'business'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameAr: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  customerCode: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  mobile: {
    type: String,
    trim: true
  },
  vatNumber: {
    type: String,
    trim: true
  },
  crNumber: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    streetAr: String,
    city: String,
    cityAr: String,
    district: String,
    districtAr: String,
    postalCode: String,
    country: { type: String, default: 'SA' },
    buildingNumber: String,
    additionalNumber: String
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
    position: String
  },
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net15', 'net30', 'net45', 'net60', 'net90'],
    default: 'net30'
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  },
  tags: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  totalInvoices: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  lastInvoiceDate: {
    type: Date
  },
  khayyatMeasurements: {
    type: khayyatMeasurementSchema,
    default: () => ({})
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  khayyatRelations: {
    type: [
      {
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
        customerName: { type: String, default: '' },
        customerPhone: { type: String, default: '' },
        relationType: { type: String, default: '' }
      }
    ],
    default: () => []
  },
  khayyatReceiptNumbers: {
    type: String,
    default: '',
    trim: true
  },
  khayyatHijriDate: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
customerSchema.index({ tenantId: 1, name: 1 });
customerSchema.index({ tenantId: 1, email: 1 });
customerSchema.index({ tenantId: 1, vatNumber: 1 });
customerSchema.index({ tenantId: 1, isActive: 1 });
customerSchema.index({ tenantId: 1, khayyatReceiptNumbers: 1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
