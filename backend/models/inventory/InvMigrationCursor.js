import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

/** Tracks opening-balance migration progress per product×warehouse */
const schema = new mongoose.Schema({
  ...tenantFields,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  legacyQuantity: { ...decimalField },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer' },
  status: { type: String, enum: ['pending', 'done', 'skipped', 'error'], default: 'pending' },
  errorMessage: { type: String },
}, { timestamps: true });

schema.index({ tenantId: 1, productId: 1, warehouseId: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1 });

export default mongoose.models.InvMigrationCursor || mongoose.model('InvMigrationCursor', schema);
