import mongoose from 'mongoose';
import momentHijri from 'moment-hijri';
import { statsRead } from '../utils/mongoReadPreference.js';
import { roundMoney } from '../utils/money.js';

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

const boutiqueDetailsSchema = new mongoose.Schema({
  rentalId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoutiqueRental' },
  rentalNumber: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  pickedUpAt: { type: Date },
  returnedAt: { type: Date },
  totalDeposit: { type: Number, default: 0 },
  totalLateFee: { type: Number, default: 0 },
  totalDamageFee: { type: Number, default: 0 },
  totalCleaningFee: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  amountRefunded: { type: Number, default: 0 },
  depositStatus: { type: String, enum: ['pending', 'held', 'partially_refunded', 'fully_refunded', 'forfeited'], default: 'pending' },
  transactionType: { type: String, enum: ['rental', 'sale'], default: 'rental' },
}, { _id: false });


const cleanObjectId = (v) => {
  if (!v || v === '' || v === 'null' || v === 'undefined') return undefined;
  if (typeof v === 'string' && !mongoose.Types.ObjectId.isValid(v)) return undefined;
  return v;
};

const invoiceLineSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', set: cleanObjectId },
  productName: { type: String, required: true },
  productNameAr: { type: String },
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
  sourceDnItemId: { type: mongoose.Schema.Types.ObjectId, set: cleanObjectId },
  sourcePoItemId: { type: mongoose.Schema.Types.ObjectId, set: cleanObjectId }
});

const partySchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: { type: String },
  vatNumber: { type: String },
  crNumber: { type: String },
  address: {
    street: { type: String },
    district: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String, default: 'SA' },
    buildingNumber: { type: String },
    additionalNumber: { type: String }
  },
  contactPhone: { type: String },
  contactEmail: { type: String }
});

const zatcaSchema = new mongoose.Schema({
  uuid: { type: String },
  
  // Phase 1 / Legacy
  invoiceCounter: { type: Number },
  previousInvoiceHash: { type: String },
  invoiceHash: { type: String },
  digitalSignature: { type: String },
  publicKeyHash: { type: String },
  signedXml: { type: String },
  qrCodeData: { type: String },
  qrCodeImage: { type: String },

  // Phase 2 / Offline Sync Fields
  icv: { type: Number }, // Invoice Counter Value
  pih: { type: String }, // Previous Invoice Hash (Base64)
  xmlHash: { type: String }, // SHA-256 Base64
  cryptographicStamp: { type: String }, // ECDSA
  phase2QrCode: { type: String }, // Tags 1-9
  xmlPayload: { type: String }, // UBL 2.1 XML

  // Sync Status for Offline-First Architecture
  syncStatus: { 
    type: String, 
    enum: ['PENDING_SYNC', 'SYNCED', 'ZATCA_REPORTED', 'ZATCA_FAILED'], 
    default: 'PENDING_SYNC' 
  },
  syncDeviceId: { type: String },

  submissionStatus: {
    type: String,
    enum: ['pending', 'submitted', 'cleared', 'reported', 'rejected', 'warning'],
    default: 'pending'
  },
  clearanceStatus: { type: String },
  reportingStatus: { type: String },
  zatcaResponse: { type: mongoose.Schema.Types.Mixed },
  submittedAt: { type: Date },
  clearedAt: { type: Date },
  retryCount: { type: Number, default: 0 },
  lastError: { type: String }
});

const inventorySchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', set: cleanObjectId },
  postedAt: { type: Date },
  reversedAt: { type: Date }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  flow: { type: String, enum: ['sell', 'purchase'], default: 'sell', index: true },
  businessContext: { type: String, enum: ['trading', 'construction', 'travel_agency', 'restaurant', 'manpower', 'bakala', 'boutique', 'bookstore', 'furniture'], default: 'trading', index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', index: true, set: cleanObjectId },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true, set: cleanObjectId },
  
  // Invoice Identification
  invoiceNumber: { type: String, required: true },
  invoiceType: { type: String, enum: ['388', '381', '383'], default: '388' },
  invoiceSubtype: { type: String, enum: ['standard', 'travel_ticket', 'proforma'], default: 'standard' },
  pdfTemplateId: { type: Number, min: 1, max: 8 },
  invoiceTypeCode: {
    type: String,
    enum: ['0100000', '0200000', '0100100', '0200100', '0100200', '0200200'],
    required: true
  },
  transactionType: { type: String, enum: ['B2B', 'B2C'], required: true },
  
  // Dates
  issueDate: { type: Date, required: true },
  issueDateHijri: { type: String },
  issueTime: { type: String },
  supplyDate: { type: Date },
  supplyDateHijri: { type: String },
  dueDate: { type: Date },
  printFormat: { type: String, enum: ['a4', 'thermal'], default: 'a4' },
  
  // Parties
  seller: partySchema,
  buyer: partySchema,

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true, set: cleanObjectId },
  
  // Line Items
  lineItems: [invoiceLineSchema],
  
  // Totals
  subtotal: { type: Number, required: true },
  invoiceDiscount: { type: Number, default: 0, min: 0 },
  totalDiscount: { type: Number, default: 0 },
  taxableAmount: { type: Number },
  totalTax: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  
  // Currency
  currency: { type: String, default: 'SAR' },
  exchangeRate: { type: Number, default: 1 },
  
  // Payment
  paymentMethod: { type: String, enum: ['cash', 'card', 'credit', 'bank_transfer', 'cheque', 'other', 'split', 'khata'], default: 'cash' },
  payments: [{
    method: { type: String, enum: ['cash', 'card', 'bank_transfer', 'other', 'khata'] },
    amount: { type: Number }
  }],
  paymentTerms: { type: String },
  paymentStatus: { type: String, enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'], default: 'pending' },
  paidAmount: { type: Number, default: 0 },
  
  // Reference
  purchaseOrderNumber: { type: String },
  sourcePurchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true, set: cleanObjectId },
  deliveryNoteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryNote', index: true, set: cleanObjectId }],
  contractNumber: { type: String },
  originalInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', set: cleanObjectId },
  proformaSourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', set: cleanObjectId },
  sourceQuotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true, set: cleanObjectId },

  restaurantOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantOrder', index: true, set: cleanObjectId },
  travelBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TravelBooking', index: true, set: cleanObjectId },
  rentalId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoutiqueRental', index: true, set: cleanObjectId },
  rentalNumber: { type: String, index: true },
  travelDetails: travelDetailsSchema,
  boutiqueDetails: boutiqueDetailsSchema,
  searchText: { type: String, default: '' },
  
  // ZATCA Compliance
  zatca: zatcaSchema,

  inventory: inventorySchema,
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'sent', 'cancelled', 'credited'],
    default: 'draft'
  },
  
  // Metadata
  notes: { type: String },
  termsAndConditions: { type: String },
  includeBankDetails: { type: Boolean, default: false },
  bankDetails: {
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    iban: { type: String, default: '' },
  },
  internalNotes: { type: String },
  attachments: [{
    name: { type: String },
    url: { type: String },
    type: { type: String }
  }],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  createdByNameAr: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date }
}, {
  timestamps: true
});

invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ tenantId: 1, status: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, issueDate: -1, _id: -1 });
invoiceSchema.index({ tenantId: 1, 'zatca.submissionStatus': 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, transactionType: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, flow: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, restaurantOrderId: 1 });
invoiceSchema.index({ tenantId: 1, travelBookingId: 1 });
invoiceSchema.index({ tenantId: 1, createdAt: -1 });
invoiceSchema.index({ tenantId: 1, createdBy: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, customerId: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, paymentStatus: 1, dueDate: 1 });
invoiceSchema.index({ tenantId: 1, paymentStatus: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, flow: 1, status: 1, issueDate: -1 });
invoiceSchema.index({ tenantId: 1, searchText: 1 });
// Overdue job is platform-wide (no tenantId in the filter).
invoiceSchema.index({ paymentStatus: 1, dueDate: 1, status: 1, flow: 1 });

