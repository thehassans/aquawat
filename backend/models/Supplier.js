import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  code: { type: String, required: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String },
  type: { type: String, enum: ['company', 'individual'], default: 'company' },

  vatNumber: { type: String },
  crNumber: { type: String },

  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },

  address: {
    street: { type: String },
    district: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'SA' }
  },

  paymentTerms: {
    term: { type: String, enum: ['immediate', 'net_7', 'net_15', 'net_30', 'net_60'], default: 'net_30' },
    customDays: { type: Number }
  },

  bank: {
    iban: { type: String },
    bankName: { type: String },
    beneficiaryName: { type: String }
  },

  notes: { type: String },

  // Supplier Addition & Categorization
  isAddition: { type: Boolean, default: false },
  additionSource: { type: String, default: 'direct' },
  additionDate: { type: Date },
  tags: [{ type: String }],

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  /** Parent company for individual contacts (ERP hierarchy) */
  parentCompanyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null,
  },
  /** Accounting role flags — set from creation context, not manual UI */
  isCustomer: { type: Boolean, default: false },
  isVendor: { type: Boolean, default: true },
  /** Explicit Accounts Payable override */
  payableAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    default: null,
  },
}, {
  timestamps: true
});

supplierSchema.index({ tenantId: 1, code: 1 }, { unique: true });
supplierSchema.index({ tenantId: 1, nameEn: 1 });
supplierSchema.index({ tenantId: 1, vatNumber: 1 });
supplierSchema.index({ tenantId: 1, isAddition: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
