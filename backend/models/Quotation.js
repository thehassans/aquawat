import mongoose from 'mongoose';
import momentHijri from 'moment-hijri';

const travelSegmentSchema = new mongoose.Schema({
  from: { type: String },
  to: { type: String },
  fromAr: { type: String },
  toAr: { type: String },
}, { _id: false });

const travelPassengerSchema = new mongoose.Schema({
  title: { type: String, enum: ['mr', 'mrs', 'ms'], default: 'mr' },
  name: { type: String },
  nameAr: { type: String },
  passportNumber: { type: String },
}, { _id: false });

const travelDetailsSchema = new mongoose.Schema({
  passengerTitle: { type: String, enum: ['mr', 'mrs', 'ms'], default: 'mr' },
  travelerName: { type: String },
  travelerNameAr: { type: String },
  passportNumber: { type: String },
  ticketNumber: { type: String },
  pnr: { type: String },
  airlineName: { type: String },
  airlineNameAr: { type: String },
  routeFrom: { type: String },
  routeFromAr: { type: String },
  routeTo: { type: String },
  routeToAr: { type: String },
  segments: [travelSegmentSchema],
  departureDate: { type: Date },
  hasReturnDate: { type: Boolean, default: false },
  returnDate: { type: Date },
  layoverStay: { type: String },
  layoverStayAr: { type: String },
  passengers: [travelPassengerSchema],
}, { _id: false });

const quotationLineSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant' },
  productName: { type: String, required: true },
  productNameAr: { type: String },
  productType: { type: String, enum: ['goods', 'service'], default: 'goods' },
  description: { type: String },
  descriptionAr: { type: String },
  quantity: { type: Number, required: true },
  unitCode: { type: String, default: 'PCE' },
  unitPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  taxCategory: { type: String, enum: ['S', 'Z', 'E', 'O'], default: 'S' },
  taxRate: { type: Number, default: 15 },
  taxAmount: { type: Number },
  lineTotal: { type: Number },
  lineTotalWithTax: { type: Number },
  agencyPrice: { type: Number, default: 0, min: 0 },
  customerPrice: { type: Number, default: 0, min: 0 },
  isTravelMargin: { type: Boolean, default: false },
  marginTaxable: { type: Number, default: 0 },
}, { _id: false });

const partySchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: { type: String },
  vatNumber: { type: String },
  crNumber: { type: String },
  address: {
    street: { type: String },
    streetAr: { type: String },
    district: { type: String },
    districtAr: { type: String },
    city: { type: String },
    cityAr: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'SA' },
    buildingNumber: { type: String },
    additionalNumber: { type: String },
    shortAddress: { type: String },
  },
  contactPhone: { type: String },
  contactEmail: { type: String },
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  businessContext: { type: String, enum: ['trading', 'construction', 'travel_agency', 'restaurant'], default: 'trading', index: true },
  quotationNumber: { type: String, required: true },
  subject: { type: String },
  subjectAr: { type: String },
  pdfTemplateId: { type: Number, min: 1, max: 9 },
  transactionType: { type: String, enum: ['B2B', 'B2C'], default: 'B2C', required: true },
  issueDate: { type: Date, required: true },
  issueDateHijri: { type: String },
  validUntil: { type: Date },
  validUntilHijri: { type: String },
  seller: partySchema,
  buyer: partySchema,
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', index: true },
  travelDetails: travelDetailsSchema,
  lineItems: [quotationLineSchema],
  subtotal: { type: Number, required: true, default: 0 },
  invoiceDiscount: { type: Number, default: 0, min: 0 },
  totalDiscount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'SAR' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'approved', 'rejected', 'expired', 'cancelled', 'converted'],
    default: 'draft',
    index: true,
  },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: { type: String },
  approvedByNameAr: { type: String },
  rejectedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedByName: { type: String },
  rejectedByNameAr: { type: String },
  convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },
  convertedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
  convertedAt: { type: Date },
  /** Sales CRM */
  salesTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesTeam', default: null },
  salespersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SalesTag' }],
  quotationTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotationTemplate', default: null },
  onlineSignatureUrl: { type: String, default: '' },
  signedAt: { type: Date, default: null },
  signatureData: { type: String, default: '' },
  paymentConfirmedAt: { type: Date, default: null },
  notes: { type: String },
  internalNotes: { type: String },
  termsAndConditions: { type: String },
  includeBankDetails: { type: Boolean, default: false },
  bankDetails: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    iban: { type: String, default: '' },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  createdByNameAr: { type: String },
  authorizedPersonName: { type: String },
  authorizedPersonNameAr: { type: String },
  authorizedPersonDesignation: { type: String },
  authorizedPersonDesignationAr: { type: String },
  authorizedPersonSignature: { type: String }, // data URL or URL of uploaded signature image
}, {
  timestamps: true,
});

quotationSchema.index({ tenantId: 1, quotationNumber: 1 }, { unique: true });
quotationSchema.index({ tenantId: 1, issueDate: -1 });
quotationSchema.index({ tenantId: 1, businessContext: 1, issueDate: -1 });
quotationSchema.index({ tenantId: 1, createdBy: 1, issueDate: -1 });

