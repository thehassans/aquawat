import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  engineEnabled: { type: Boolean, default: false },
  groupUom: { type: Boolean, default: true },
  groupStockMultiLocations: { type: Boolean, default: true },
  /** Packages (put in pack) — Odoo group_stock_tracking_lot */
  groupStockTrackingLot: { type: Boolean, default: false },
  moduleProductExpiry: { type: Boolean, default: false },
  annualInventoryMonth: { type: Number, default: 12 },
  annualInventoryDay: { type: Number, default: 31 },
  securityLeadTimeSales: { type: Number, default: 0 },
  securityLeadTimePurchase: { type: Number, default: 0 },
  daysToPurchase: { type: Number, default: 0 },
  enforceWarehouseRestriction: { type: Boolean, default: true },
  schedulerEnabled: { type: Boolean, default: false },
  /**
   * ops_only | costing | full_accounting
   * No schema default — missing value is derived from evaluation/stockAccounting flags
   * so existing tenants are not forced to ops_only on load.
   */
  inventoryAccountingMode: {
    type: String,
    enum: ['ops_only', 'costing', 'full_accounting'],
  },
  /** Synced from inventoryAccountingMode. Prefer mode field when set. */
  stockAccountingEnabled: { type: Boolean },
  /** Synced from inventoryAccountingMode. Prefer mode field when set. */
  inventoryEvaluationEnabled: { type: Boolean },
  /** Global override — allow all products to go negative on validate */
  allowNegativeStock: { type: Boolean, default: false },
  propertyStockValuationAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyStockInputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyStockOutputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyLandedCostAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  stockJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Journal', default: null },
  showLotsOnDeliverySlips: { type: Boolean, default: true },
  showLotsOnInvoices: { type: Boolean, default: false },
  receptionReportEnabled: { type: Boolean, default: false },
  groupReceptionReport: { type: Boolean, default: false },
  emailConfirmationOnDelivery: { type: Boolean, default: false },
  signatureOnDelivery: { type: Boolean, default: false },
  groupStockSignDelivery: { type: Boolean, default: false },
  groupAdvLocation: { type: Boolean, default: true },
  groupStockStorageCategories: { type: Boolean, default: false },
  groupPutawayRules: { type: Boolean, default: true },
  groupProductVariant: { type: Boolean, default: false },
  groupStockPackaging: { type: Boolean, default: false },
  groupProductionLot: { type: Boolean, default: false },
  groupLandedCosts: { type: Boolean, default: true },
  groupDeliveryMethods: { type: Boolean, default: false },
  groupStockBarcode: { type: Boolean, default: false },
  menuPos: { type: Boolean, default: true },
  menuManufacturing: { type: Boolean, default: true },
  groupBatchTransfer: { type: Boolean, default: false },
  groupStockWarning: { type: Boolean, default: false },
  defaultPickingPolicy: { type: String, enum: ['direct', 'one'], default: 'direct' },
  moduleQuality: { type: Boolean, default: false },
  barcodeNomenclatureId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvBarcodeNomenclature', default: null },
  stockSmsConfirmation: { type: Boolean, default: false },
  groupGs1Nomenclature: { type: Boolean, default: false },
  groupStockTrackingOwner: { type: Boolean, default: false },
  groupLotOnDeliverySlip: { type: Boolean, default: true },
  groupLotOnInvoice: { type: Boolean, default: false },
  /** Physical inventory — hide on-hand / difference while counting */
  blindCountMode: { type: Boolean, default: false },
  /** Absolute |diff| × unit cost above this requires approval before apply (0 = off) */
  varianceApprovalThreshold: { type: Number, default: 0 },
  /** Block apply / postings with accounting date on or before this day (YYYY-MM-DD or Date) */
  inventoryPeriodLockDate: { type: Date, default: null },
  /** B.2 — block or warn on shipping expired lots (default warn via validation) */
  blockExpiredShipping: { type: Boolean, default: false },
  /** B.5 demand replenishment window (days) */
  demandWindowDays: { type: Number, default: 90 },
  replenishmentServiceLevel: { type: Number, default: 95 },
  replenishmentReviewDays: { type: Number, default: 14 },
  /** Print & Documents */
  printDefaultLang: { type: String, enum: ['ar', 'en'], default: 'ar' },
  printShowPricesOnDelivery: { type: Boolean, default: false },
  printFooterTerms: { type: String, default: '' },
  printWatermarkEnabled: { type: Boolean, default: true },
  printPaperSize: { type: String, enum: ['A4', 'Letter'], default: 'A4' },
  /** Carrier connector flags — no live API; UI shows “not installed” */
  moduleCarrierUps: { type: Boolean, default: false },
  moduleCarrierDhl: { type: Boolean, default: false },
  moduleCarrierFedex: { type: Boolean, default: false },
  moduleCarrierUsps: { type: Boolean, default: false },
  moduleCarrierSmsa: { type: Boolean, default: false },
  moduleCarrierAramex: { type: Boolean, default: false },
  moduleCarrierNaqel: { type: Boolean, default: false },
  moduleCarrierEasypost: { type: Boolean, default: false },
  moduleCarrierSendcloud: { type: Boolean, default: false },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1 }, { unique: true });

export default mongoose.models.InvSettings || mongoose.model('InvSettings', schema);
