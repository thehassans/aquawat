import mongoose from 'mongoose';
import { tenantFields } from './common.js';

/** B.8 — sales channel connector framework (Salla, Shopify, …) */
const schema = new mongoose.Schema({
  ...tenantFields,
  platform: {
    type: String,
    enum: ['salla', 'zid', 'shopify', 'woocommerce'],
    required: true,
  },
  name: { type: String, required: true },
  credentialsEnc: { type: String, default: '' },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  stockBuffer: { type: Number, default: 0 },
  syncInbound: { type: Boolean, default: true },
  syncOutbound: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'paused', 'error'], default: 'paused' },
  lastSyncAt: { type: Date, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true });

schema.index({ tenantId: 1, platform: 1 });

export default mongoose.models.InvSalesChannel || mongoose.model('InvSalesChannel', schema);
