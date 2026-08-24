import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const stockMoveSchema = new mongoose.Schema({
  ...tenantFields,
  reference: { type: String },
  origin: { type: String },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  productUomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUom', required: true },
  productUomQty: { ...decimalField, default: '0' },
  quantity: { ...decimalField, default: '0' },
  picked: { type: Boolean, default: false },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  locationDestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  locationFinalId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', default: null },
  state: {
    type: String,
    enum: ['draft', 'waiting', 'confirmed', 'partially_available', 'assigned', 'done', 'cancel'],
    default: 'draft',
  },
  procureMethod: { type: String, enum: ['make_to_stock', 'make_to_order'], default: 'make_to_stock' },
  pickingId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPicking' },
  ruleId: { type: mongoose.Schema.Types.ObjectId, default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProcurementGroup', default: null },
  moveOrigIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMove' }],
  moveDestIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockMove' }],
  date: { type: Date, default: Date.now },
  dateDeadline: { type: Date },
  priority: { type: String, enum: ['0', '1'], default: '0' },
  propagateCancel: { type: Boolean, default: true },
  scrapped: { type: Boolean, default: false },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  descriptionPicking: { type: String },
}, { timestamps: true });

stockMoveSchema.index({ tenantId: 1, pickingId: 1 });
stockMoveSchema.index({ tenantId: 1, productId: 1, state: 1 });
stockMoveSchema.index({ tenantId: 1, state: 1 });

export default mongoose.models.StockMove || mongoose.model('StockMove', stockMoveSchema);
