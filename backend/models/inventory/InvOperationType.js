import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const schema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  nameAr: { type: String },
  code: {
    type: String,
    enum: ['incoming', 'outgoing', 'internal', 'pos', 'manufacturing'],
    required: true,
  },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  sequencePrefix: { type: String, required: true },
  sequenceCode: { type: String, required: true },
  defaultSourceLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  defaultDestLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvLocation' },
  returnOperationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvOperationType', default: null },
  reservationMethod: {
    type: String,
    enum: ['atConfirm', 'manual', 'byDate'],
    default: 'atConfirm',
  },
  reservationDaysBefore: { type: Number, default: 0 },
  createBackorder: { type: String, enum: ['ask', 'always', 'never'], default: 'ask' },
  allowExtraProducts: { type: Boolean, default: false },
  requireFullValidation: { type: Boolean, default: false },
  /** When true (outgoing), Validate requires a captured delivery signature */
  requireSignature: { type: Boolean, default: false },
  useCreateLots: { type: Boolean, default: false },
  useExistingLots: { type: Boolean, default: false },
  showDetailedOperations: { type: Boolean, default: false },
  printLabelOnValidate: { type: Boolean, default: false },
  barcode: { type: String },
  cardColor: { type: String, default: '#0d9488' },
  analyticAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, warehouseId: 1, code: 1 });
schema.index({ tenantId: 1, sequenceCode: 1 }, { unique: true });
schema.index({ tenantId: 1, active: 1 });

export default mongoose.models.InvOperationType || mongoose.model('InvOperationType', schema);
