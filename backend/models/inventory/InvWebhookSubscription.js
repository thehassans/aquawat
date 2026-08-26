import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  event: {
    type: String,
    enum: [
      'picking.validated',
      'stock.low',
      'lot.expiring',
      'count.variance_flagged',
      'product.created',
    ],
    required: true,
  },
  url: { type: String, required: true },
  secret: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
  lastDeliveryAt: { type: Date, default: null },
  failureCount: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, event: 1, active: 1 });

export default mongoose.models.InvWebhookSubscription || mongoose.model('InvWebhookSubscription', schema);
