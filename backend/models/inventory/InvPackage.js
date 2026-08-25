import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvPackageType', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  packDate: { type: Date, default: Date.now },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, locationId: 1 });

export default mongoose.models.InvPackage || mongoose.model('InvPackage', schema);
