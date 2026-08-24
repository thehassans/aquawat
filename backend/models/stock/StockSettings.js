import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const stockSettingsSchema = new mongoose.Schema({
  ...tenantFields,
  groupStockMultiLocations: { type: Boolean, default: true },
  groupStockAdvLocation: { type: Boolean, default: false },
  groupStockTrackingLot: { type: Boolean, default: false },
  groupStockPackaging: { type: Boolean, default: false },
  groupStockProductionLot: { type: Boolean, default: false },
  groupLotOnDeliverySlip: { type: Boolean, default: false },
  moduleProductExpiry: { type: Boolean, default: false },
  groupStockStorageCategories: { type: Boolean, default: false },
  groupStockPutawayRules: { type: Boolean, default: false },
  groupUom: { type: Boolean, default: true },
  groupProductVariant: { type: Boolean, default: false },
  annualInventoryMonth: { type: Number, default: 12 },
  annualInventoryDay: { type: Number, default: 31 },
  securityLeadTime: { type: Number, default: 0 },
  daysToPurchase: { type: Number, default: 0 },
  poLeadTime: { type: Number, default: 0 },
  useLandedCosts: { type: Boolean, default: false },
  groupStockSignDelivery: { type: Boolean, default: false },
  groupStockReceptionReport: { type: Boolean, default: false },
  groupStockAutoReception: { type: Boolean, default: false },
  stockMoveEmailValidation: { type: Boolean, default: false },
  barcodeNomenclatureId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockBarcodeNomenclature', default: null },
  schedulerEnabled: { type: Boolean, default: false },
  engineEnabled: { type: Boolean, default: true },
  /** Post real-time valuation / landed-cost journals to Chart of Accounts */
  stockAccountingEnabled: { type: Boolean, default: true },
  propertyStockValuationAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyStockInputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyStockOutputAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  propertyLandedCostAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
}, { timestamps: true });

stockSettingsSchema.index({ tenantId: 1 }, { unique: true });

export default mongoose.models.StockSettings || mongoose.model('StockSettings', stockSettingsSchema);
