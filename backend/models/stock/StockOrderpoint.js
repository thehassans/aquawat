import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const orderpointSchema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse', required: true },
  productMinQty: { ...decimalField, default: '0' },
  productMaxQty: { ...decimalField, default: '0' },
  qtyMultiple: { ...decimalField, default: '1' },
  trigger: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockRoute', default: null },
  leadDays: { type: Number, default: 0 },
  leadDaysDate: { type: Date },
  snoozedUntil: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

orderpointSchema.index({ tenantId: 1, productId: 1, locationId: 1 }, { unique: true });
orderpointSchema.index({ tenantId: 1, warehouseId: 1, trigger: 1, active: 1 });

export default mongoose.models.StockOrderpoint || mongoose.model('StockOrderpoint', orderpointSchema);
