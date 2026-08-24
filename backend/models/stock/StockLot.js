import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const lotSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  ref: { type: String },
  expirationDate: { type: Date },
  useDate: { type: Date },
  removalDate: { type: Date },
  alertDate: { type: Date },
  note: { type: String },
}, { timestamps: true });

lotSchema.index({ tenantId: 1, productId: 1, name: 1 }, { unique: true });
lotSchema.index({ tenantId: 1, productId: 1 });

export default mongoose.models.StockLot || mongoose.model('StockLot', lotSchema);
