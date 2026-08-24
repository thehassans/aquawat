import mongoose from 'mongoose';
import { tenantFields } from './common.js';

const pickingSchema = new mongoose.Schema({
  ...tenantFields,
  name: { type: String, required: true },
  operationTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockOperationType', required: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  locationDestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  scheduledDate: { type: Date, default: Date.now },
  dateDeadline: { type: Date },
  dateDone: { type: Date },
  origin: { type: String },
  note: { type: String },
  state: {
    type: String,
    enum: ['draft', 'waiting', 'confirmed', 'assigned', 'done', 'cancel'],
    default: 'draft',
  },
  priority: { type: String, enum: ['0', '1'], default: '0' },
  backorderId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPicking', default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProcurementGroup', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  printed: { type: Boolean, default: false },
  validateLock: { type: String, default: null },
}, { timestamps: true });

pickingSchema.index({ tenantId: 1, name: 1 }, { unique: true });
pickingSchema.index({ tenantId: 1, operationTypeId: 1, state: 1 });
pickingSchema.index({ tenantId: 1, state: 1, scheduledDate: 1 });

export default mongoose.models.StockPicking || mongoose.model('StockPicking', pickingSchema);
