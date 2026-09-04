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
  bottom: { type: Number, default: null },
}, { _id: false });

/**
 * Unified trading partner (customer and/or vendor).
 * Document FKs keep field names customerId / supplierId / partnerId / partyId
 * but all reference this collection.
 */
const partnerSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },

  type: {
    type: String,
    enum: ['individual', 'business'],
    default: 'business',
  },

  /** Canonical display name (from Customer.name or Supplier.nameEn) */
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameAr: { type: String, trim: true },
  /** Alias for supplier UI / APIs that expect nameEn */
  nameEn: { type: String, trim: true },

  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  mobile: { type: String, trim: true },
  website: { type: String, trim: true },

  customerCode: { type: String, trim: true },
  supplierCode: { type: String, trim: true },

  vatNumber: {
    type: String,
    trim: true,
    validate: {
      validator(v) {
        if (v == null || String(v).trim() === '') return true;
        return /^3\d{13}3$/.test(String(v).trim());
      },
      message: 'VAT number must be exactly 15 digits starting and ending with 3',
    },
  },
  crNumber: { type: String, trim: true },

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
    additionalNumber: String,
    /** SPL Saudi short national address code (e.g. RRRD2929) */
    shortAddress: String,
  },

  contactPerson: {
    name: String,
    email: String,
    phone: String,
    position: String,
  },

  /** Customer-side payment terms (legacy Customer.paymentTerms) */
  paymentTermsCustomer: {
    type: String,
    enum: ['immediate', 'net15', 'net30', 'net45', 'net60', 'net90'],
    default: 'net30',
  },
  /** Vendor-side payment terms (legacy Supplier.paymentTerms) */
  paymentTermsVendor: {
    term: {
      type: String,
      enum: ['immediate', 'net_7', 'net_15', 'net_30', 'net_60'],
      default: 'net_30',
    },
    customDays: { type: Number },
  },

  creditLimit: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },

  bank: {
    iban: { type: String },
    bankName: { type: String },
    beneficiaryName: { type: String },
  },

  notes: { type: String },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },

  isCustomer: { type: Boolean, default: true },
  isVendor: { type: Boolean, default: false },
  isEmployee: { type: Boolean, default: false },

  logoUrl: { type: String, default: '' },

  salespersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  vendorCurrency: { type: String, default: 'SAR', trim: true },
  salesPricelistId: { type: String, default: null, trim: true },

  bankAccounts: [{
    bankName: { type: String, trim: true },
    accountName: { type: String, trim: true },
    iban: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  }],

  parentCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null,
  },

  receivableAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    default: null,
  },
  payableAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    default: null,
  },

  totalInvoices: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  lastInvoiceDate: { type: Date },

  khayyatMeasurements: {
    type: khayyatMeasurementSchema,
    default: () => ({}),
  },
  loyaltyPoints: { type: Number, default: 0 },
  khayyatRelations: {
    type: [
      {
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
        customerName: { type: String, default: '' },
        customerPhone: { type: String, default: '' },
        relationType: { type: String, default: '' },
      },
    ],
    default: () => [],
  },
  khayyatReceiptNumbers: { type: String, default: '', trim: true },
  khayyatHijriDate: { type: String, default: '', trim: true },

  stockWarn: { type: String, enum: ['no', 'warning', 'block'], default: 'no' },
  stockWarnMsg: { type: String, default: '' },

  isAddition: { type: Boolean, default: false },
  additionSource: { type: String, default: 'direct' },
  additionDate: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  /** Soft-archive after customer merge (kept for audit; not hard-deleted) */
  mergedIntoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null,
    index: true,
  },
  mergedAt: { type: Date, default: null },
  mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  mergeNote: { type: String, default: '' },

  /** Migration provenance — droppable after legacy collections are retired */
  legacyCustomerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  legacySupplierId: { type: mongoose.Schema.Types.ObjectId, default: null },
  mergedFromSupplierIds: [{ type: mongoose.Schema.Types.ObjectId }],
  /** Partner ids that were merged into this primary customer */
  mergedFromCustomerIds: [{ type: mongoose.Schema.Types.ObjectId }],
}, {
  timestamps: true,
  collection: 'partners',
});

partnerSchema.index({ tenantId: 1, name: 1 });
partnerSchema.index({ tenantId: 1, nameEn: 1 });
partnerSchema.index({ tenantId: 1, email: 1 });
partnerSchema.index({ tenantId: 1, vatNumber: 1 });
partnerSchema.index({ tenantId: 1, isActive: 1 });
partnerSchema.index({ tenantId: 1, isCustomer: 1 });
partnerSchema.index({ tenantId: 1, isVendor: 1 });
partnerSchema.index({ tenantId: 1, isEmployee: 1 });
partnerSchema.index({ tenantId: 1, isAddition: 1 });
partnerSchema.index({ tenantId: 1, khayyatReceiptNumbers: 1 });
partnerSchema.index(
  { tenantId: 1, customerCode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { customerCode: { $type: 'string' } } }
);
partnerSchema.index(
  { tenantId: 1, supplierCode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { supplierCode: { $type: 'string' } } }
);

/** Legacy supplier API / populate select('code') */
partnerSchema.virtual('code').get(function getCode() {
  return this.supplierCode;
});

partnerSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    if (ret.supplierCode && !ret.code) ret.code = ret.supplierCode;
    if (!ret.nameEn && ret.name) ret.nameEn = ret.name;
    if (ret.paymentTermsCustomer && !ret.paymentTerms) ret.paymentTerms = ret.paymentTermsCustomer;
    return ret;
  },
});
partnerSchema.set('toObject', {
  virtuals: true,
  transform(_doc, ret) {
    if (ret.supplierCode && !ret.code) ret.code = ret.supplierCode;
    if (!ret.nameEn && ret.name) ret.nameEn = ret.name;
    if (ret.paymentTermsCustomer && !ret.paymentTerms) ret.paymentTerms = ret.paymentTermsCustomer;
    return ret;
  },
});

const Partner = mongoose.models.Partner || mongoose.model('Partner', partnerSchema);

/** Populate aliases: legacy ref: 'Customer' / 'Supplier' resolve against partners */
if (!mongoose.models.Customer) {
  mongoose.model('Customer', partnerSchema, 'partners');
}
if (!mongoose.models.Supplier) {
  mongoose.model('Supplier', partnerSchema, 'partners');
}

export { partnerSchema };
export default Partner;
