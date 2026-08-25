import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  sequence: { type: Number, default: 10 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductCategory', default: null },
  packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackageType', default: null },
  fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  storageCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvStorageCategory', default: null },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, fromLocationId: 1, sequence: -1 });

export default mongoose.models.InvPutawayRule || mongoose.model('InvPutawayRule', schema);
