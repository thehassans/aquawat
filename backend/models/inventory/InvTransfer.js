import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const TRANSFER_STATES = ['draft', 'waiting', 'confirmed', 'assigned', 'done', 'cancelled'];

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvOperationType', required: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  sourceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  destLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation', required: true },
  scheduledDate: { type: Date, default: Date.now },
  deadlineDate: { type: Date },
  doneDate: { type: Date },
  origin: { type: String },
  note: { type: String },
  state: { type: String, enum: TRANSFER_STATES, default: 'draft', index: true },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  backorderOfId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer', default: null },
  /** True when this transfer is a customer/vendor return of a done picking */
  isReturn: { type: Boolean, default: false, index: true },
  returnOfTransferId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvTransfer', default: null },
  procurementGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvProcurementGroup', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  responsibleId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  carrierId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvDeliveryCarrier', default: null },
  trackingReference: { type: String },
  shippingWeight: { type: String },
  /** Quoted shipping amount from fixed-rate carrier (string decimal) — not a ledger write */
  shippingCost: { type: String, default: undefined },
  signature: { type: String },
  signedBy: { type: String },
  signedOn: { type: Date },
  isPrinted: { type: Boolean, default: false },
  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date },
  sourceModel: { type: String },
  sourceDocId: { type: mongoose.Schema.Types.ObjectId },
  /** Idempotency lock for validate — set before apply, cleared after */
  validateLock: { type: String, default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.index({ tenantId: 1, operationTypeId: 1, state: 1, scheduledDate: 1 });
schema.index({ tenantId: 1, operationTypeId: 1, state: 1 });
schema.index({ tenantId: 1, state: 1, scheduledDate: 1 });
schema.index({ tenantId: 1, origin: 1 });
schema.index({ tenantId: 1, backorderOfId: 1 });
schema.index({ tenantId: 1, returnOfTransferId: 1 });
schema.index({ tenantId: 1, sourceModel: 1, sourceDocId: 1 });

export { TRANSFER_STATES };
export default mongoose.models.InvTransfer || mongoose.model('InvTransfer', schema);