quotationSchema.pre('validate', function(next) {
  if (this.isModified('issueDate') && this.issueDate) {
    this.issueDateHijri = momentHijri(this.issueDate).format('iYYYY/iMM/iDD');
  }
  if (this.isModified('validUntil') && this.validUntil) {
    this.validUntilHijri = momentHijri(this.validUntil).format('iYYYY/iMM/iDD');
  } else if (this.isModified('validUntil') && !this.validUntil) {
    this.validUntilHijri = undefined;
  }

  const lines = Array.isArray(this.lineItems) ? this.lineItems : [];
  const invoiceDiscount = Math.max(0, Number(this.invoiceDiscount) || 0);

  const normalizedLines = lines.map((line) => {
    const quantity = Math.max(0, Number(line.quantity) || 0);
    const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
    const agencyPrice = Math.max(0, Number(line.agencyPrice) || 0);
    const isTravelMargin = Boolean(line.isTravelMargin);
    const customerPriceInput = Math.max(0, Number(line.customerPrice) || 0);
    const customerPriceEff = isTravelMargin && customerPriceInput > 0 ? customerPriceInput : unitPrice;
    if (isTravelMargin) {
      line.customerPrice = customerPriceEff;
    }
    const lineSubtotal = Math.max(0, quantity * customerPriceEff);
    const rawDiscount = Math.max(0, Number(line.discount) || 0);
    const lineDiscount = line.discountType === 'percentage'
      ? Math.min(lineSubtotal, lineSubtotal * (rawDiscount / 100))
      : Math.min(lineSubtotal, rawDiscount);
    const netBeforeInvoiceDiscount = Math.max(0, lineSubtotal - lineDiscount);
    const taxRate = isTravelMargin ? 0 : Math.max(0, Number(line.taxRate) || 0);
    if (isTravelMargin) line.taxRate = 0;
    const marginPerUnit = isTravelMargin ? Math.max(0, unitPrice - agencyPrice) : 0;
    const marginBeforeInvoiceDiscount = isTravelMargin
      ? Math.max(0, (quantity * marginPerUnit) - (lineDiscount * (customerPriceEff > 0 ? marginPerUnit / customerPriceEff : 0)))
      : 0;

    return {
      line,
      lineSubtotal,
      lineDiscount,
      netBeforeInvoiceDiscount,
      taxRate,
      isTravelMargin,
      marginBeforeInvoiceDiscount,
    };
  });

  const subtotalBeforeInvoiceDiscount = normalizedLines.reduce((sum, item) => sum + item.netBeforeInvoiceDiscount, 0);
  const appliedInvoiceDiscount = Math.min(invoiceDiscount, subtotalBeforeInvoiceDiscount);
  let remainingInvoiceDiscount = appliedInvoiceDiscount;

  normalizedLines.forEach((item, index) => {
    const isLast = index === normalizedLines.length - 1;
    const proportionalDiscount = subtotalBeforeInvoiceDiscount > 0
      ? appliedInvoiceDiscount * (item.netBeforeInvoiceDiscount / subtotalBeforeInvoiceDiscount)
      : 0;
    const invoiceDiscountShare = isLast
      ? remainingInvoiceDiscount
      : Math.min(remainingInvoiceDiscount, proportionalDiscount);
    const customerLineTotal = Math.max(0, item.netBeforeInvoiceDiscount - invoiceDiscountShare);
    const marginShareFactor = item.netBeforeInvoiceDiscount > 0
      ? customerLineTotal / item.netBeforeInvoiceDiscount
      : 0;
    const marginTaxable = item.isTravelMargin
      ? Math.max(0, item.marginBeforeInvoiceDiscount * marginShareFactor)
      : 0;
    const vatBase = item.isTravelMargin ? marginTaxable : customerLineTotal;
    const taxAmount = vatBase * (item.taxRate / 100);
    const lineTotal = item.isTravelMargin
      ? Math.max(0, customerLineTotal - taxAmount)
      : customerLineTotal;
    const lineTotalWithTax = item.isTravelMargin
      ? customerLineTotal
      : lineTotal + taxAmount;

    item.line.lineTotal = lineTotal;
    item.line.taxAmount = taxAmount;
    item.line.lineTotalWithTax = lineTotalWithTax;
    item.line.marginTaxable = marginTaxable;

    remainingInvoiceDiscount = Math.max(0, remainingInvoiceDiscount - invoiceDiscountShare);
  });

  this.invoiceDiscount = appliedInvoiceDiscount;
  this.subtotal = normalizedLines.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const lineDiscountTotal = normalizedLines.reduce((sum, item) => sum + item.lineDiscount, 0);
  this.totalDiscount = lineDiscountTotal + appliedInvoiceDiscount;
  this.taxableAmount = normalizedLines.reduce((sum, item) => sum + (item.line.lineTotal || 0), 0);
  this.totalTax = lines.reduce((sum, line) => sum + (line.taxAmount || 0), 0);
  this.grandTotal = this.taxableAmount + this.totalTax;

  next();
});

const Quotation = mongoose.model('Quotation', quotationSchema);
export default Quotation;
