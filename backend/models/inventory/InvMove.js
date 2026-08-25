import mongoose from 'mongoose';
import { tenantFields, decimalField, decimal128Field, setDecimalPair } from './common.js';

const MOVE_STATES = [
  'draft', 'waiting', 'confirmed', 'partiallyAvailable', 'assigned', 'done', 'cancelled',
];

const schema = new mongoose.Schema({
  ...tenantFields,
  reference: { type: String },
  origin: { type: String },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProductVariant', default: null },
  uomId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvUom', required: true },
  demandQty: { ...decimalField, default: '0' },
  demandQtyNum: { ...decimal128Field },
  doneQty: { ...decimalField, default: '0' },
  doneQtyNum: { ...decimal128Field },
  /** Unit cost at move time (receipts); used for valuation layers */
  unitCost: { type: String, default: undefined },
  unitCostNum: { ...decimal128Field },
  isPicked: { type: Boolean, default: false },
  sourceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  destLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  finalLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', default: null },
  state: { type: String, enum: MOVE_STATES, default: 'draft', index: true },
  procureMethod: { type: String, enum: ['makeToStock', 'makeToOrder'], default: 'makeToStock' },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer', index: true },
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvRule', default: null },
  procurementGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProcurementGroup', default: null },
  originMoveIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvMove' }],
  destMoveIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvMove' }],
  date: { type: Date, default: Date.now },
  deadlineDate: { type: Date },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  propagateCancel: { type: Boolean, default: true },
  isScrapped: { type: Boolean, default: false },
  partnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  sourceModel: { type: String },
  sourceDocId: { type: mongoose.Schema.Types.ObjectId },
  sourceLineId: { type: String },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, transferId: 1 });
schema.index({ tenantId: 1, productId: 1, state: 1 });
schema.index({ tenantId: 1, state: 1, date: 1 });
schema.index({ tenantId: 1, sourceModel: 1, sourceDocId: 1 });

schema.pre('validate', function syncMirrors(next) {
  setDecimalPair(this, 'demandQty', this.demandQty ?? '0');
  setDecimalPair(this, 'doneQty', this.doneQty ?? '0');
  if (this.unitCost != null && this.unitCost !== '') {
    setDecimalPair(this, 'unitCost', this.unitCost);
  }
  next();
});

export { MOVE_STATES };
export default mongoose.models.InvMove || mongoose.model('InvMove', schema);