// Pre-save hook for Hijri dates
invoiceSchema.pre('validate', function(next) {
  if (this.isModified('issueDate') && this.issueDate) {
    this.issueDateHijri = momentHijri(this.issueDate).format('iYYYY/iMM/iDD');
  }
  if (this.isModified('supplyDate') && this.supplyDate) {
    this.supplyDateHijri = momentHijri(this.supplyDate).format('iYYYY/iMM/iDD');
  }
  
  const lines = Array.isArray(this.lineItems) ? this.lineItems : [];
  const invoiceDiscount = Math.max(0, Number(this.invoiceDiscount) || 0);

  // Calculate line totals
  const normalizedLines = lines.map(line => {
    const quantity = Math.max(0, Number(line.quantity) || 0);
    const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
    const agencyPrice = Math.max(0, Number(line.agencyPrice) || 0);
    const isTravelMargin = Boolean(line.isTravelMargin);
    // For travel lines, customerPrice drives the printed / customer-facing subtotal.
    // When customerPrice is not set (legacy data) fall back to unitPrice.
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
    // Travel agency invoices are VAT-exempt per tenant policy: force 0% on margin lines.
    const requestedTaxRate = Number(line.taxRate);
    const taxRate = isTravelMargin
      ? Math.max(0, Number.isFinite(requestedTaxRate) && requestedTaxRate > 0 ? requestedTaxRate : 15)
      : Math.max(0, requestedTaxRate || 0);
    if (isTravelMargin) line.taxRate = taxRate;
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
      ? roundMoney(appliedInvoiceDiscount * (item.netBeforeInvoiceDiscount / subtotalBeforeInvoiceDiscount))
      : 0;
    const invoiceDiscountShare = isLast
      ? roundMoney(remainingInvoiceDiscount)
      : roundMoney(Math.min(remainingInvoiceDiscount, proportionalDiscount));
    const customerLineTotal = roundMoney(Math.max(0, item.netBeforeInvoiceDiscount - invoiceDiscountShare));
    const marginShareFactor = item.netBeforeInvoiceDiscount > 0
      ? customerLineTotal / item.netBeforeInvoiceDiscount
      : 0;
    const marginTaxable = item.isTravelMargin
      ? roundMoney(Math.max(0, item.marginBeforeInvoiceDiscount * marginShareFactor))
      : 0;
    const vatBase = item.isTravelMargin ? marginTaxable : customerLineTotal;
    const taxAmount = roundMoney(vatBase * (item.taxRate / 100));
    const lineTotal = item.isTravelMargin
      ? roundMoney(Math.max(0, customerLineTotal - taxAmount))
      : customerLineTotal;
    const lineTotalWithTax = item.isTravelMargin
      ? customerLineTotal
      : roundMoney(lineTotal + taxAmount);

    item.line.lineTotal = lineTotal;
    item.line.taxAmount = taxAmount;
    item.line.lineTotalWithTax = lineTotalWithTax;
    item.line.marginTaxable = marginTaxable;

    remainingInvoiceDiscount = roundMoney(Math.max(0, remainingInvoiceDiscount - invoiceDiscountShare));
  });
  
  // Calculate invoice totals
  this.invoiceDiscount = roundMoney(appliedInvoiceDiscount);
  this.subtotal = roundMoney(normalizedLines.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const lineDiscountTotal = normalizedLines.reduce((sum, item) => sum + item.lineDiscount, 0);
  this.totalDiscount = roundMoney(lineDiscountTotal + appliedInvoiceDiscount);
  this.taxableAmount = roundMoney(normalizedLines.reduce((sum, item) => sum + (item.line.lineTotal || 0), 0));
  this.totalTax = roundMoney(lines.reduce((sum, line) => sum + (line.taxAmount || 0), 0));
  this.grandTotal = roundMoney(this.taxableAmount + this.totalTax);

  const passengerBits = Array.isArray(this.travelDetails?.passengers)
    ? this.travelDetails.passengers.flatMap((p) => [p?.pnr, p?.travelerName, p?.ticketNumber])
    : [];
  this.searchText = [
    this.invoiceNumber,
    this.contractNumber,
    this.rentalNumber,
    this.buyer?.name,
    this.buyer?.nameAr,
    this.buyer?.vatNumber,
    this.buyer?.crNumber,
    this.buyer?.contactPhone,
    this.buyer?.contactEmail,
    this.seller?.name,
    this.seller?.nameAr,
    this.seller?.vatNumber,
    this.seller?.crNumber,
    this.seller?.contactPhone,
    this.seller?.contactEmail,
    this.travelDetails?.pnr,
    this.travelDetails?.travelerName,
    this.travelDetails?.ticketNumber,
    ...passengerBits,
  ].filter(Boolean).join(' ').slice(0, 4000);
  
  next();
});

invoiceSchema.statics.statsAggregate = function statsAggregate(pipeline, options = {}) {
  return statsRead(this.aggregate(pipeline, { allowDiskUse: true, ...options }));
};

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
