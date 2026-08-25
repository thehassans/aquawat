import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  engineEnabled: { type: Boolean, default: false },
  groupUom: { type: Boolean, default: true },
  groupStockMultiLocations: { type: Boolean, default: true },
  groupStockTrackingLot: { type: Boolean, default: false },
  moduleProductExpiry: { type: Boolean, default: false },
  annualInventoryMonth: { type: Number, default: 12 },
  annualInventoryDay: { type: Number, default: 31 },
  securityLeadTimeSales: { type: Number, default: 0 },
  securityLeadTimePurchase: { type: Number, default: 0 },
  daysToPurchase: { type: Number, default: 0 },
  /** When set, stock APIs filter to these warehouses only */
  enforceWarehouseRestriction: { type: Boolean, default: true },
  /** Opt-in nightly / cron scheduler for reorder + reservation retry */
  schedulerEnabled: { type: Boolean, default: false },
  /** Real-time stock valuation journals (requires engineEnabled) */
  stockAccountingEnabled: { type: Boolean, default: true },
  propertyStockValuationAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyStockInputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyStockOutputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyLandedCostAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  /** UI / document feature flags */
  showLotsOnDeliverySlips: { type: Boolean, default: true },
  showLotsOnInvoices: { type: Boolean, default: false },
  receptionReportEnabled: { type: Boolean, default: false },
  emailConfirmationOnDelivery: { type: Boolean, default: false },
  signatureOnDelivery: { type: Boolean, default: false },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1 }, { unique: true });

export default mongoose.models.InvSettings || mongoose.model('InvSettings', schema);
