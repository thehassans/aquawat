import mongoose from 'mongoose';
import { tenantFields, decimalField, decimal128Field } from './common.js';

/**
 * Denormalised on-hand cache for lists / PoS.
 * Ledger (InvQuant) remains source of truth for reports.
 */
const schema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  onHand: { ...decimalField, default: '0' },
  onHandNum: { ...decimal128Field },
  reserved: { ...decimalField, default: '0' },
  reservedNum: { ...decimal128Field },
  forecasted: { ...decimalField, default: '0' },
  forecastedNum: { ...decimal128Field },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, warehouseId: 1 }, { unique: true });
schema.index({ tenantId: 1, warehouseId: 1, updatedAt: -1 });

export default mongoose.models.InvProductStockCache
  || mongoose.model('InvProductStockCache', schema);
