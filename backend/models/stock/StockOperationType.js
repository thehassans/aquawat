import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const operationTypeSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  code: { type: String, enum: ['incoming', 'outgoing', 'internal'], required: true },
  sequencePrefix: { type: String, required: true },
  sequenceCode: { type: String, required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockWarehouse', required: true },
  defaultLocationSrcId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  defaultLocationDestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  reservationMethod: { type: String, enum: ['at_confirm', 'manual', 'by_date'], default: 'at_confirm' },
  reservationDaysBefore: { type: Number, default: 0 },
  createBackorder: { type: String, enum: ['ask', 'always', 'never'], default: 'ask' },
  useCreateLots: { type: Boolean, default: false },
  useExistingLots: { type: Boolean, default: false },
  showOperations: { type: Boolean, default: true },
  printLabel: { type: Boolean, default: false },
  returnPickingTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockOperationType', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

operationTypeSchema.index({ tenantId: 1, warehouseId: 1, code: 1 });

export default mongoose.models.StockOperationType
  || mongoose.model('StockOperationType', operationTypeSchema);
