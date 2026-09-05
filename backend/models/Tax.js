import mongoose from 'mongoose';

export const TAX_COMPUTATION_METHODS = [
  'percent_excluded',
  'percent_included',
  'fixed',
  'group',
];

export const TAX_SCOPES = ['all', 'goods', 'services'];
export const TAX_TYPES = ['sales', 'purchase', 'none'];

export const VAT_TAX_GRID_OPTIONS = [
  'sales_standard_rated',
  'sales_zero_rated',
  'sales_exempt',
  'sales_exports',
  'sales_special_citizen',
  'purchases_standard_rated',
  'purchases_zero_rated',
  'purchases_exempt',
  'purchases_imports',
  'purchases_reverse_charge',
  'purchases_non_recoverable',
  'none',
];

/** ZATCA UNCL5305 tax category codes */
export const ZATCA_TAX_CATEGORIES = ['S', 'Z', 'E', 'O'];

const distributionLineSchema = new mongoose.Schema({
  percentOfBase: { type: Number, default: 100, min: 0, max: 100 },
  percentOfTax: { type: Number, default: 100, min: 0, max: 100 },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  taxGrid: { type: String, default: '', trim: true },
}, { _id: false });

const distributionSchema = new mongoose.Schema({
  baseLine: { type: distributionLineSchema, default: () => ({}) },
  taxLine: { type: distributionLineSchema, default: () => ({}) },
}, { _id: false });

/**
 * Tax master — rate/computation rules, GL distribution, and VAT return grid mapping.
 * Journal lines that post tax stamp taxIds with these ObjectIds.
 */
const taxSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  nameAr: { type: String, default: '', trim: true },
  /** Percentage (0–100) or ignored when computationMethod is fixed/group */
  rate: { type: Number, required: true, min: 0, max: 100 },
  /** Fixed amount per unit when computationMethod is fixed */
  amount: { type: Number, default: null, min: 0 },
  type: {
    type: String,
    enum: TAX_TYPES,
    required: true,
    index: true,
  },
  scope: {
    type: String,
    enum: TAX_SCOPES,
    default: 'all',
  },
  computationMethod: {
    type: String,
    enum: TAX_COMPUTATION_METHODS,
    default: 'percent_excluded',
  },
  /** GL account for tax payable (sales) or recoverable (purchase) — primary posting */
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
  distributionInvoices: { type: distributionSchema, default: () => ({}) },
  distributionRefunds: { type: distributionSchema, default: () => ({}) },
  includedInPrice: { type: Boolean, default: false },
  invoiceLabel: { type: String, default: '', trim: true },
  taxGroupCode: { type: String, default: '', trim: true, uppercase: true },
  subsequentTaxBase: { type: Boolean, default: false },
  country: { type: String, default: 'SA', trim: true, uppercase: true },
  /** ZATCA UNCL5305: S standard, Z zero-rated, E exempt, O out-of-scope / reverse charge */
  zatcaCategory: {
    type: String,
    enum: ZATCA_TAX_CATEGORIES,
    default: 'S',
    index: true,
  },
  /**
   * When false, VAT is added to expense (not Dr 1400).
   * Used for entertainment / blocked input VAT.
   */
  recoverable: { type: Boolean, default: true },
  /** Saudi reverse charge on imported services: Dr VAT Input / Cr VAT Output */
  isReverseCharge: { type: Boolean, default: false },
  /** Child taxes when computationMethod is group */
  childTaxIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tax' }],
  active: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

taxSchema.index({ tenantId: 1, code: 1 }, { unique: true });
taxSchema.index({ tenantId: 1, type: 1, active: 1 });

export default mongoose.models.Tax || mongoose.model('Tax', taxSchema);
