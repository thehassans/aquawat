import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

/**
 * Delivery carrier stub — rate()/ship() not connected to live APIs.
 * Enabling a moduleCarrier* flag stores intent; UI shows “connector not installed”.
 */
const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  carrierType: {
    type: String,
    enum: ['fixed', 'basedOnRules', 'provider'],
    default: 'fixed',
  },
  providerCode: {
    type: String,
    enum: ['none', 'ups', 'dhl', 'fedex', 'usps', 'smsa', 'aramex', 'naqel', 'easypost', 'sendcloud'],
    default: 'none',
  },
  fixedPrice: { ...decimalField, default: '0' },
  freeAbove: { ...decimalField, default: null },
  marginPercent: { type: Number, default: 0 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  active: { type: Boolean, default: true },
  installed: { type: Boolean, default: false },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.InvDeliveryCarrier || mongoose.model('InvDeliveryCarrier', schema);

/** Interface placeholder for a future provider adapter */
export const CarrierProvider = {
  async rate() {
    throw new Error('Carrier provider not installed');
  },
  async ship() {
    throw new Error('Carrier provider not installed');
  },
  async cancel() {
    throw new Error('Carrier provider not installed');
  },
  trackingUrl() {
    return null;
  },
};
