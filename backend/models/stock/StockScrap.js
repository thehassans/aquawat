import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const scrapSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUom', required: true },
  quantity: { ...decimalField, default: '0' },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLot', default: null },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPackage', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  scrapLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  pickingId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPicking', default: null },
  moveId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMove', default: null },
  state: { type: String, enum: ['draft', 'done'], default: 'draft' },
  scrapReasonTag: { type: String },
}, { timestamps: true });

scrapSchema.index({ tenantId: 1, name: 1 }, { unique: true });
scrapSchema.index({ tenantId: 1, state: 1 });

export default mongoose.models.StockScrap || mongoose.model('StockScrap', scrapSchema);
