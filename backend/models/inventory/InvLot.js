import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  ref: { type: String },
  expirationDate: { type: Date },
  useByDate: { type: Date },
  removalDate: { type: Date },
  alertDate: { type: Date },
  note: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, productId: 1 });
schema.index({ tenantId: 1, removalDate: 1 });
schema.index({ tenantId: 1, expirationDate: 1 });

export default mongoose.models.InvLot || mongoose.model('InvLot', schema);
