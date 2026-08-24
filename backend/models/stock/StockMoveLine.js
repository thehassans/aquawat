import mongoose from 'mongoose';
import { tenantFields, decimalField } from './common.js';

const stockMoveLineSchema = new mongoose.Schema({
  ...tenantFields,
  moveId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMove' },
  pickingId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockPicking' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockProductVariant', required: true },
  productUomId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockUom', required: true },
  quantity: { ...decimalField, default: '0' },
  quantityProduct: { ...decimalField, default: '0' },
  picked: { type: Boolean, default: false },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  locationDestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLocation', required: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, default: null },
  lotName: { type: String },
  packageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  resultPackageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, default: null },
  state: {
    type: String,
    enum: ['draft', 'waiting', 'confirmed', 'partially_available', 'assigned', 'done', 'cancel'],
    default: 'draft',
  },
  reference: { type: String },
}, { timestamps: true });

stockMoveLineSchema.index({ tenantId: 1, pickingId: 1 });
stockMoveLineSchema.index({ tenantId: 1, moveId: 1 });

export default mongoose.models.StockMoveLine || mongoose.model('StockMoveLine', stockMoveLineSchema);
