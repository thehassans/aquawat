import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const putawayRuleSchema = new mongoose.Schema({
  ...tenantFields,
  sequence: { type: Number, default: 10 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductCategory', default: null },
  packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPackageType', default: null },
  locationInId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  locationOutId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  storageCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockStorageCategory', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

putawayRuleSchema.index({ tenantId: 1, locationInId: 1, sequence: -1 });

export default mongoose.models.StockPutawayRule || mongoose.model('StockPutawayRule', putawayRuleSchema);
