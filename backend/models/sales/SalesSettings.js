import mongoose from 'mongoose';

const salesSettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },

  /** Default quotation validity offset in days from issue date */
  quotationValidityDays: { type: Number, default: 30, min: 1, max: 365 },

  /** ordered | delivered — mirrors Product.invoicingPolicy default for new lines */
  defaultInvoicingPolicy: { type: String, enum: ['ordered', 'delivered'], default: 'ordered' },

  /** Require portal signature before SO confirmation */
  requireOnlineSignature: { type: Boolean, default: false },

  /** Require payment webhook before SO confirmation */
  requireOnlinePayment: { type: Boolean, default: false },

  /** Lock confirmed sell PO fields */
  lockConfirmedOrders: { type: Boolean, default: true },

  /** Portal access mode */
  portalSignupMode: { type: String, enum: ['disabled', 'invitation_only', 'free_signup'], default: 'invitation_only' },

  /** Default incoterm code on new sell orders */
  defaultIncoterm: { type: String, default: 'EXW', trim: true },

  /** Show margin columns to users with sales.margin permission */
  showMarginsByDefault: { type: Boolean, default: false },

  /** Amazon / marketplace sync toggle */
  amazonSyncEnabled: { type: Boolean, default: false },

  /** Check partner/product warning flags before confirm */
  enableSaleWarnings: { type: Boolean, default: true },

  /** When available stock < demand on confirm: warn | block */
  oversellPolicy: { type: String, enum: ['warn', 'block'], default: 'warn' },

  /** Margin % below this locks quote for sales-manager approval (0 = disabled) */
  minMarginPercent: { type: Number, default: 0, min: 0, max: 100 },

  /** Composer UI feature toggles (invoice / quotation / SO) */
  showIncotermOnDocuments: { type: Boolean, default: false },
  showComputeShipping: { type: Boolean, default: false },
  showPromoCodes: { type: Boolean, default: false },
  showCrmTagsOnDocuments: { type: Boolean, default: false },

  /** Reveal [Send Pro-Forma] action on quotations */
  enableProforma: { type: Boolean, default: true },

  /** Invoice document defaults */
  invoiceDefaultTerms: { type: String, default: '' },
  invoiceDefaultNotes: { type: String, default: '' },
  invoiceShowCrVatOnLetterhead: { type: Boolean, default: true },

  /** Quotation document defaults */
  quotationDefaultTerms: { type: String, default: '' },
  quotationDefaultNotes: { type: String, default: '' },
  quotationAutoSendOnCreate: { type: Boolean, default: false },
  /** PDF layout: 1 = Essential, 9 = Letterhead (default) */
  defaultQuotationTemplateId: { type: Number, default: 9, enum: [1, 9] },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('SalesSettings', salesSettingsSchema);
