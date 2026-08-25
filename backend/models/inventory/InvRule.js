import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvRoute', required: true },
  sequence: { type: Number, default: 20 },
  action: {
    type: String,
    enum: ['pull', 'push', 'pullPush', 'buy', 'manufacture'],
    default: 'pull',
  },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvOperationType', default: null },
  sourceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', default: null },
  destLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  procureMethod: {
    type: String,
    enum: ['makeToStock', 'makeToOrder', 'mtsElseMto'],
    default: 'makeToStock',
  },
  groupPropagation: {
    type: String,
    enum: ['none', 'propagate', 'fixed'],
    default: 'propagate',
  },
  fixedGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProcurementGroup', default: null },
  propagateCancel: { type: Boolean, default: true },
  leadDays: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, routeId: 1, sequence: 1 });
schema.index({ tenantId: 1, destLocationId: 1, active: 1 });

export default mongoose.models.InvRule || mongoose.model('InvRule', schema);
