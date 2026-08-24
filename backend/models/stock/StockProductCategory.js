import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const productCategorySchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductCategory', default: null },
  completeName: { type: String, required: true },
  removalStrategy: { type: String, enum: ['fifo', 'lifo', 'fefo', 'closest'], default: null },
  costMethod: { type: String, enum: ['standard', 'fifo', 'average'], default: 'average' },
  valuation: { type: String, enum: ['manual_periodic', 'real_time'], default: 'real_time' },
  routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockRoute' }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

productCategorySchema.index({ tenantId: 1, completeName: 1 }, { unique: true });

export default mongoose.models.StockProductCategory
  || mongoose.model('StockProductCategory', productCategorySchema);
