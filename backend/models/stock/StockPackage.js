import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const packageSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPackageType', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  packUseDate: { type: Date },
}, { timestamps: true });

packageSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.StockPackage || mongoose.model('StockPackage', packageSchema);
