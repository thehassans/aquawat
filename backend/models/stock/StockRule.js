import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const ruleSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockRoute', required: true },
  sequence: { type: Number, default: 20 },
  action: {
    type: String,
    enum: ['pull', 'push', 'pull_push', 'buy', 'manufacture'],
    default: 'pull',
  },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockOperationType', default: null },
  locationSrcId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  locationDestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  procureMethod: {
    type: String,
    enum: ['make_to_stock', 'make_to_order', 'mts_else_mto'],
    default: 'make_to_stock',
  },
  groupPropagationOption: {
    type: String,
    enum: ['none', 'propagate', 'fixed'],
    default: 'propagate',
  },
  fixedGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProcurementGroup', default: null },
  propagateCancel: { type: Boolean, default: true },
  delay: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

ruleSchema.index({ tenantId: 1, routeId: 1, sequence: 1 });
ruleSchema.index({ tenantId: 1, locationDestId: 1 });

export default mongoose.models.StockRule || mongoose.model('StockRule', ruleSchema);
